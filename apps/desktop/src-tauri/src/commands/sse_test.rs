use crate::commands::sse::SseEvent;

#[test]
fn test_sse_event_serde() {
    let event = SseEvent {
        connection_id: "conn-1".into(),
        event: "message".into(),
        data: r#"{"type":"update","payload":{"id":1}}"#.into(),
        id: Some("123".into()),
        timestamp: 1700000000000,
    };
    let json = serde_json::to_string(&event).unwrap();
    assert!(json.contains("connectionId"));
    assert!(json.contains("message"));
    let parsed: SseEvent = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.connection_id, "conn-1");
    assert_eq!(parsed.event, "message");
    assert_eq!(parsed.id.unwrap(), "123");
}

#[test]
fn test_sse_event_without_id() {
    let event = SseEvent {
        connection_id: "conn-2".into(),
        event: "ping".into(),
        data: "".into(),
        id: None,
        timestamp: 1,
    };
    let json = serde_json::to_string(&event).unwrap();
    // id: null is serialized (no skip_serializing_if), but it deserializes correctly
    let parsed: SseEvent = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, None);
}

#[test]
fn test_sse_event_empty_data() {
    let event = SseEvent {
        connection_id: "c".into(),
        event: "".into(),
        data: "".into(),
        id: None,
        timestamp: 0,
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: SseEvent = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.event, "");
    assert_eq!(parsed.data, "");
}