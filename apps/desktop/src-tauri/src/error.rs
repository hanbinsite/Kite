use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub detail: String,
}

impl AppError {
    pub fn net_connect_failed(detail: String) -> Self { Self { code: "NET_CONNECT_FAILED".into(), detail } }
    pub fn net_timeout(ms: u64) -> Self { Self { code: "NET_TIMEOUT".into(), detail: format!("Request timeout after {}ms", ms) } }
    pub fn net_cancelled() -> Self { Self { code: "NET_REQUEST_CANCELLED".into(), detail: "Request was cancelled".into() } }
    pub fn net_dns_error(detail: String) -> Self { Self { code: "NET_DNS_ERROR".into(), detail } }
    pub fn net_tls_error(detail: String) -> Self { Self { code: "NET_TLS_ERROR".into(), detail } }
    pub fn storage_read_failed(detail: String) -> Self { Self { code: "STORAGE_READ_FAILED".into(), detail } }
    pub fn storage_write_failed(detail: String) -> Self { Self { code: "STORAGE_WRITE_FAILED".into(), detail } }
    pub fn internal(detail: String) -> Self { Self { code: "INTERNAL".into(), detail } }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() { Self::net_timeout(0) }
        else if e.is_connect() { Self::net_connect_failed(e.to_string()) }
        else { Self::internal(e.to_string()) }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self { Self::storage_read_failed(e.to_string()) }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self { Self::internal(e.to_string()) }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.detail)
    }
}