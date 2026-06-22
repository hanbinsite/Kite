use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub format: String,
    pub requests: Vec<ImportedRequest>,
    pub collection_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedRequest {
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub body_content_type: Option<String>,
    pub auth: Option<String>,
}

#[tauri::command]
pub async fn import_curl(command: String) -> Result<ImportResult, AppError> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err(AppError::invalid_input("Empty cURL command".into()));
    }
    let tokens = tokenize_curl(trimmed);
    if tokens.is_empty() || tokens[0].to_lowercase() != "curl" {
        return Err(AppError::invalid_input("Not a valid cURL command".into()));
    }

    let mut method = "GET".to_string();
    let mut url = String::new();
    let mut headers: Vec<(String, String)> = Vec::new();
    let mut body: Option<String> = None;
    let mut body_content_type: Option<String> = None;
    let mut auth_header: Option<String> = None;

    let mut i = 1;
    while i < tokens.len() {
        let token = &tokens[i];
        match token.as_str() {
            "-X" | "--request" => {
                i += 1;
                if let Some(val) = tokens.get(i) {
                    method = val.to_uppercase();
                }
            }
            "-H" | "--header" => {
                i += 1;
                if let Some(val) = tokens.get(i) {
                    if let Some(idx) = val.find(':') {
                        let key = val[..idx].trim().to_string();
                        let value = val[idx + 1..].trim().to_string();
                        if key.eq_ignore_ascii_case("content-type") {
                            body_content_type = Some(value);
                        } else if key.eq_ignore_ascii_case("authorization") {
                            auth_header = Some(value);
                        } else {
                            headers.push((key, value));
                        }
                    }
                }
            }
            "-d" | "--data" | "--data-raw" | "--data-binary" => {
                i += 1;
                if let Some(val) = tokens.get(i) {
                    body = Some(val.clone());
                    if method == "GET" {
                        method = "POST".to_string();
                    }
                }
            }
            "--data-urlencode" => {
                i += 1;
                if let Some(val) = tokens.get(i) {
                    body = Some(val.clone());
                    body_content_type = Some("application/x-www-form-urlencoded".to_string());
                    if method == "GET" {
                        method = "POST".to_string();
                    }
                }
            }
            "-F" | "--form" => {
                if method == "GET" {
                    method = "POST".to_string();
                }
                body_content_type = Some("multipart/form-data".to_string());
            }
            "-u" | "--user" => {
                i += 1;
                if let Some(val) = tokens.get(i) {
                    let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, val);
                    auth_header = Some(format!("Basic {}", encoded));
                }
            }
            "-b" | "--cookie" => {
                i += 1;
            }
            _ => {
                if !token.starts_with('-') && url.is_empty() {
                    url = token.clone();
                }
            }
        }
        i += 1;
    }

    if let Some(auth) = auth_header {
        if auth.to_lowercase().starts_with("bearer ") || auth.to_lowercase().starts_with("basic ") {
            // keep as auth summary
        } else {
            headers.push(("Authorization".to_string(), auth));
        }
    }

    let clean_url = strip_query(&url);
    let name = if clean_url.is_empty() {
        format!("{} {}", method, url)
    } else {
        format!("{} {}", method, clean_url)
    };

    Ok(ImportResult {
        format: "curl".to_string(),
        collection_name: Some("cURL Import".to_string()),
        requests: vec![ImportedRequest {
            name,
            method,
            url: if clean_url.is_empty() { url } else { clean_url },
            headers,
            body,
            body_content_type,
            auth: None,
        }],
    })
}

