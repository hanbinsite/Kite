use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub detail: String,
}

impl AppError {
    // Network errors
    pub fn net_connect_failed(detail: String) -> Self { Self { code: "NET_CONNECT_FAILED".into(), detail } }
    pub fn safe_net_error(context: &str, raw: impl std::fmt::Display) -> Self {
        tracing::warn!("{}: {}", context, raw);
        Self { code: "NET_CONNECT_FAILED".into(), detail: format!("{} failed", context) }
    }
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
    pub fn vault_secret_not_found(name: &str) -> Self { Self { code: "VAULT_SECRET_NOT_FOUND".into(), detail: format!("Secret not found: {}", name) } }

    // Auth errors
    pub fn auth_invalid_credentials() -> Self { Self { code: "AUTH_INVALID_CREDENTIALS".into(), detail: "Invalid credentials".into() } }
    pub fn auth_token_expired() -> Self { Self { code: "AUTH_TOKEN_EXPIRED".into(), detail: "Token has expired".into() } }
    pub fn auth_oauth_state_mismatch() -> Self { Self { code: "AUTH_OAUTH_STATE_MISMATCH".into(), detail: "OAuth state mismatch".into() } }
    pub fn auth_oauth_no_code() -> Self { Self { code: "AUTH_OAUTH_NO_CODE".into(), detail: "No authorization code received".into() } }
    pub fn auth_oauth_exchange_failed(detail: &str) -> Self { Self { code: "AUTH_OAUTH_EXCHANGE_FAILED".into(), detail: detail.into() } }

    // Import errors
    pub fn import_invalid_format(detail: &str) -> Self { Self { code: "IMPORT_INVALID_FORMAT".into(), detail: detail.into() } }
    pub fn import_file_not_found(path: &str) -> Self { Self { code: "IMPORT_FILE_NOT_FOUND".into(), detail: format!("File not found: {}", path) } }
    pub fn import_parse_error(detail: &str) -> Self { Self { code: "IMPORT_PARSE_ERROR".into(), detail: detail.into() } }
    pub fn import_unsupported_format(fmt: &str) -> Self { Self { code: "IMPORT_UNSUPPORTED_FORMAT".into(), detail: format!("Unsupported format: {}", fmt) } }

    // Export errors
    pub fn export_failed(detail: &str) -> Self { Self { code: "EXPORT_FAILED".into(), detail: detail.into() } }

    // Validation errors
    pub fn validation_failed(detail: String) -> Self { Self { code: "VALIDATION_FAILED".into(), detail } }
    pub fn invalid_input(detail: String) -> Self { Self { code: "INVALID_INPUT".into(), detail } }

    // Mock server errors (was proxy)
    pub fn mock_start_failed(detail: String) -> Self { Self { code: "MOCK_START_FAILED".into(), detail } }
    pub fn mock_not_running() -> Self { Self { code: "MOCK_NOT_RUNNING".into(), detail: "Mock server is not running".into() } }

    // Missing STORAGE errors
    pub fn storage_delete_failed(detail: String) -> Self { Self { code: "STORAGE_DELETE_FAILED".into(), detail } }
    pub fn storage_db_error(detail: String) -> Self { Self { code: "STORAGE_DB_ERROR".into(), detail } }
    pub fn storage_migration_failed(detail: String) -> Self { Self { code: "STORAGE_MIGRATION_FAILED".into(), detail } }

    // Missing NET errors
    pub fn net_connection_refused() -> Self { Self { code: "NET_CONNECTION_REFUSED".into(), detail: "Connection refused".into() } }
    pub fn net_send_failed(detail: String) -> Self { Self { code: "NET_SEND_FAILED".into(), detail } }

