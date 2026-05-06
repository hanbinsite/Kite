use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use futures_util::StreamExt;

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

    let client = Client::new();
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
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("SSE connect failed: {}", e)))?;

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
    let _ = app.emit("sse-event", &sse_event);

    tokio::spawn(async move {
        let mut stream = response.bytes_stream();
        let mut current_data = String::new();
        let mut current_event = String::from("message");

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
                    let _ = app_handle.emit("sse-event", &sse_event);
                    break;
                }
                chunk = stream.next() => {
                    match chunk {
                        Some(Ok(bytes)) => {
                            let text = String::from_utf8_lossy(&bytes);
                            for line in text.lines() {
                                if let Some(stripped) = line.strip_prefix("data:") {
                                    current_data.push_str(stripped);
                                    current_data.push('\n');
                                } else if let Some(stripped) = line.strip_prefix("event:") {
                                    current_event = stripped.trim().to_string();
                                } else if line.starts_with("id:") {
                                    // track last event id if needed
                                } else if line.is_empty() && !current_data.is_empty() {
                                    let sse_event = SseEvent {
                                        connection_id: conn_id.clone(),
                                        event: current_event.clone(),
                                        data: current_data.trim_end().to_string(),
                                        id: None,
                                        timestamp: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64,
                                    };
                                    let _ = app_handle.emit("sse-event", &sse_event);
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
                            let _ = app_handle.emit("sse-event", &sse_event);
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
                            let _ = app_handle.emit("sse-event", &sse_event);
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
