use crate::commands::websocket::WsMessage;

#[test]
fn test_ws_message_serde() {
    let msg = WsMessage {
        connection_id: "conn-1".into(),
        data: r#"{"type":"message","text":"hello"}"#.into(),
        direction: "incoming".into(),
        timestamp: 1700000000000,
        is_binary: false,
        byte_len: 0,
        binary: None,
    };
    let json = serde_json::to_string(&msg).unwrap();
    assert!(json.contains("connectionId"));
    assert!(json.contains("incoming"));
    let parsed: WsMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.connection_id, "conn-1");
    assert_eq!(parsed.direction, "incoming");
    assert_eq!(parsed.data, r#"{"type":"message","text":"hello"}"#);
}

#[test]
fn test_ws_message_outgoing() {
    let msg = WsMessage {
        connection_id: "c2".into(),
        data: "ping".into(),
        direction: "outgoing".into(),
        timestamp: 42,
        is_binary: false,
        byte_len: 0,
        binary: None,
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: WsMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.direction, "outgoing");
    assert_eq!(parsed.timestamp, 42);
}