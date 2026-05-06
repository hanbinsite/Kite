use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tauri::{Emitter, State};
use serde::{Deserialize, Serialize};

use hyper::StatusCode;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use http_body_util::Full;
use http_body_util::combinators::UnsyncBoxBody;
use http_body_util::BodyExt;

type BoxBody = UnsyncBoxBody<bytes::Bytes, hyper::Error>;

fn full_body(data: impl Into<bytes::Bytes>) -> BoxBody {
    Full::new(data.into())
        .map_err(|never| match never {})
        .boxed_unsync()
}

pub struct MockState {
    pub server: Arc<RwLock<Option<MockServer>>>,
    pub routes: Arc<RwLock<Vec<MockRoute>>>,
}

impl Default for MockState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct MockServer {
    pub port: u16,
    pub shutdown: tokio::sync::oneshot::Sender<()>,
}

impl MockState {
    pub fn new() -> Self {
        Self {
            server: Arc::new(RwLock::new(None)),
            routes: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockRoute {
    pub id: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerConfig {
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerStatus {
    pub running: bool,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockRequestLog {
    pub method: String,
    pub path: String,
    pub matched_route_id: Option<String>,
    pub status: u16,
    pub timestamp: u64,
}

async fn match_route(
    method: &str,
    path: &str,
    routes: &[MockRoute],
) -> Option<MockRoute> {
    routes.iter().find(|r| {
        r.method.eq_ignore_ascii_case(method) && r.path == path
    }).cloned()
}

async fn handle_mock_request(
    req: hyper::Request<hyper::body::Incoming>,
    routes: Arc<RwLock<Vec<MockRoute>>>,
    app_handle: tauri::AppHandle,
) -> Result<hyper::Response<BoxBody>, hyper::Error> {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let routes_guard = routes.read().await;
    let route = match_route(&method, &path, &routes_guard).await;

    let (status, headers, body, matched_id) = if let Some(r) = route {
        if r.delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(r.delay_ms)).await;
        }
        (r.status, r.headers.clone(), r.body.clone(), Some(r.id.clone()))
    } else {
        (404, vec![], "No matching route found".to_string(), None)
    };

    drop(routes_guard);

    let log = MockRequestLog {
        method,
        path,
        matched_route_id: matched_id,
        status,
        timestamp,
    };
    let _ = app_handle.emit("mock-request-received", &log);

    let mut resp = hyper::Response::builder()
        .status(StatusCode::from_u16(status).unwrap_or(StatusCode::OK));
    for h in &headers {
        resp = resp.header(&h.key, &h.value);
    }
    Ok(resp.body(full_body(body))
        .unwrap_or_else(|_| {
            hyper::Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(full_body("Internal error"))
                .unwrap()
        }))
}

#[tauri::command]
pub async fn start_mock_server(
    app: tauri::AppHandle,
    state: State<'_, MockState>,
    config: MockServerConfig,
) -> Result<(), crate::error::AppError> {
    {
        let server = state.server.read().await;
        if server.is_some() {
            return Err(crate::error::AppError::proxy_start_failed(
                "Mock server is already running".to_string(),
            ));
        }
    }

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    let port = config.port;
    let routes = state.routes.clone();
    let app_handle = app.clone();

    let listener = tokio::net::TcpListener::bind(std::net::SocketAddr::from(([0, 0, 0, 0], port)))
        .await
        .map_err(|e| crate::error::AppError::proxy_start_failed(format!("Failed to bind port {}: {}", port, e)))?;

    let actual_port = listener.local_addr()
        .map_err(|e| crate::error::AppError::proxy_start_failed(format!("Failed to get local addr: {}", e)))?
        .port();

    tokio::spawn(async move {
        let listener = listener;
        let mut shutdown_rx = std::pin::pin!(shutdown_rx);
        loop {
            tokio::select! {
                accept_result = listener.accept() => {
                    match accept_result {
                        Ok((stream, _)) => {
                            let io = TokioIo::new(stream);
                            let routes = routes.clone();
                            let app_handle = app_handle.clone();
                            tokio::spawn(async move {
                                let service = service_fn(move |req| {
                                    let routes = routes.clone();
                                    let app_handle = app_handle.clone();
                                    async move {
                                        handle_mock_request(req, routes, app_handle).await
                                    }
                                });
                                let _ = hyper::server::conn::http1::Builder::new()
                                    .serve_connection(io, service)
                                    .await;
                            });
                        }
                        Err(e) => {
                            tracing::error!("Mock server accept error: {}", e);
                        }
                    }
                }
                _ = &mut shutdown_rx => {
                    tracing::info!("Mock server shutting down");
                    break;
                }
            }
        }
    });

    *state.server.write().await = Some(MockServer {
        port: actual_port,
        shutdown: shutdown_tx,
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_mock_server(
    state: State<'_, MockState>,
) -> Result<(), crate::error::AppError> {
    let mut server_guard = state.server.write().await;
    if let Some(server) = server_guard.take() {
        let _ = server.shutdown.send(());
        Ok(())
    } else {
        Err(crate::error::AppError::proxy_not_running())
    }
}

#[tauri::command]
pub async fn get_mock_server_status(
    state: State<'_, MockState>,
) -> Result<MockServerStatus, crate::error::AppError> {
    let server = state.server.read().await;
    Ok(MockServerStatus {
        running: server.is_some(),
        port: server.as_ref().map(|s| s.port),
    })
}

#[tauri::command]
pub async fn add_mock_route(
    state: State<'_, MockState>,
    route: MockRoute,
) -> Result<(), crate::error::AppError> {
    state.routes.write().await.push(route);
    Ok(())
}

#[tauri::command]
pub async fn remove_mock_route(
    state: State<'_, MockState>,
    route_id: String,
) -> Result<(), crate::error::AppError> {
    let mut routes = state.routes.write().await;
    routes.retain(|r| r.id != route_id);
    Ok(())
}

#[tauri::command]
pub async fn update_mock_route(
    state: State<'_, MockState>,
    route: MockRoute,
) -> Result<(), crate::error::AppError> {
    let mut routes = state.routes.write().await;
    if let Some(existing) = routes.iter_mut().find(|r| r.id == route.id) {
        *existing = route;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_mock_routes(
    state: State<'_, MockState>,
) -> Result<Vec<MockRoute>, crate::error::AppError> {
    Ok(state.routes.read().await.clone())
}

#[tauri::command]
pub async fn clear_mock_routes(
    state: State<'_, MockState>,
) -> Result<(), crate::error::AppError> {
    state.routes.write().await.clear();
    Ok(())
}
