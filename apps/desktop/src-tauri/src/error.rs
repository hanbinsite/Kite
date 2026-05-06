use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub detail: String,
}

impl AppError {
    // Network errors
    pub fn net_connect_failed(detail: String) -> Self { Self { code: "NET_CONNECT_FAILED".into(), detail } }
    pub fn net_timeout(ms: u64) -> Self { Self { code: "NET_TIMEOUT".into(), detail: format!("Request timeout after {}ms", ms) } }
    pub fn net_cancelled() -> Self { Self { code: "NET_REQUEST_CANCELLED".into(), detail: "Request was cancelled".into() } }
    pub fn net_dns_error(detail: String) -> Self { Self { code: "NET_DNS_ERROR".into(), detail } }
    pub fn net_tls_error(detail: String) -> Self { Self { code: "NET_TLS_ERROR".into(), detail } }
    pub fn net_ssl_verification(detail: String) -> Self { Self { code: "NET_SSL_VERIFICATION".into(), detail } }
    pub fn net_redirect_limit(limit: u32) -> Self { Self { code: "NET_REDIRECT_LIMIT".into(), detail: format!("Exceeded maximum redirect limit ({})", limit) } }
    pub fn net_body_too_large(size: u64, limit: u64) -> Self { Self { code: "NET_BODY_TOO_LARGE".into(), detail: format!("Response body {} bytes exceeds limit {} bytes", size, limit) } }
    pub fn net_invalid_url(detail: String) -> Self { Self { code: "NET_INVALID_URL".into(), detail } }
    pub fn net_auth_failed(detail: String) -> Self { Self { code: "NET_AUTH_FAILED".into(), detail } }

    // Storage errors
    pub fn storage_read_failed(detail: String) -> Self { Self { code: "STORAGE_READ_FAILED".into(), detail } }
    pub fn storage_write_failed(detail: String) -> Self { Self { code: "STORAGE_WRITE_FAILED".into(), detail } }
    pub fn storage_not_found(detail: String) -> Self { Self { code: "STORAGE_NOT_FOUND".into(), detail } }
    pub fn storage_path_traversal(detail: String) -> Self { Self { code: "STORAGE_PATH_TRAVERSAL".into(), detail } }
    pub fn storage_parse_failed(detail: String) -> Self { Self { code: "STORAGE_PARSE_FAILED".into(), detail } }
    pub fn storage_file_too_large(size: u64, limit: u64) -> Self { Self { code: "STORAGE_FILE_TOO_LARGE".into(), detail: format!("File size {} exceeds limit of {} bytes", size, limit) } }

    // Script errors
    pub fn script_timeout(ms: u64) -> Self { Self { code: "SCRIPT_TIMEOUT".into(), detail: format!("Script execution timed out after {}ms", ms) } }
    pub fn script_error(detail: String) -> Self { Self { code: "SCRIPT_ERROR".into(), detail } }
    pub fn script_memory_limit() -> Self { Self { code: "SCRIPT_MEMORY_LIMIT".into(), detail: "Script exceeded memory limit".into() } }

    // Vault errors
    pub fn vault_locked() -> Self { Self { code: "VAULT_LOCKED".into(), detail: "Vault is locked".into() } }
    pub fn vault_unlock_failed(detail: String) -> Self { Self { code: "VAULT_UNLOCK_FAILED".into(), detail } }
    pub fn vault_encrypt_failed(detail: String) -> Self { Self { code: "VAULT_ENCRYPT_FAILED".into(), detail } }
    pub fn vault_decrypt_failed(detail: String) -> Self { Self { code: "VAULT_DECRYPT_FAILED".into(), detail } }
    pub fn vault_keyring_failed(detail: String) -> Self { Self { code: "VAULT_KEYRING_FAILED".into(), detail } }

    // Validation errors
    pub fn validation_failed(detail: String) -> Self { Self { code: "VALIDATION_FAILED".into(), detail } }
    pub fn invalid_input(detail: String) -> Self { Self { code: "INVALID_INPUT".into(), detail } }

    // Proxy errors
    pub fn proxy_start_failed(detail: String) -> Self { Self { code: "PROXY_START_FAILED".into(), detail } }
    pub fn proxy_not_running() -> Self { Self { code: "PROXY_NOT_RUNNING".into(), detail: "Proxy server is not running".into() } }

    // General
    pub fn not_found(detail: String) -> Self { Self { code: "NOT_FOUND".into(), detail } }
    pub fn not_implemented(detail: String) -> Self { Self { code: "NOT_IMPLEMENTED".into(), detail } }
    pub fn internal(detail: String) -> Self { Self { code: "INTERNAL".into(), detail } }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() { Self::net_timeout(0) }
        else if e.is_connect() { Self::net_connect_failed(e.to_string()) }
        else if e.is_redirect() { Self::net_redirect_limit(10) }
        else { Self::internal(e.to_string()) }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        if e.kind() == std::io::ErrorKind::NotFound {
            Self::storage_not_found(e.to_string())
        } else {
            Self::storage_read_failed(e.to_string())
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::storage_parse_failed(e.to_string())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.detail)
    }
}

#[cfg(test)]
mod tests {
    use super::AppError;

    #[test]
    fn test_error_codes() {
        let e = AppError::net_connect_failed("conn refused".into());
        assert_eq!(e.code, "NET_CONNECT_FAILED");
        assert_eq!(e.detail, "conn refused");

        let e = AppError::net_timeout(5000);
        assert_eq!(e.code, "NET_TIMEOUT");
        assert!(e.detail.contains("5000"));

        let e = AppError::net_cancelled();
        assert_eq!(e.code, "NET_REQUEST_CANCELLED");

        let e = AppError::storage_not_found("file missing".into());
        assert_eq!(e.code, "STORAGE_NOT_FOUND");

        let e = AppError::storage_parse_failed("bad json".into());
        assert_eq!(e.code, "STORAGE_PARSE_FAILED");

        let e = AppError::script_timeout(5000);
        assert_eq!(e.code, "SCRIPT_TIMEOUT");

        let e = AppError::vault_locked();
        assert_eq!(e.code, "VAULT_LOCKED");

        let e = AppError::validation_failed("bad input".into());
        assert_eq!(e.code, "VALIDATION_FAILED");

        let e = AppError::not_implemented("grpc".into());
        assert_eq!(e.code, "NOT_IMPLEMENTED");
    }

    #[test]
    fn test_display_format() {
        let e = AppError::internal("something broke".into());
        assert_eq!(format!("{}", e), "[INTERNAL] something broke");
    }

    #[test]
    fn test_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_err: AppError = io_err.into();
        assert_eq!(app_err.code, "STORAGE_NOT_FOUND");

        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let app_err: AppError = io_err.into();
        assert_eq!(app_err.code, "STORAGE_READ_FAILED");
    }

    #[test]
    fn test_from_serde_json_error() {
        let json_err = serde_json::from_str::<i32>("not a number").unwrap_err();
        let app_err: AppError = json_err.into();
        assert_eq!(app_err.code, "STORAGE_PARSE_FAILED");
    }
}
