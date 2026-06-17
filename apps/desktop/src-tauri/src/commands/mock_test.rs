use crate::commands::mock::{
    MockRoute, MockServerConfig, MockServerStatus, MockRequestLog,
    KeyValue, match_route,
};

#[test]
fn test_mock_route_serde() {
    let route = MockRoute {
        id: "route-1".into(),
        method: "GET".into(),
        path: "/api/users".into(),
        status: 200,
        headers: vec![
            KeyValue { key: "content-type".into(), value: "application/json".into() },
        ],
        body: r#"{"users":[]}"#.into(),
        delay_ms: 100,
    };
    let json = serde_json::to_string(&route).unwrap();
    assert!(json.contains("\"id\":\"route-1\""));
    assert!(json.contains("delayMs"));
    let parsed: MockRoute = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, "route-1");
    assert_eq!(parsed.method, "GET");
    assert_eq!(parsed.path, "/api/users");
    assert_eq!(parsed.status, 200);
    assert_eq!(parsed.delay_ms, 100);
    assert_eq!(parsed.headers.len(), 1);
}

#[test]
fn test_mock_route_defaults() {
    let json = r#"{"id":"r1","method":"POST","path":"/x","status":201}"#;
    let route: MockRoute = serde_json::from_str(json).unwrap();
    assert!(route.headers.is_empty());
    assert!(route.body.is_empty());
    assert_eq!(route.delay_ms, 0);
}

#[test]
fn test_mock_server_config_deser() {
    let json = r#"{"port":4321}"#;
    let config: MockServerConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.port, 4321);
}

#[test]
fn test_mock_server_status_serde() {
    let status = MockServerStatus { running: true, port: Some(8080) };
    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("running"));
    assert!(json.contains("8080"));
    let parsed: MockServerStatus = serde_json::from_str(&json).unwrap();
    assert!(parsed.running);
    assert_eq!(parsed.port, Some(8080));
}

#[test]
fn test_mock_server_status_stopped() {
    let status = MockServerStatus { running: false, port: None };
    let json = serde_json::to_string(&status).unwrap();
    let parsed: MockServerStatus = serde_json::from_str(&json).unwrap();
    assert!(!parsed.running);
    assert_eq!(parsed.port, None);
}

#[test]
fn test_mock_request_log_serde() {
    let log = MockRequestLog {
        method: "POST".into(),
        path: "/api/data".into(),
        matched_route_id: Some("route-5".into()),
        status: 201,
        timestamp: 1700000000000,
    };
    let json = serde_json::to_string(&log).unwrap();
    assert!(json.contains("matchedRouteId"));
    let parsed: MockRequestLog = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.method, "POST");
    assert_eq!(parsed.matched_route_id.as_deref(), Some("route-5"));
    assert_eq!(parsed.status, 201);
}

#[test]
fn test_mock_request_log_unmatched() {
    let log = MockRequestLog {
        method: "GET".into(),
        path: "/not-found".into(),
        matched_route_id: None,
        status: 404,
        timestamp: 1,
    };
    let json = serde_json::to_string(&log).unwrap();
    let parsed: MockRequestLog = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.matched_route_id, None);
    assert_eq!(parsed.status, 404);
}

#[tokio::test]
async fn test_match_route_exact() {
    let routes = vec![
        MockRoute { id: "r1".into(), method: "GET".into(), path: "/api/users".into(), status: 200, headers: vec![], body: "[]".into(), delay_ms: 0 },
        MockRoute { id: "r2".into(), method: "POST".into(), path: "/api/users".into(), status: 201, headers: vec![], body: "{}".into(), delay_ms: 0 },
    ];
    let matched = match_route("GET", "/api/users", &routes).await;
    assert!(matched.is_some());
    assert_eq!(matched.unwrap().id, "r1");
}

#[tokio::test]
async fn test_match_route_case_insensitive() {
    let routes = vec![
        MockRoute { id: "r1".into(), method: "GET".into(), path: "/api/data".into(), status: 200, headers: vec![], body: "".into(), delay_ms: 0 },
    ];
    let matched = match_route("get", "/api/data", &routes).await;
    assert!(matched.is_some());
    assert_eq!(matched.unwrap().id, "r1");
}

#[tokio::test]
async fn test_match_route_no_match_method() {
    let routes = vec![
        MockRoute { id: "r1".into(), method: "GET".into(), path: "/api/x".into(), status: 200, headers: vec![], body: "".into(), delay_ms: 0 },
    ];
    let matched = match_route("POST", "/api/x", &routes).await;
    assert!(matched.is_none());
}

#[tokio::test]
async fn test_match_route_no_match_path() {
    let routes = vec![
        MockRoute { id: "r1".into(), method: "GET".into(), path: "/api/x".into(), status: 200, headers: vec![], body: "".into(), delay_ms: 0 },
    ];
    let matched = match_route("GET", "/api/y", &routes).await;
    assert!(matched.is_none());
}

#[tokio::test]
async fn test_match_route_empty_routes() {
    let routes: Vec<MockRoute> = vec![];
    let matched = match_route("GET", "/anything", &routes).await;
    assert!(matched.is_none());
}