use crate::storage::sqlite::{SqliteStorage, HistoryEntry, CookieEntry};

fn setup_disk_storage() -> SqliteStorage {
    let dir = tempfile::TempDir::new().unwrap();
    SqliteStorage::open(dir.path()).unwrap()
}

#[test]
fn test_history_insert_and_query() {
    let storage = setup_disk_storage();
    let id = storage.insert_history("GET", "https://example.com", 200, 150).unwrap();
    assert!(id > 0);

    let entries = storage.query_history(100).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].method, "GET");
    assert_eq!(entries[0].url, "https://example.com");
}

#[test]
fn test_history_search() {
    let storage = setup_disk_storage();
    storage.insert_history("POST", "https://api.example.com/users", 201, 200).unwrap();
    storage.insert_history("GET", "https://other.com/data", 200, 50).unwrap();

    let results = storage.search_history("api.example", 100).unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].url.contains("api.example"));
}

#[test]
fn test_history_delete_and_clear() {
    let storage = setup_disk_storage();
    let id = storage.insert_history("GET", "https://test.com", 200, 100).unwrap();
    storage.delete_history(id).unwrap();
    assert!(storage.query_history(100).unwrap().is_empty());

    storage.insert_history("POST", "https://test.com", 200, 100).unwrap();
    storage.clear_history().unwrap();
    assert!(storage.query_history(100).unwrap().is_empty());
}

#[test]
fn test_cookie_insert_and_query() {
    let storage = setup_disk_storage();
    let cookie = CookieEntry {
        domain: "example.com".into(),
        name: "session".into(),
        value: "abc123".into(),
        path: "/".into(),
        expires: None,
        secure: false,
        http_only: true,
        same_site: "Lax".into(),
    };
    let id = storage.insert_cookie(&cookie).unwrap();
    assert!(id > 0);

    let cookies = storage.query_cookies(Some("example.com")).unwrap();
    assert_eq!(cookies.len(), 1);
    assert_eq!(cookies[0].name, "session");
    assert_eq!(cookies[0].value, "abc123");
}

#[test]
fn test_cookie_delete_and_clear() {
    let storage = setup_disk_storage();
    let cookie = CookieEntry {
        domain: "example.com".into(), name: "token".into(), value: "xyz".into(),
        path: "/".into(), expires: None, secure: true, http_only: true, same_site: "Strict".into(),
    };
    let id = storage.insert_cookie(&cookie).unwrap();
    storage.delete_cookie(id).unwrap();
    assert!(storage.query_cookies(Some("example.com")).unwrap().is_empty());

    storage.insert_cookie(&cookie).unwrap();
    storage.clear_cookies().unwrap();
    assert!(storage.query_cookies(Some("example.com")).unwrap().is_empty());
}

#[test]
fn test_get_set_setting() {
    let storage = setup_disk_storage();
    assert!(storage.get_setting("theme").unwrap().is_none());

    storage.set_setting("theme", "dark").unwrap();
    assert_eq!(storage.get_setting("theme").unwrap(), Some("dark".into()));

    storage.set_setting("theme", "light").unwrap();
    assert_eq!(storage.get_setting("theme").unwrap(), Some("light".into()));
}