    // General
    pub fn not_found(detail: String) -> Self { Self { code: "NOT_FOUND".into(), detail } }
    pub fn not_implemented(detail: String) -> Self { Self { code: "NOT_IMPLEMENTED".into(), detail } }
    pub fn internal(detail: String) -> Self { Self { code: "INTERNAL".into(), detail } }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            Self::net_timeout(30000)
        } else if e.is_connect() {
            let url = e.url().map(|u| u.to_string()).unwrap_or_default();
            Self::net_connect_failed(format!("Failed to connect to {}", url))
        } else if e.is_redirect() {
            Self::net_redirect_limit(10)
        } else {
            let kind = if e.is_body() { "response body error" }
                else if e.is_decode() { "response decode error" }
                else { "request error" };
            Self::internal(kind.to_string())
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        if e.kind() == std::io::ErrorKind::NotFound {
            Self::storage_not_found(format!("File not found: {}", e))
        } else {
            Self::storage_read_failed(format!("I/O error: {}", e.kind()))
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

    #[test]
    fn test_from_reqwest_error_types() {
        let app_err = AppError::net_timeout(5000);
        assert_eq!(app_err.code, "NET_TIMEOUT");

        let app_err = AppError::net_connect_failed("refused".into());
        assert_eq!(app_err.code, "NET_CONNECT_FAILED");

        let app_err = AppError::net_redirect_limit(10);
        assert_eq!(app_err.code, "NET_REDIRECT_LIMIT");
    }

    #[test]
    fn test_safe_net_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "refused");
        let app_err = AppError::safe_net_error("HTTP request", io_err);
        assert_eq!(app_err.code, "NET_CONNECT_FAILED");
        assert!(app_err.detail.contains("HTTP request failed"));
    }

    #[test]
    fn test_safe_net_error_masking() {
        let raw = "https://secret.example.com?token=abc123";
        let app_err = AppError::safe_net_error("HTTP request", raw);
        assert_eq!(app_err.code, "NET_CONNECT_FAILED");
        assert!(!app_err.detail.contains("abc123"));
        assert!(!app_err.detail.contains("token"));
    }

    #[test]
    fn test_net_invalid_url() {
        let app_err = AppError::net_invalid_url("bad url".into());
        assert_eq!(app_err.code, "NET_INVALID_URL");
    }

    #[test]
    fn test_vault_keyring_failed() {
        let app_err = AppError::vault_keyring_failed("keyring error".into());
        assert_eq!(app_err.code, "VAULT_KEYRING_FAILED");
    }

    #[test]
    fn test_mock_errors() {
        let app_err = AppError::mock_start_failed("port in use".into());
        assert_eq!(app_err.code, "MOCK_START_FAILED");

        let app_err = AppError::mock_not_running();
        assert_eq!(app_err.code, "MOCK_NOT_RUNNING");
    }

    #[test]
    fn test_invalid_input() {
        let app_err = AppError::invalid_input("field required".into());
        assert_eq!(app_err.code, "INVALID_INPUT");
    }

    #[test]
    fn test_auth_errors() {
        let e = AppError::auth_invalid_credentials();
        assert_eq!(e.code, "AUTH_INVALID_CREDENTIALS");
        let e = AppError::auth_token_expired();
        assert_eq!(e.code, "AUTH_TOKEN_EXPIRED");
        let e = AppError::auth_oauth_state_mismatch();
        assert_eq!(e.code, "AUTH_OAUTH_STATE_MISMATCH");
        let e = AppError::auth_oauth_no_code();
        assert_eq!(e.code, "AUTH_OAUTH_NO_CODE");
        let e = AppError::auth_oauth_exchange_failed("bad code");
        assert_eq!(e.code, "AUTH_OAUTH_EXCHANGE_FAILED");
        assert!(e.detail.contains("bad code"));
    }

    #[test]
    fn test_import_errors() {
        let e = AppError::import_invalid_format("not json");
        assert_eq!(e.code, "IMPORT_INVALID_FORMAT");
        let e = AppError::import_file_not_found("/tmp/x.json");
        assert_eq!(e.code, "IMPORT_FILE_NOT_FOUND");
        assert!(e.detail.contains("/tmp/x.json"));
        let e = AppError::import_parse_error("bad token");
        assert_eq!(e.code, "IMPORT_PARSE_ERROR");
        let e = AppError::import_unsupported_format("yaml");
        assert_eq!(e.code, "IMPORT_UNSUPPORTED_FORMAT");
        assert!(e.detail.contains("yaml"));
    }

    #[test]
    fn test_export_failed() {
        let e = AppError::export_failed("disk full");
        assert_eq!(e.code, "EXPORT_FAILED");
        assert!(e.detail.contains("disk full"));
    }

    #[test]
    fn test_vault_secret_not_found() {
        let e = AppError::vault_secret_not_found("api_key");
        assert_eq!(e.code, "VAULT_SECRET_NOT_FOUND");
        assert!(e.detail.contains("api_key"));
    }

    #[test]
    fn test_storage_extended_errors() {
        let e = AppError::storage_delete_failed("locked".into());
        assert_eq!(e.code, "STORAGE_DELETE_FAILED");
        let e = AppError::storage_db_error("corrupt".into());
        assert_eq!(e.code, "STORAGE_DB_ERROR");
        let e = AppError::storage_migration_failed("v1->v2".into());
        assert_eq!(e.code, "STORAGE_MIGRATION_FAILED");
    }

    #[test]
    fn test_net_extended_errors() {
        let e = AppError::net_connection_refused();
        assert_eq!(e.code, "NET_CONNECTION_REFUSED");
        let e = AppError::net_send_failed("write closed".into());
        assert_eq!(e.code, "NET_SEND_FAILED");
    }
}
