use crate::commands::mqtt::{MqttMessage, MqttConnectConfig};

#[test]
fn test_mqtt_message_serde() {
    let msg = MqttMessage {
        connection_id: "conn-1".into(),
        topic: "sensors/temp".into(),
        payload: "{\"value\":25.5}".into(),
        qos: 1,
        direction: "received".into(),
        timestamp: 1700000000000,
    };
    let json = serde_json::to_string(&msg).unwrap();
    assert!(json.contains("connectionId"));
    assert!(json.contains("sensors/temp"));
    let parsed: MqttMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.connection_id, "conn-1");
    assert_eq!(parsed.topic, "sensors/temp");
    assert_eq!(parsed.direction, "received");
    assert_eq!(parsed.qos, 1);
}

#[test]
fn test_mqtt_message_system_direction() {
    let msg = MqttMessage {
        connection_id: "conn-2".into(),
        topic: String::new(),
        payload: "Connected to broker".into(),
        qos: 0,
        direction: "system".into(),
        timestamp: 1,
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: MqttMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.direction, "system");
    assert_eq!(parsed.payload, "Connected to broker");
}

#[test]
fn test_mqtt_message_error_direction() {
    let msg = MqttMessage {
        connection_id: "c3".into(),
        topic: String::new(),
        payload: "Connection refused".into(),
        qos: 0,
        direction: "error".into(),
        timestamp: 99,
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: MqttMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.direction, "error");
    assert_eq!(parsed.timestamp, 99);
}

#[test]
fn test_mqtt_connect_config_deser() {
    let json = r#"{
        "broker": "test.mosquitto.org",
        "port": 1883,
        "clientId": "client-1",
        "cleanSession": true,
        "keepAlive": 60
    }"#;
    let config: MqttConnectConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.broker, "test.mosquitto.org");
    assert_eq!(config.port, 1883);
    assert_eq!(config.client_id, "client-1");
    assert!(config.clean_session);
    assert_eq!(config.keep_alive, 60);
    assert!(config.username.is_none());
    assert!(config.password.is_none());
}

#[test]
fn test_mqtt_connect_config_with_auth() {
    let json = r#"{
        "broker": "broker.example.com",
        "port": 8883,
        "clientId": "secure-client",
        "username": "admin",
        "password": "secret",
        "cleanSession": false,
        "keepAlive": 120
    }"#;
    let config: MqttConnectConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.username.as_deref(), Some("admin"));
    assert_eq!(config.password.as_deref(), Some("secret"));
    assert!(!config.clean_session);
}