#[tauri::command]
pub async fn import_postman(json: String) -> Result<ImportResult, AppError> {
    let collection: Value = serde_json::from_str(&json)
        .map_err(|e| AppError::storage_parse_failed(format!("Invalid Postman JSON: {}", e)))?;

    let collection_name = collection
        .get("info")
        .and_then(|i| i.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("Postman Import")
        .to_string();

    let mut requests = Vec::new();
    if let Some(items) = collection.get("item").and_then(|i| i.as_array()) {
        for item in items {
            flatten_postman_items(item, &mut requests);
        }
    }

    Ok(ImportResult {
        format: "postman".to_string(),
        collection_name: Some(collection_name),
        requests,
    })
}

fn flatten_postman_items(item: &Value, requests: &mut Vec<ImportedRequest>) {
    if let Some(sub_items) = item.get("item").and_then(|i| i.as_array()) {
        for sub in sub_items {
            flatten_postman_items(sub, requests);
        }
        return;
    }

    let name = item.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
    let req = match item.get("request") {
        Some(r) => r,
        None => return,
    };

    let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("GET").to_uppercase();
    let url = postman_url_to_string(req.get("url"));

    let mut headers: Vec<(String, String)> = Vec::new();
    if let Some(header_arr) = req.get("header").and_then(|h| h.as_array()) {
        for h in header_arr {
            let key = h.get("key").and_then(|k| k.as_str()).unwrap_or("").to_string();
            let value = h.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !key.is_empty() {
                headers.push((key, value));
            }
        }
    }

    let (body, body_content_type) = postman_body(req.get("body"));

    requests.push(ImportedRequest {
        name,
        method,
        url,
        headers,
        body,
        body_content_type,
        auth: None,
    });
}

fn postman_url_to_string(url: Option<&Value>) -> String {
    let Some(url_val) = url else { return String::new() };
    if let Some(s) = url_val.as_str() {
        return s.to_string();
    }
    if let Some(raw) = url_val.get("raw").and_then(|r| r.as_str()) {
        return raw.to_string();
    }
    if let (Some(host), Some(path)) = (url_val.get("host").and_then(|h| h.as_array()), url_val.get("path").and_then(|p| p.as_array())) {
        let host_str: Vec<&str> = host.iter().filter_map(|h| h.as_str()).collect();
        let path_str: Vec<&str> = path.iter().filter_map(|p| p.as_str()).collect();
        return format!("https://{}/{}", host_str.join("."), path_str.join("/"));
    }
    String::new()
}

fn postman_body(body: Option<&Value>) -> (Option<String>, Option<String>) {
    let Some(body_val) = body else { return (None, None) };
    let mode = body_val.get("mode").and_then(|m| m.as_str()).unwrap_or("");
    match mode {
        "raw" => {
            let raw = body_val.get("raw").and_then(|r| r.as_str()).map(|s| s.to_string());
            let lang = body_val
                .get("options")
                .and_then(|o| o.get("raw"))
                .and_then(|r| r.get("language"))
                .and_then(|l| l.as_str())
                .unwrap_or("json");
            let ct = match lang {
                "json" => "application/json",
                "xml" => "application/xml",
                "html" => "text/html",
                _ => "text/plain",
            }
            .to_string();
            (raw, Some(ct))
        }
        "urlencoded" => (None, Some("application/x-www-form-urlencoded".to_string())),
        "formdata" => (None, Some("multipart/form-data".to_string())),
        _ => (None, None),
    }
}

#[tauri::command]
pub async fn import_har(json: String) -> Result<ImportResult, AppError> {
    let har: Value = serde_json::from_str(&json)
        .map_err(|e| AppError::storage_parse_failed(format!("Invalid HAR JSON: {}", e)))?;

    let mut requests = Vec::new();
    let entries = har
        .get("log")
        .and_then(|l| l.get("entries"))
        .and_then(|e| e.as_array())
        .cloned()
        .unwrap_or_default();

    for entry in entries {
        let Some(req) = entry.get("request") else { continue };
        let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("GET").to_uppercase();
        let raw_url = req.get("url").and_then(|u| u.as_str()).unwrap_or("").to_string();
        let url = strip_query(&raw_url);

        let mut headers: Vec<(String, String)> = Vec::new();
        if let Some(header_arr) = req.get("headers").and_then(|h| h.as_array()) {
            for h in header_arr {
                let key = h.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                let value = h.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if !key.is_empty() {
                    headers.push((key, value));
                }
            }
        }

        let (body, body_content_type) = if let Some(post) = req.get("postData") {
            let mime = post.get("mimeType").and_then(|m| m.as_str()).unwrap_or("").to_string();
            let text = post.get("text").and_then(|t| t.as_str()).map(|s| s.to_string());
            (text, if mime.is_empty() { None } else { Some(mime) })
        } else {
            (None, None)
        };

        requests.push(ImportedRequest {
            name: format!("{} {}", method, url),
            method,
            url,
            headers,
            body,
            body_content_type,
            auth: None,
        });
    }

    Ok(ImportResult {
        format: "har".to_string(),
        collection_name: Some("HAR Import".to_string()),
        requests,
    })
}

#[tauri::command]
pub async fn detect_import_format(content: String) -> Result<String, AppError> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Ok("unknown".to_string());
    }
    if trimmed.to_lowercase().starts_with("curl ") {
        return Ok("curl".to_string());
    }
    let Ok(json): Result<Value, _> = serde_json::from_str(trimmed) else {
        return Ok("unknown".to_string());
    };
    let has_postman_id = json
        .get("info")
        .and_then(|i| i.get("_postman_id"))
        .is_some();
    let has_info_item = json.get("info").is_some() && json.get("item").is_some();
    if has_postman_id || (has_info_item && json.get("item").and_then(|i| i.as_array()).is_some()) {
        return Ok("postman".to_string());
    }
    if json.get("log").and_then(|l| l.get("entries")).is_some() {
        return Ok("har".to_string());
    }
    if json.get("openapi").is_some() || json.get("swagger").is_some() {
        return Ok("openapi".to_string());
    }
    Ok("unknown".to_string())
}

