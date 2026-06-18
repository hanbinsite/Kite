use super::history::*;
use crate::storage::HistoryEntry;

#[test]
fn insert_history_request_serde_roundtrip() {
    let json = r#"{
        "method": "GET",
        "url": "https://api.example.com/users",
        "status": 200,
        "duration": 150
    }"#;

    let req: InsertHistoryRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.method, "GET");
    assert_eq!(req.url, "https://api.example.com/users");
    assert_eq!(req.status, 200);
    assert_eq!(req.duration, 150);

    let serialized = serde_json::to_string(&req).unwrap();
    let parsed: InsertHistoryRequest = serde_json::from_str(&serialized).unwrap();
    assert_eq!(parsed.method, req.method);
    assert_eq!(parsed.url, req.url);
    assert_eq!(parsed.status, req.status);
    assert_eq!(parsed.duration, req.duration);
}

#[test]
fn insert_history_request_deser_post() {
    let json = r#"{
        "method": "POST",
        "url": "https://api.example.com/orders",
        "status": 201,
        "duration": 350
    }"#;

    let req: InsertHistoryRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.method, "POST");
    assert_eq!(req.status, 201);
    assert_eq!(req.duration, 350);
}

#[test]
fn insert_history_request_deser_error_status() {
    let json = r#"{
        "method": "DELETE",
        "url": "https://api.example.com/items/1",
        "status": 500,
        "duration": 2000
    }"#;

    let req: InsertHistoryRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.method, "DELETE");
    assert_eq!(req.status, 500);
    assert_eq!(req.duration, 2000);
}

#[test]
fn history_entry_serde_roundtrip() {
    let entry = HistoryEntry {
        id: 42,
        method: "PATCH".into(),
        url: "https://api.example.com/data".into(),
        status: 200,
        duration: 120,
        created_at: "2025-06-18T10:30:00Z".into(),
    };

    let json = serde_json::to_string(&entry).unwrap();
    let parsed: HistoryEntry = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.id, 42);
    assert_eq!(parsed.method, "PATCH");
    assert_eq!(parsed.url, "https://api.example.com/data");
    assert_eq!(parsed.status, 200);
    assert_eq!(parsed.duration, 120);
    assert_eq!(parsed.created_at, "2025-06-18T10:30:00Z");
}

#[test]
fn history_entry_deser_minimal_fields() {
    let json = r#"{
        "id": 1,
        "method": "HEAD",
        "url": "https://example.com",
        "status": 301,
        "duration": 45,
        "created_at": "2025-01-01T00:00:00Z"
    }"#;

    let entry: HistoryEntry = serde_json::from_str(json).unwrap();
    assert_eq!(entry.id, 1);
    assert_eq!(entry.method, "HEAD");
    assert_eq!(entry.url, "https://example.com");
    assert_eq!(entry.status, 301);
    assert_eq!(entry.duration, 45);
    assert_eq!(entry.created_at, "2025-01-01T00:00:00Z");
}

#[test]
fn history_entry_vec_serde() {
    let entries = vec![
        HistoryEntry {
            id: 1,
            method: "GET".into(),
            url: "https://a.com".into(),
            status: 200,
            duration: 100,
            created_at: "2025-06-18T10:00:00Z".into(),
        },
        HistoryEntry {
            id: 2,
            method: "POST".into(),
            url: "https://b.com".into(),
            status: 201,
            duration: 200,
            created_at: "2025-06-18T10:01:00Z".into(),
        },
    ];

    let json = serde_json::to_string(&entries).unwrap();
    let parsed: Vec<HistoryEntry> = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0].id, 1);
    assert_eq!(parsed[1].id, 2);
}