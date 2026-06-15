use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use rumqttc::{MqttOptions, Client, Event, Packet, QoS, Connection};
use serde::{Deserialize, Serialize};

pub struct MqttState {
    pub connections: Arc<RwLock<HashMap<String, MqttConnection>>>,
}

impl Default for MqttState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct MqttConnection {
    pub client: Client,
}

impl MqttState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

fn qos_from_u8(qos: u8) -> QoS {
    match qos {
        1 => QoS::AtLeastOnce,
        2 => QoS::ExactlyOnce,
        _ => QoS::AtMostOnce,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttMessage {
    pub connection_id: String,
    pub topic: String,
    pub payload: String,
    pub qos: u8,
    pub direction: String,
    pub timestamp: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttConnectConfig {
    pub broker: String,
    pub port: u16,
    pub client_id: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub clean_session: bool,
    pub keep_alive: u16,
}

#[tauri::command]
pub async fn mqtt_connect(
    app: tauri::AppHandle,
    state: State<'_, MqttState>,
    connection_id: String,
    config: MqttConnectConfig,
) -> Result<(), crate::error::AppError> {
    let mut mqttopts = MqttOptions::new(&config.client_id, &config.broker, config.port);
    mqttopts.set_clean_session(config.clean_session);
    mqttopts.set_keep_alive(std::time::Duration::from_secs(config.keep_alive as u64));

    if let (Some(user), Some(pass)) = (config.username, config.password) {
        mqttopts.set_credentials(&user, &pass);
    }

    let (client, connection) = Client::new(mqttopts, 100);

    state.connections.write().await.insert(connection_id.clone(), MqttConnection { client });

    let conn_id = connection_id.clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        poll_mqtt_events(connection, conn_id, app_handle).await;
    });

    let msg = MqttMessage {
        connection_id: connection_id.clone(),
        topic: String::new(),
        payload: format!("Connected to {}:{}", config.broker, config.port),
        qos: 0,
        direction: "system".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    };
    if let Err(e) = app.emit("mqtt-message", &msg) {
        tracing::warn!("Failed to emit mqtt-message: {}", e);
    }

    Ok(())
}

async fn poll_mqtt_events(mut connection: Connection, conn_id: String, app_handle: tauri::AppHandle) {
    loop {
        match connection.eventloop.poll().await {
            Ok(Event::Incoming(Packet::Publish(publish))) => {
                let payload_str = String::from_utf8_lossy(&publish.payload).to_string();
                let msg = MqttMessage {
                    connection_id: conn_id.clone(),
                    topic: publish.topic.clone(),
                    payload: payload_str,
                    qos: publish.qos as u8,
                    direction: "received".to_string(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                };
                if let Err(e) = app_handle.emit("mqtt-message", &msg) {
                    tracing::warn!("Failed to emit mqtt-message: {}", e);
                }
            }
            Ok(Event::Incoming(Packet::Disconnect)) => {
                let msg = MqttMessage {
                    connection_id: conn_id.clone(),
                    topic: String::new(),
                    payload: "Disconnected by server".to_string(),
                    qos: 0,
                    direction: "system".to_string(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                };
                if let Err(e) = app_handle.emit("mqtt-message", &msg) {
                    tracing::warn!("Failed to emit mqtt-message: {}", e);
                }
                break;
            }
            Ok(_) => {}
            Err(e) => {
                let msg = MqttMessage {
                    connection_id: conn_id.clone(),
                    topic: String::new(),
                    payload: format!("Error: {}", e),
                    qos: 0,
                    direction: "error".to_string(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                };
                if let Err(e) = app_handle.emit("mqtt-message", &msg) {
                    tracing::warn!("Failed to emit mqtt-message: {}", e);
                }
                break;
            }
        }
    }
}

#[tauri::command]
pub async fn mqtt_subscribe(
    state: State<'_, MqttState>,
    connection_id: String,
    topic: String,
    qos: u8,
) -> Result<(), crate::error::AppError> {
    let connections = state.connections.read().await;
    let conn = connections
        .get(&connection_id)
        .ok_or_else(|| crate::error::AppError::net_connect_failed("MQTT connection not found".to_string()))?;
    conn.client
        .subscribe(&topic, qos_from_u8(qos))
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Subscribe failed: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn mqtt_publish(
    state: State<'_, MqttState>,
    connection_id: String,
    topic: String,
    payload: String,
    qos: u8,
) -> Result<(), crate::error::AppError> {
    let connections = state.connections.read().await;
    let conn = connections
        .get(&connection_id)
        .ok_or_else(|| crate::error::AppError::net_connect_failed("MQTT connection not found".to_string()))?;
    conn.client
        .publish(&topic, qos_from_u8(qos), false, payload.as_bytes())
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Publish failed: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn mqtt_disconnect(
    state: State<'_, MqttState>,
    connection_id: String,
) -> Result<(), crate::error::AppError> {
    let mut connections = state.connections.write().await;
    if let Some(conn) = connections.remove(&connection_id) {
        let _ = conn.client.disconnect();
        Ok(())
    } else {
        Err(crate::error::AppError::net_connect_failed("MQTT connection not found".to_string()))
    }
}
