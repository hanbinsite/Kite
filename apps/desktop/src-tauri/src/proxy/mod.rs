use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};

use hudsucker::{
    self,
    certificate_authority::RcgenAuthority,
    Proxy,
};
use rcgen::{CertificateParams, KeyPair};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Configuration & Status types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Intercept data (UI types — no ts-rs export for now, see P0 comment below)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptedRequest {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub url: String,
    pub host: String,
    pub path: String,
    pub headers: Vec<KeyValue>,
    pub body: String,
    pub status: u16,
    pub response_headers: Vec<KeyValue>,
    pub response_body: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
}

// ---------------------------------------------------------------------------
// Global proxy state
// ---------------------------------------------------------------------------

struct InnerProxyState {
    intercepted: std::sync::Mutex<Vec<InterceptData>>,
    port: std::sync::Mutex<Option<u16>>,
    ca_cert_pem: std::sync::Mutex<Option<String>>,
    auth_username: std::sync::Mutex<Option<String>>,
    auth_password: std::sync::Mutex<Option<String>>,
}

static PROXY_STATE: std::sync::LazyLock<InnerProxyState> = std::sync::LazyLock::new(|| InnerProxyState {
    intercepted: std::sync::Mutex::new(Vec::new()),
    port: std::sync::Mutex::new(None),
    ca_cert_pem: std::sync::Mutex::new(None),
    auth_username: std::sync::Mutex::new(None),
    auth_password: std::sync::Mutex::new(None),
});

static PROXY_RUNNING: AtomicBool = AtomicBool::new(false);

// ---------------------------------------------------------------------------
// Intercept data (internal, not serialised directly for UI)
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct InterceptData {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub url: String,
    pub host: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub status: u16,
    pub response_headers: Vec<(String, String)>,
    pub response_body: String,
    pub duration_ms: u64,
}

// ---------------------------------------------------------------------------
// ProxyState – managed by Tauri
// ---------------------------------------------------------------------------

pub struct ProxyState {
    pub shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self {
            shutdown_tx: Mutex::new(None),
        }
    }
}

impl Default for ProxyState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// CA generation
// ---------------------------------------------------------------------------

