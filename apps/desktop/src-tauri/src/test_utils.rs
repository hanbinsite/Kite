use std::path::PathBuf;
use tempfile::TempDir;

use crate::storage::Storage;

pub fn temp_storage() -> (TempDir, Storage) {
    let dir = TempDir::new().unwrap();
    let storage = Storage::new(dir.path()).unwrap();
    (dir, storage)
}

pub fn temp_dir() -> (TempDir, PathBuf) {
    let dir = TempDir::new().unwrap();
    let path = dir.path().to_path_buf();
    (dir, path)
}

use crate::commands::http::HttpRequestConfig;

pub fn sample_http_config() -> HttpRequestConfig {
    use crate::commands::http::{Header, RequestSettings};
    HttpRequestConfig {
        id: "test-1".into(),
        method: "GET".into(),
        url: "https://api.example.com/users".into(),
        headers: vec![Header {
            key: "Content-Type".into(),
            value: "application/json".into(),
            disabled: false,
        }],
        params: vec![],
        body: None,
        auth: None,
        settings: RequestSettings::default(),
    }
}