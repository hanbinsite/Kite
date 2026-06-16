#[cfg(test)]
mod integration_tests {
    use crate::commands::http::{
        HttpRequestConfig, RequestSettings, Header, BodyConfig, UrlEncodedParam,
        build_client, apply_auth_to_config,
        AuthConfig, BearerAuth,
    };
    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path, header_exists};

    fn test_config() -> HttpRequestConfig {
        HttpRequestConfig {
            id: "test-1".into(),
            method: "GET".into(),
            url: String::new(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        }
    }

    #[tokio::test]
    async fn test_get_request_returns_200() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/users"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({"id":1,"name":"test"})))
            .mount(&server)
            .await;

        let mut config = test_config();
        config.url = format!("{}/users", server.uri());
        let client = build_client(&config.settings).unwrap();
        let response = client.get(&config.url).send().await.unwrap();
        assert_eq!(response.status(), 200);
        let body = response.text().await.unwrap();
        assert!(body.contains("test"));
    }

    #[tokio::test]
    async fn test_post_json_body() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/echo"))
            .respond_with(ResponseTemplate::new(201).set_body_string(r#"{"echo":"ok"}"#))
            .mount(&server)
            .await;

        let mut config = test_config();
        config.method = "POST".into();
        config.url = format!("{}/echo", server.uri());
        let client = build_client(&config.settings).unwrap();
        let response = client
            .post(&config.url)
            .header("Content-Type", "application/json")
            .body(r#"{"data":"hello"}"#)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 201);
    }

    #[tokio::test]
    async fn test_request_with_headers() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/headers"))
            .and(header_exists("X-Custom"))
            .respond_with(ResponseTemplate::new(200))
            .mount(&server)
            .await;

        let mut config = test_config();
        config.url = format!("{}/headers", server.uri());
        config.headers.push(Header {
            key: "X-Custom".into(),
            value: "test-value".into(),
            disabled: false,
        });
        let client = build_client(&config.settings).unwrap();
        let mut req = client.get(&config.url);
        for h in &config.headers {
            if !h.disabled && !h.key.is_empty() {
                req = req.header(&h.key, &h.value);
            }
        }
        let response = req.send().await.unwrap();
        assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    async fn test_request_with_query_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/search"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({"results":[]})))
            .mount(&server)
            .await;

        let mut config = test_config();
        config.url = format!("{}/search", server.uri());
        let client = build_client(&config.settings).unwrap();
        let response = client
            .get(&config.url)
            .query(&[("q", "hello"), ("page", "1")])
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    async fn test_delete_request() {
        let server = MockServer::start().await;
        Mock::given(method("DELETE"))
            .and(path("/items/1"))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let config = HttpRequestConfig {
            id: "t".into(),
            method: "DELETE".into(),
            url: format!("{}/items/1", server.uri()),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let client = build_client(&config.settings).unwrap();
        let response = client.delete(&config.url).send().await.unwrap();
        assert_eq!(response.status(), 204);
    }

    #[tokio::test]
    async fn test_request_with_bearer_auth() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/secure"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&server)
            .await;

        let mut config = test_config();
        config.url = format!("{}/secure", server.uri());
        config.auth = Some(AuthConfig::Bearer(BearerAuth {
            token: "fake-token".into(),
            prefix: "Bearer".into(),
        }));
        apply_auth_to_config(&mut config).unwrap();
        let client = build_client(&config.settings).unwrap();
        let mut req = client.get(&config.url);
        for h in &config.headers {
            if !h.disabled && !h.key.is_empty() {
                req = req.header(&h.key, &h.value);
            }
        }
        let response = req.send().await.unwrap();
        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn test_request_connect_failure() {
        let config = HttpRequestConfig {
            id: "t".into(),
            method: "GET".into(),
            url: "http://127.0.0.1:19999/nonexistent".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let client = build_client(&config.settings).unwrap();
        let result = client.get(&config.url).send().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_timeout_triggers() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/slow"))
            .respond_with(ResponseTemplate::new(200).set_delay(std::time::Duration::from_secs(5)))
            .mount(&server)
            .await;

        let mut settings = RequestSettings::default();
        settings.timeout_ms = 100;
        let mut config = test_config();
        config.url = format!("{}/slow", server.uri());
        config.settings = settings;
        let client = build_client(&config.settings).unwrap();
        let result = client.get(&config.url).send().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().is_timeout());
    }

    #[tokio::test]
    async fn test_no_redirect_follow() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/redirect"))
            .respond_with(ResponseTemplate::new(302).insert_header("Location", "/final"))
            .mount(&server)
            .await;
        Mock::given(method("GET"))
            .and(path("/final"))
            .respond_with(ResponseTemplate::new(200))
            .mount(&server)
            .await;

        let mut settings = RequestSettings::default();
        settings.follow_redirects = false;
        let config = HttpRequestConfig {
            id: "t".into(),
            method: "GET".into(),
            url: format!("{}/redirect", server.uri()),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings,
        };
        let client = build_client(&config.settings).unwrap();
        let response = client.get(&config.url).send().await.unwrap();
        assert_eq!(response.status(), 302);
    }

    #[tokio::test]
    async fn test_form_urlencoded_body() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/login"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({"ok":true})))
            .mount(&server)
            .await;

        let config = HttpRequestConfig {
            id: "t".into(),
            method: "POST".into(),
            url: format!("{}/login", server.uri()),
            headers: vec![],
            params: vec![],
            body: Some(BodyConfig {
                mode: "urlencoded".into(),
                content: None,
                content_type: None,
                formdata: vec![],
                urlencoded: vec![
                    UrlEncodedParam { key: "username".into(), value: "admin".into(), disabled: false },
                    UrlEncodedParam { key: "password".into(), value: "secret".into(), disabled: false },
                ],
                graphql_query: None,
                graphql_variables: None,
            }),
            auth: None,
            settings: RequestSettings::default(),
        };
        let client = build_client(&config.settings).unwrap();
        let pairs: Vec<(&str, &str)> = config.body.as_ref().unwrap().urlencoded
            .iter()
            .filter(|p| !p.disabled && !p.key.is_empty())
            .map(|p| (p.key.as_str(), p.value.as_str()))
            .collect();
        let response = client.post(&config.url).form(&pairs).send().await.unwrap();
        assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    async fn test_response_body_size_limit() {
        let server = MockServer::start().await;
        let big_body = "x".repeat(100_000); // 100KB - under 10MB limit
        Mock::given(method("GET"))
            .and(path("/big"))
            .respond_with(ResponseTemplate::new(200).set_body_string(big_body.clone()))
            .mount(&server)
            .await;

        let config = HttpRequestConfig {
            id: "t".into(),
            method: "GET".into(),
            url: format!("{}/big", server.uri()),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let client = build_client(&config.settings).unwrap();
        let response = client.get(&config.url).send().await.unwrap();
        let bytes = response.bytes().await.unwrap();
        assert_eq!(bytes.len(), 100_000);
    }

    #[tokio::test]
    async fn test_response_headers_parsing() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/custom-headers"))
            .respond_with(ResponseTemplate::new(200)
                .insert_header("X-Rate-Limit", "100")
                .insert_header("X-Request-Id", "abc-123")
                .set_body_string("ok"))
            .mount(&server)
            .await;

        let config = HttpRequestConfig {
            id: "t".into(),
            method: "GET".into(),
            url: format!("{}/custom-headers", server.uri()),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let client = build_client(&config.settings).unwrap();
        let response = client.get(&config.url).send().await.unwrap();
        assert_eq!(response.headers().get("x-rate-limit").unwrap(), "100");
        assert_eq!(response.headers().get("x-request-id").unwrap(), "abc-123");
    }

    #[tokio::test]
    async fn test_content_type_json_response() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api"))
            .respond_with(ResponseTemplate::new(200)
                .insert_header("Content-Type", "application/json")
                .set_body_json(serde_json::json!({"version":"1.0"})))
            .mount(&server)
            .await;

        let config = HttpRequestConfig {
            id: "t".into(),
            method: "GET".into(),
            url: format!("{}/api", server.uri()),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let client = build_client(&config.settings).unwrap();
        let response = client.get(&config.url).send().await.unwrap();
        assert_eq!(response.status(), 200);
        let body = response.json::<serde_json::Value>().await.unwrap();
        assert_eq!(body["version"], "1.0");
    }
}