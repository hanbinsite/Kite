use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

const WS_CONNECT_TIMEOUT_SECS: u64 = 10;

pub struct WsState {
    pub connections: Arc<RwLock<HashMap<String, WsConnection>>>,
}

impl Default for WsState {
    fn default() -> Self {
        Self::new()
    }
}

pub enum WsOutgoing {
    Text(String),
    Binary(Vec<u8>),
    Close,
}

pub struct WsConnection {
    pub sender: tokio::sync::mpsc::Sender<WsOutgoing>,
    pub write_handle: tokio::task::JoinHandle<()>,
    pub read_handle: tokio::task::JoinHandle<()>,
}

impl WsState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsMessage {
    pub connection_id: String,
    pub data: String,
    pub direction: String,
    pub timestamp: u64,
    pub is_binary: bool,
    pub byte_len: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary: Option<Vec<u8>>,
}

#[tauri::command]
pub async fn ws_connect(
    app: tauri::AppHandle,
    state: State<'_, WsState>,
    connection_id: String,
    url: String,
    headers: Option<Vec<(String, String)>>,
) -> Result<(), crate::error::AppError> {
    let mut request = tokio_tungstenite::tungstenite::http::Request::builder()
        .uri(&url)
        .method("GET")
        .header("Upgrade", "websocket")
        .header("Connection", "Upgrade")
        .header("Sec-WebSocket-Version", "13")
        .header("Sec-WebSocket-Key", tokio_tungstenite::tungstenite::handshake::client::generate_key());

    if let Some(hdrs) = headers {
        for (key, value) in hdrs {
            request = request.header(&key, &value);
        }
    }

    let request = request
        .body(())
        .map_err(|e| crate::error::AppError::safe_net_error("Invalid WS request", e))?;

    let (ws_stream, _response) = tokio::time::timeout(
        Duration::from_secs(WS_CONNECT_TIMEOUT_SECS),
        connect_async(request),
    ).await
        .map_err(|_| crate::error::AppError::net_timeout(WS_CONNECT_TIMEOUT_SECS * 1000))?
        .map_err(|e| crate::error::AppError::safe_net_error("WS connect", e))?;

    let (mut write, mut read) = ws_stream.split();

    let (tx, mut rx) = tokio::sync::mpsc::channel::<WsOutgoing>(256);

    let write_handle = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            match msg {
                WsOutgoing::Close => {
                    let _ = write.send(Message::Close(None)).await;
                    break;
                }
                WsOutgoing::Text(text) => {
                    if write.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
                WsOutgoing::Binary(bytes) => {
                    if write.send(Message::Binary(bytes)).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let conn_id_read = connection_id.clone();
    let app_handle_read = app.clone();

    let read_handle = tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let ws_msg = WsMessage {
                        connection_id: conn_id_read.clone(),
                        data: text.to_string(),
                        direction: "received".to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                        is_binary: false,
                        byte_len: 0,
                        binary: None,
                    };
                    if let Err(e) = app_handle_read.emit("ws-message", &ws_msg) {
                        tracing::warn!("Failed to emit ws-message: {}", e);
                    }
                }
                Ok(Message::Binary(bytes)) => {
                    let len = bytes.len() as u64;
                    let ws_msg = WsMessage {
                        connection_id: conn_id_read.clone(),
                        data: format!("(binary, {} bytes)", len),
                        direction: "received".to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                        is_binary: true,
                        byte_len: len,
                        binary: Some(bytes.to_vec()),
                    };
                    if let Err(e) = app_handle_read.emit("ws-message", &ws_msg) {
                        tracing::warn!("Failed to emit ws-message: {}", e);
                    }
                }
                Ok(Message::Close(_)) => {
                    let ws_msg = WsMessage {
                        connection_id: conn_id_read.clone(),
                        data: "Connection closed by server".to_string(),
                        direction: "system".to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                        is_binary: false,
                        byte_len: 0,
                        binary: None,
                    };
                    if let Err(e) = app_handle_read.emit("ws-message", &ws_msg) {
                        tracing::warn!("Failed to emit ws-message: {}", e);
                    }
                    break;
                }
                Ok(_) => {}
                Err(e) => {
                    let ws_msg = WsMessage {
                        connection_id: conn_id_read.clone(),
                        data: format!("Error: {}", e),
                        direction: "error".to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                        is_binary: false,
                        byte_len: 0,
                        binary: None,
                    };
                    if let Err(e) = app_handle_read.emit("ws-message", &ws_msg) {
                        tracing::warn!("Failed to emit ws-message: {}", e);
                    }
                    break;
                }
            }
        }
    });

    state.connections.write().await.insert(connection_id.clone(), WsConnection {
        sender: tx,
        write_handle,
        read_handle,
    });

    let ws_msg = WsMessage {
        connection_id: connection_id.clone(),
        data: "Connected".to_string(),
        direction: "system".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        is_binary: false,
        byte_len: 0,
        binary: None,
    };
    if let Err(e) = app.emit("ws-message", &ws_msg) {
        tracing::warn!("Failed to emit ws-message: {}", e);
    }

    Ok(())
}

#[tauri::command]
pub async fn ws_send(
    state: State<'_, WsState>,
    connection_id: String,
    message: String,
) -> Result<(), crate::error::AppError> {
    let connections = state.connections.read().await;
    let conn = connections
        .get(&connection_id)
        .ok_or_else(|| crate::error::AppError::net_connect_failed("Connection not found".to_string()))?;
    conn.sender
        .send(WsOutgoing::Text(message))
        .await
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Send failed: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn ws_send_binary(
    state: State<'_, WsState>,
    connection_id: String,
    data: Vec<u8>,
) -> Result<(), crate::error::AppError> {
    let connections = state.connections.read().await;
    let conn = connections
        .get(&connection_id)
        .ok_or_else(|| crate::error::AppError::net_connect_failed("Connection not found".to_string()))?;
    conn.sender
        .send(WsOutgoing::Binary(data))
        .await
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Binary send failed: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn ws_close(
    state: State<'_, WsState>,
    connection_id: String,
) -> Result<(), crate::error::AppError> {
    let mut connections = state.connections.write().await;
    if let Some(ws_conn) = connections.remove(&connection_id) {
        if ws_conn.sender.try_send(WsOutgoing::Close).is_err() {
        tracing::warn!("WS close signal dropped: channel full or receiver gone for {}", connection_id);
    }
        let _ = tokio::time::timeout(
            Duration::from_secs(3),
            async {
                let _ = tokio::join!(ws_conn.read_handle, ws_conn.write_handle);
            },
        ).await;
        Ok(())
    } else {
        Err(crate::error::AppError::net_connect_failed("Connection not found".to_string()))
    }
}
