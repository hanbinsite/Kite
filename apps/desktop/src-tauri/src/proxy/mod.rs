// MITM HTTP proxy server — stub, full hudsucker-based implementation deferred.
// The Settings ProxySection manages a client-side outbound proxy (proxyUrl),
// which is a separate concept from this server-side interception proxy.
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub requires_auth: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub intercepted_count: u64,
}

static PROXY_RUNNING: AtomicBool = AtomicBool::new(false);
static INTERCEPT_COUNT: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub async fn start_proxy(config: ProxyConfig) -> Result<ProxyStatus, AppError> {
    if !config.enabled {
        return Err(AppError::internal("Proxy is disabled".into()));
    }
    PROXY_RUNNING.store(true, Ordering::SeqCst);
    INTERCEPT_COUNT.store(0, Ordering::SeqCst);
    Ok(ProxyStatus {
        running: true,
        port: Some(config.port),
        intercepted_count: 0,
    })
}

#[tauri::command]
pub async fn stop_proxy() -> Result<ProxyStatus, AppError> {
    PROXY_RUNNING.store(false, Ordering::SeqCst);
    Ok(ProxyStatus {
        running: false,
        port: None,
        intercepted_count: INTERCEPT_COUNT.load(Ordering::SeqCst),
    })
}

#[tauri::command]
pub async fn get_proxy_status() -> Result<ProxyStatus, AppError> {
    Ok(ProxyStatus {
        running: PROXY_RUNNING.load(Ordering::SeqCst),
        port: None,
        intercepted_count: INTERCEPT_COUNT.load(Ordering::SeqCst),
    })
}