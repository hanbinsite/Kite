use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use futures_util::StreamExt;
use std::sync::OnceLock;

fn sse_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(Client::new)
}

const MAX_SSE_LINE_LENGTH: usize = 1_048_576;
const MAX_SSE_EVENT_SIZE: usize = 10_485_760;

pub struct SseState {
    pub active: Arc<RwLock<HashMap<String, tokio_util::sync::CancellationToken>>>,
}

impl SseState {
    pub fn new() -> Self {
        Self {
            active: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for SseState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseEvent {
    pub connection_id: String,
    pub event: String,
    pub data: String,
    pub id: Option<String>,
    pub timestamp: u64,
}

#[tauri::command]
pub async fn sse_connect(
    app: tauri::AppHandle,
    state: State<'_, SseState>,
    connection_id: String,
    url: String,
    headers: Option<Vec<(String, String)>>,
) -> Result<(), crate::error::AppError> {
    let cancel_token = tokio_util::sync::CancellationToken::new();
    state.active.write().await.insert(connection_id.clone(), cancel_token.clone());

    let client = sse_client();
    let mut request_builder = client.get(&url);
    if let Some(hdrs) = headers {
        for (key, value) in hdrs {
            request_builder = request_builder.header(&key, &value);
        }
    }
    request_builder = request_builder.header("Accept", "text/event-stream");

    let response = request_builder
        .send()
        .await
        .map_err(|e| crate::error::AppError::safe_net_error("SSE connect", e))?;

    if !response.status().is_success() {
        return Err(crate::error::AppError::net_connect_failed(
            format!("SSE server returned {}", response.status()),
        ));
    }

    let conn_id = connection_id.clone();
    let app_handle = app.clone();
    let token = cancel_token.clone();

    let sse_event = SseEvent {
        connection_id: conn_id.clone(),
        event: "connected".to_string(),
        data: format!("Status: {}", response.status()),
        id: None,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    };
    if let Err(e) = app.emit("sse-event", &sse_event) {
        tracing::warn!("Failed to emit sse-event: {}", e);
    }

    tokio::spawn(async move {
        let mut stream = response.bytes_stream();
        let mut line_buf = String::new();
        let mut current_data = String::new();
        let mut current_event = String::from("message");
        let mut current_id: Option<String> = None;

        loop {
            tokio::select! {
                _ = token.cancelled() => {
                    let sse_event = SseEvent {
                        connection_id: conn_id.clone(),
                        event: "disconnected".to_string(),
                        data: "Cancelled by user".to_string(),
                        id: None,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                    };
                    if let Err(e) = app_handle.emit("sse-event", &sse_event) {
                            tracing::warn!("Failed to emit sse-event: {}", e);
                        }
                    break;
                }
                chunk = stream.next() => {
                    match chunk {
                        Some(Ok(bytes)) => {
                            line_buf.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(newline_pos) = line_buf.find('\n') {
                                let line = line_buf[..newline_pos].to_string();
                                line_buf = line_buf[newline_pos + 1..].to_string();

                                let trimmed = line.trim_end_matches('\r');

                                if trimmed.len() > MAX_SSE_LINE_LENGTH {
                                    let sse_event = SseEvent {
                                        connection_id: conn_id.clone(),
                                        event: "error".to_string(),
                                        data: format!("SSE line exceeds max length {}", MAX_SSE_LINE_LENGTH),
                                        id: None,
                                        timestamp: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64,
                                    };
                                    if let Err(e) = app_handle.emit("sse-event", &sse_event) {
                            tracing::warn!("Failed to emit sse-event: {}", e);
                        }
                                    current_data.clear();
                                    current_event = String::from("message");
                                    current_id = None;
                                    continue;
                                }

                                if let Some(stripped) = trimmed.strip_prefix("data:") {
                                    current_data.push_str(stripped);
                                    current_data.push('\n');

                                    if current_data.len() > MAX_SSE_EVENT_SIZE {
                                        let sse_event = SseEvent {
                                            connection_id: conn_id.clone(),
                                            event: "error".to_string(),
                                            data: format!("SSE event exceeds max size {}", MAX_SSE_EVENT_SIZE),
                                            id: None,
                                            timestamp: std::time::SystemTime::now()
                                                .duration_since(std::time::UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_millis() as u64,
                                        };
                                        if let Err(e) = app_handle.emit("sse-event", &sse_event) {
                            tracing::warn!("Failed to emit sse-event: {}", e);
                        }
                                        current_data.clear();
                                        current_event = String::from("message");
                                        current_id = None;
                                    }
                                } else if let Some(stripped) = trimmed.strip_prefix("event:") {
                                    current_event = stripped.trim().to_string();
                                } else if let Some(stripped) = trimmed.strip_prefix("id:") {
                                    current_id = Some(stripped.trim().to_string());
                                } else if trimmed.is_empty() && !current_data.is_empty() {
                                    let sse_event = SseEvent {
                                        connection_id: conn_id.clone(),
                                        event: current_event.clone(),
                                        data: current_data.trim_end().to_string(),
                                        id: current_id.take(),
                                        timestamp: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64,
                                    };
                                    if let Err(e) = app_handle.emit("sse-event", &sse_event) {
                            tracing::warn!("Failed to emit sse-event: {}", e);
                        }
                                    current_data.clear();
                                    current_event = String::from("message");
                                }
                            }
                        }
                        Some(Err(e)) => {
                            let sse_event = SseEvent {
                                connection_id: conn_id.clone(),
                                event: "error".to_string(),
                                data: format!("Stream error: {}", e),
                                id: None,
                                timestamp: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64,
                            };
                            if let Err(e) = app_handle.emit("sse-event", &sse_event) {
                            tracing::warn!("Failed to emit sse-event: {}", e);
                        }
                            break;
                        }
                        None => {
                            let sse_event = SseEvent {
                                connection_id: conn_id.clone(),
                                event: "disconnected".to_string(),
                                data: "Stream ended".to_string(),
                                id: None,
                                timestamp: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64,
                            };
                            if let Err(e) = app_handle.emit("sse-event", &sse_event) {
                            tracing::warn!("Failed to emit sse-event: {}", e);
                        }
                            break;
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn sse_disconnect(
    state: State<'_, SseState>,
    connection_id: String,
) -> Result<(), crate::error::AppError> {
    let mut active = state.active.write().await;
    if let Some(token) = active.remove(&connection_id) {
        token.cancel();
        Ok(())
    } else {
        Err(crate::error::AppError::net_connect_failed("SSE connection not found".to_string()))
    }
}