#[tauri::command]
pub async fn export_postman(requests_json: String, collection_name: String) -> Result<String, AppError> {
    let requests: Vec<Value> = serde_json::from_str(&requests_json)
        .map_err(|e| AppError::invalid_input(format!("Invalid requests JSON: {}", e)))?;

    let items: Vec<Value> = requests.iter().map(build_postman_item).collect();

    let collection = json!({
        "info": {
            "name": collection_name,
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "_postman_id": uuid::Uuid::new_v4().to_string(),
        },
        "item": items,
    });

    serde_json::to_string_pretty(&collection)
        .map_err(|e| AppError::internal(format!("Failed to serialize Postman collection: {}", e)))
}

fn build_postman_item(req: &Value) -> Value {
    let name = req.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
    let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("GET").to_string();
    let url = req.get("url").and_then(|u| u.as_str()).unwrap_or("").to_string();

    let header: Vec<Value> = req
        .get("headers")
        .and_then(|h| h.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|h| !h.get("disabled").and_then(|d| d.as_bool()).unwrap_or(false))
                .map(|h| {
                    json!({
                        "key": h.get("key").and_then(|k| k.as_str()).unwrap_or(""),
                        "value": h.get("value").and_then(|v| v.as_str()).unwrap_or(""),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let url_split: Vec<&str> = url.split('/').collect();
    let host_str = if url_split.len() >= 3 { url_split[2].to_string() } else { String::new() };
    let path_str = if url_split.len() > 3 { url_split[3..].join("/") } else { String::new() };
    let host: Vec<&str> = host_str.split('.').collect();
    let path: Vec<&str> = path_str.split('/').filter(|p| !p.is_empty()).collect();

    let body = req.get("body").and_then(|b| {
        let mode = b.get("mode").and_then(|m| m.as_str()).unwrap_or("");
        if mode.is_empty() { return None; }
        Some(json!({
            "mode": mode,
            "raw": b.get("content").and_then(|c| c.as_str()).unwrap_or(""),
            "options": b.get("language").and_then(|l| l.as_str()).map(|lang| json!({ "raw": { "language": lang } })).unwrap_or(Value::Null),
        }))
    });

    json!({
        "name": name,
        "request": {
            "method": method,
            "header": header,
            "url": {
                "raw": url,
                "host": host,
                "path": path,
            },
            "body": body,
        },
    })
}

#[tauri::command]
pub async fn export_curl(
    method: String,
    url: String,
    headers_json: String,
    body: Option<String>,
) -> Result<String, AppError> {
    let headers: Vec<(String, String)> = serde_json::from_str(&headers_json)
        .map_err(|e| AppError::invalid_input(format!("Invalid headers JSON: {}", e)))?;

    let mut parts: Vec<String> = vec!["curl".to_string()];
    let method_upper = method.to_uppercase();
    if method_upper != "GET" {
        parts.push("-X".to_string());
        parts.push(method_upper);
    }

    for (key, value) in &headers {
        parts.push("-H".to_string());
        parts.push(format!("'{}: {}'", key, value));
    }

    if let Some(b) = body {
        if !b.is_empty() {
            parts.push("-d".to_string());
            parts.push(format!("'{}'", b));
        }
    }

    parts.push(format!("'{}'", url));
    Ok(parts.join(" "))
}

fn tokenize_curl(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single = false;
    let mut in_double = false;
    let mut escaped = false;

    for ch in input.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '\'' && !in_double {
            in_single = !in_single;
            continue;
        }
        if ch == '"' && !in_single {
            in_double = !in_double;
            continue;
        }
        if (ch == ' ' || ch == '\t' || ch == '\n') && !in_single && !in_double {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(ch);
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn strip_query(url: &str) -> String {
    match url.find('?') {
        Some(idx) => url[..idx].to_string(),
        None => url.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_import_curl_basic() {
        let result = import_curl("curl https://api.example.com/users".into()).await.unwrap();
        assert_eq!(result.format, "curl");
        assert_eq!(result.collection_name.as_deref(), Some("cURL Import"));
        assert_eq!(result.requests.len(), 1);
        let req = &result.requests[0];
        assert_eq!(req.method, "GET");
        assert_eq!(req.url, "https://api.example.com/users");
        assert!(req.body.is_none());
    }

    #[tokio::test]
    async fn test_import_curl_with_method_and_headers() {
        let cmd = r#"curl -X POST -H "Content-Type: application/json" -H "X-Trace: abc" -d '{"name":"foo"}' https://api.example.com/users"#;
        let result = import_curl(cmd.into()).await.unwrap();
        let req = &result.requests[0];
        assert_eq!(req.method, "POST");
        assert_eq!(req.url, "https://api.example.com/users");
        assert_eq!(req.headers.len(), 1);
        assert_eq!(req.headers[0].0, "X-Trace");
        assert_eq!(req.headers[0].1, "abc");
        assert_eq!(req.body.as_deref(), Some(r#"{"name":"foo"}"#));
        assert_eq!(req.body_content_type.as_deref(), Some("application/json"));
    }

    #[tokio::test]
    async fn test_import_curl_data_implies_post() {
        let cmd = r#"curl -d 'hello' https://api.example.com/echo"#;
        let result = import_curl(cmd.into()).await.unwrap();
        let req = &result.requests[0];
        assert_eq!(req.method, "POST");
        assert_eq!(req.body.as_deref(), Some("hello"));
    }

    #[tokio::test]
    async fn test_import_curl_single_quotes() {
        let cmd = "curl -X DELETE 'https://api.example.com/users/123'";
        let result = import_curl(cmd.into()).await.unwrap();
        let req = &result.requests[0];
        assert_eq!(req.method, "DELETE");
        assert_eq!(req.url, "https://api.example.com/users/123");
    }

    #[tokio::test]
    async fn test_import_curl_invalid() {
        let result = import_curl("not-a-curl-command".into()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_import_curl_strip_query() {
        let cmd = "curl 'https://api.example.com/users?page=1&limit=10'";
        let result = import_curl(cmd.into()).await.unwrap();
        let req = &result.requests[0];
        assert_eq!(req.url, "https://api.example.com/users");
    }

    #[tokio::test]
    async fn test_import_curl_user_basic_auth() {
        let cmd = r#"curl -u "alice:secret" https://api.example.com/me"#;
        let result = import_curl(cmd.into()).await.unwrap();
        let req = &result.requests[0];
        assert_eq!(req.method, "GET");
    }

    #[tokio::test]
    async fn test_detect_curl() {
        assert_eq!(detect_import_format("curl https://example.com".into()).await.unwrap(), "curl");
        assert_eq!(detect_import_format("CURL https://example.com".into()).await.unwrap(), "curl");
    }

    #[tokio::test]
    async fn test_detect_postman() {
        let json = r#"{"info":{"_postman_id":"abc","name":"x","schema":"y"},"item":[]}"#;
        assert_eq!(detect_import_format(json.into()).await.unwrap(), "postman");
    }

    #[tokio::test]
    async fn test_detect_har() {
        let json = r#"{"log":{"entries":[]}}"#;
        assert_eq!(detect_import_format(json.into()).await.unwrap(), "har");
    }

    #[tokio::test]
    async fn test_detect_openapi() {
        let json = r#"{"openapi":"3.0.0","info":{"title":"x","version":"1"}}"#;
        assert_eq!(detect_import_format(json.into()).await.unwrap(), "openapi");
        let json2 = r#"{"swagger":"2.0","info":{"title":"x","version":"1"}}"#;
        assert_eq!(detect_import_format(json2.into()).await.unwrap(), "openapi");
    }

    #[tokio::test]
    async fn test_detect_unknown() {
        assert_eq!(detect_import_format("hello world".into()).await.unwrap(), "unknown");
        assert_eq!(detect_import_format("".into()).await.unwrap(), "unknown");
        assert_eq!(detect_import_format("{not json".into()).await.unwrap(), "unknown");
    }

    #[tokio::test]
    async fn test_import_postman_basic() {
        let json = r#"{
            "info": {"name": "My Collection", "schema": "x", "_postman_id": "1"},
            "item": [
                {"name": "Get Users", "request": {"method": "GET", "url": "https://api.example.com/users", "header": [{"key": "X-Api-Key", "value": "secret"}]}}
            ]
        }"#;
        let result = import_postman(json.into()).await.unwrap();
        assert_eq!(result.format, "postman");
        assert_eq!(result.collection_name.as_deref(), Some("My Collection"));
        assert_eq!(result.requests.len(), 1);
        let req = &result.requests[0];
        assert_eq!(req.name, "Get Users");
        assert_eq!(req.method, "GET");
        assert_eq!(req.url, "https://api.example.com/users");
        assert_eq!(req.headers.len(), 1);
        assert_eq!(req.headers[0].0, "X-Api-Key");
    }

    #[tokio::test]
    async fn test_import_postman_nested_folders() {
        let json = r#"{
            "info": {"name": "C", "schema": "x"},
            "item": [
                {"name": "Folder", "item": [
                    {"name": "Nested", "request": {"method": "POST", "url": {"raw": "https://api.example.com/n", "host": ["api","example","com"], "path": ["n"]}}}
                ]}
            ]
        }"#;
        let result = import_postman(json.into()).await.unwrap();
        assert_eq!(result.requests.len(), 1);
        assert_eq!(result.requests[0].name, "Nested");
        assert_eq!(result.requests[0].method, "POST");
    }

    #[tokio::test]
    async fn test_import_har_basic() {
        let json = r#"{
            "log": {"entries": [
                {"request": {"method": "GET", "url": "https://api.example.com/users?page=1", "headers": [{"name": "Accept", "value": "application/json"}]}},
                {"request": {"method": "POST", "url": "https://api.example.com/login", "postData": {"mimeType": "application/json", "text": "{\"u\":\"a\"}"}}}
            ]}
        }"#;
        let result = import_har(json.into()).await.unwrap();
        assert_eq!(result.format, "har");
        assert_eq!(result.requests.len(), 2);
        assert_eq!(result.requests[0].method, "GET");
        assert_eq!(result.requests[0].url, "https://api.example.com/users");
        assert_eq!(result.requests[0].headers[0].0, "Accept");
        assert_eq!(result.requests[1].method, "POST");
        assert_eq!(result.requests[1].body.as_deref(), Some(r#"{"u":"a"}"#));
        assert_eq!(result.requests[1].body_content_type.as_deref(), Some("application/json"));
    }

    #[tokio::test]
    async fn test_export_curl_basic() {
        let headers = r#"[["Content-Type","application/json"],["X-Trace","abc"]]"#;
        let result = export_curl("POST".into(), "https://api.example.com/x".into(), headers.into(), Some(r#"{"k":"v"}"#.into())).await.unwrap();
        assert!(result.contains("curl"));
        assert!(result.contains("-X POST"));
        assert!(result.contains("-H 'Content-Type: application/json'"));
        assert!(result.contains("-H 'X-Trace: abc'"));
        assert!(result.contains("-d '{\"k\":\"v\"}'"));
        assert!(result.contains("'https://api.example.com/x'"));
    }

    #[tokio::test]
    async fn test_export_curl_get_no_body() {
        let result = export_curl("GET".into(), "https://api.example.com/x".into(), "[]".into(), None).await.unwrap();
        assert!(!result.contains("-X"));
        assert!(!result.contains("-d"));
        assert!(result.contains("'https://api.example.com/x'"));
    }

    #[tokio::test]
    async fn test_export_postman_basic() {
        let requests = r#"[{"name":"r1","method":"GET","url":"https://api.example.com/users","headers":[{"key":"X","value":"y","disabled":false}]}]"#;
        let result = export_postman(requests.into(), "My Col".into()).await.unwrap();
        let v: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["info"]["name"], "My Col");
        assert_eq!(v["item"][0]["name"], "r1");
        assert_eq!(v["item"][0]["request"]["method"], "GET");
    }

    #[test]
    fn test_tokenize_simple() {
        let tokens = tokenize_curl("curl -X GET https://example.com");
        assert_eq!(tokens, vec!["curl", "-X", "GET", "https://example.com"]);
    }

    #[test]
    fn test_tokenize_quotes() {
        let tokens = tokenize_curl("curl -H 'Content-Type: application/json' https://example.com");
        assert_eq!(tokens, vec!["curl", "-H", "Content-Type: application/json", "https://example.com"]);
    }

    #[test]
    fn test_tokenize_escaped() {
        let tokens = tokenize_curl(r#"curl -d "{\"a\":1}" https://example.com"#);
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[2], r#"{"a":1}"#);
    }

    #[test]
    fn test_strip_query() {
        assert_eq!(strip_query("https://x.com/a?b=1"), "https://x.com/a");
        assert_eq!(strip_query("https://x.com/a"), "https://x.com/a");
        assert_eq!(strip_query(""), "");
    }
}
