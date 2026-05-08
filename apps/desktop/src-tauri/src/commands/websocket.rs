use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

pub struct WsState {
    pub connections: Arc<RwLock<HashMap<String, WsConnection>>>,
}

impl Default for WsState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct WsConnection {
    pub sender: tokio::sync::mpsc::UnboundedSender<String>,
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
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Invalid WS request: {}", e)))?;

    let (ws_stream, _response) = connect_async(request)
        .await
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("WS connect failed: {}", e)))?;

    let (mut write, mut read) = ws_stream.split();

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if msg == "__CLOSE__" {
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            if write.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let conn_id_read = connection_id.clone();
    let app_handle_read = app.clone();

    tokio::spawn(async move {
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
                    };
                    let _ = app_handle_read.emit("ws-message", &ws_msg);
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
                    };
                    let _ = app_handle_read.emit("ws-message", &ws_msg);
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
                    };
                    let _ = app_handle_read.emit("ws-message", &ws_msg);
                    break;
                }
            }
        }
    });

    state.connections.write().await.insert(connection_id.clone(), WsConnection { sender: tx });

    let ws_msg = WsMessage {
        connection_id: connection_id.clone(),
        data: "Connected".to_string(),
        direction: "system".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    };
    let _ = app.emit("ws-message", &ws_msg);

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
        .send(message)
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Send failed: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn ws_close(
    state: State<'_, WsState>,
    connection_id: String,
) -> Result<(), crate::error::AppError> {
    let mut connections = state.connections.write().await;
    if let Some(ws_conn) = connections.remove(&connection_id) {
        let _ = ws_conn.sender.send("__CLOSE__".to_string());
        Ok(())
    } else {
        Err(crate::error::AppError::net_connect_failed("Connection not found".to_string()))
    }
}