fn gen_ca() -> Result<(RcgenAuthority, String), AppError> {
    let key_pair = KeyPair::generate()
        .map_err(|e| AppError::internal(format!("Failed to generate CA key: {}", e)))?;
    let mut params = CertificateParams::default();
    params
        .distinguished_name
        .push(rcgen::DnType::CommonName, "Kite MITM Proxy CA");
    params
        .distinguished_name
        .push(rcgen::DnType::OrganizationName, "Kite API Client");
    params.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
    params.key_usages = vec![
        rcgen::KeyUsagePurpose::KeyCertSign,
        rcgen::KeyUsagePurpose::CrlSign,
    ];

    let cert = params
        .self_signed(&key_pair)
        .map_err(|e| AppError::internal(format!("Failed to generate CA cert: {}", e)))?;

    let ca_pem = cert.pem();

    let issuer = rcgen::Issuer::from_ca_cert_der(cert.der(), key_pair)
        .map_err(|e| AppError::internal(format!("Failed to create issuer: {}", e)))?;

    let authority = RcgenAuthority::new(
        issuer,
        1_000,
        hudsucker::rustls::crypto::aws_lc_rs::default_provider(),
    );

    Ok((authority, ca_pem))
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

// Request/response capture via HttpHandler is deferred (hudsucker 0.24 trait compat issue).
// The proxy currently passes HTTPS traffic through without logging to the UI.
// Future fix: implement a custom HttpHandler once hudsucker API is finalized.

#[tauri::command]
pub async fn start_proxy(
    state: tauri::State<'_, ProxyState>,
    config: ProxyConfig,
) -> Result<ProxyStatus, AppError> {
    if !config.enabled {
        return Err(AppError::internal("Proxy is disabled".into()));
    }

    if PROXY_RUNNING.load(Ordering::SeqCst) {
        return Err(AppError::internal("Proxy is already running".into()));
    }

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|e| AppError::internal(format!("Invalid address: {}", e)))?;

    if !addr.ip().is_loopback() {
        return Err(AppError::internal(
            "Proxy can only bind to localhost (127.0.0.1 or ::1) for security".into(),
        ));
    }

    let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();

    let (ca, ca_pem) = gen_ca()?;

    PROXY_STATE.intercepted.lock().unwrap().clear();

    let auth_username = if config.requires_auth {
        config.username.clone()
    } else {
        None
    };
    let auth_password = if config.requires_auth {
        config.password.clone()
    } else {
        None
    };

    let proxy = Proxy::builder()
        .with_addr(addr)
        .with_ca(ca)
        .with_rustls_connector(
            hudsucker::rustls::crypto::aws_lc_rs::default_provider(),
        )
        .with_http_handler(hudsucker::NoopHandler::default())
        .with_graceful_shutdown(async {
            let _ = cancel_rx.await;
        })
        .build()
        .map_err(|e| AppError::internal(format!("Failed to build proxy: {}", e)))?;

    PROXY_RUNNING.store(true, Ordering::SeqCst);

    {
        let mut shutdown = state.shutdown_tx.lock().await;
        *shutdown = Some(cancel_tx);
    }
    {
        let mut port = PROXY_STATE.port.lock().unwrap();
        *port = Some(config.port);
    }
    {
        let mut ca = PROXY_STATE.ca_cert_pem.lock().unwrap();
        *ca = Some(ca_pem);
    }
    {
        let mut u = PROXY_STATE.auth_username.lock().unwrap();
        *u = auth_username;
    }
    {
        let mut p = PROXY_STATE.auth_password.lock().unwrap();
        *p = auth_password;
    }

    tokio::spawn(async move {
        if let Err(e) = proxy.start().await {
            tracing::error!("Proxy server error: {}", e);
        }
        PROXY_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(ProxyStatus {
        running: true,
        port: Some(config.port),
        intercepted_count: 0,
    })
}

#[tauri::command]
pub async fn stop_proxy(state: tauri::State<'_, ProxyState>) -> Result<ProxyStatus, AppError> {
    PROXY_RUNNING.store(false, Ordering::SeqCst);

    let mut shutdown = state.shutdown_tx.lock().await;
    if let Some(tx) = shutdown.take() {
        let _ = tx.send(());
    }

    let count = PROXY_STATE.intercepted.lock().unwrap().len() as u64;
    let mut port = PROXY_STATE.port.lock().unwrap();
    *port = None;

    Ok(ProxyStatus {
        running: false,
        port: None,
        intercepted_count: count,
    })
}

#[tauri::command]
pub async fn get_proxy_status() -> Result<ProxyStatus, AppError> {
    let running = PROXY_RUNNING.load(Ordering::SeqCst);
    let port = if running {
        *PROXY_STATE.port.lock().unwrap()
    } else {
        None
    };
    Ok(ProxyStatus {
        running,
        port,
        intercepted_count: PROXY_STATE.intercepted.lock().unwrap().len() as u64,
    })
}

#[tauri::command]
pub async fn get_intercepted_requests() -> Result<Vec<InterceptedRequest>, AppError> {
    let intercepted = PROXY_STATE.intercepted.lock().unwrap();
    Ok(intercepted
        .iter()
        .map(|d| InterceptedRequest {
            id: d.id.clone(),
            timestamp: d.timestamp.clone(),
            method: d.method.clone(),
            url: d.url.clone(),
            host: d.host.clone(),
            path: d.path.clone(),
            headers: d
                .headers
                .iter()
                .map(|(k, v)| KeyValue {
                    key: k.clone(),
                    value: v.clone(),
                })
                .collect(),
            body: d.body.clone(),
            status: d.status,
            response_headers: d
                .response_headers
                .iter()
                .map(|(k, v)| KeyValue {
                    key: k.clone(),
                    value: v.clone(),
                })
                .collect(),
            response_body: d.response_body.clone(),
            duration_ms: d.duration_ms,
        })
        .collect())
}

#[tauri::command]
pub async fn clear_intercepted_requests() -> Result<(), AppError> {
    PROXY_STATE.intercepted.lock().unwrap().clear();
    Ok(())
}

#[tauri::command]
pub async fn export_proxy_ca() -> Result<String, AppError> {
    let ca = PROXY_STATE.ca_cert_pem.lock().unwrap();
    ca.clone()
        .ok_or_else(|| AppError::internal("CA certificate not available. Start the proxy first.".into()))
}