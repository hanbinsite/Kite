use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use hudsucker::{
    self,
    certificate_authority::RcgenAuthority,
    Proxy, NoopHandler,
};
use rcgen::{CertificateParams, Issuer, KeyPair};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::sync::{Mutex, RwLock};

use crate::error::AppError;

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

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
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

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
}

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

static PROXY_RUNNING: AtomicBool = AtomicBool::new(false);
static INTERCEPT_COUNT: AtomicU64 = AtomicU64::new(0);

pub struct ProxyState {
    pub shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    pub port: RwLock<Option<u16>>,
    pub intercepted: RwLock<Vec<InterceptData>>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self {
            shutdown_tx: Mutex::new(None),
            port: RwLock::new(None),
            intercepted: RwLock::new(Vec::new()),
        }
    }
}

impl Default for ProxyState {
    fn default() -> Self {
        Self::new()
    }
}

fn gen_ca() -> Result<RcgenAuthority, AppError> {
    let key_pair = KeyPair::generate().map_err(|e| AppError::internal(format!("Failed to generate CA key: {}", e)))?;
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

    let issuer = Issuer::from_ca_cert_der(cert.der(), key_pair)
        .map_err(|e| AppError::internal(format!("Failed to create issuer: {}", e)))?;

    Ok(RcgenAuthority::new(
        issuer,
        1_000,
        hudsucker::rustls::crypto::aws_lc_rs::default_provider(),
    ))
}

#[tauri::command]
pub async fn start_proxy(
    state: tauri::State<'_, ProxyState>,
    _app_handle: AppHandle,
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

    let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();

    let ca = gen_ca()?;

    let proxy = Proxy::builder()
        .with_addr(addr)
        .with_ca(ca)
        .with_rustls_connector(
            hudsucker::rustls::crypto::aws_lc_rs::default_provider(),
        )
        .with_http_handler(NoopHandler::default())
        .with_graceful_shutdown(async {
            let _ = cancel_rx.await;
        })
        .build()
        .map_err(|e| AppError::internal(format!("Failed to build proxy: {}", e)))?;

    PROXY_RUNNING.store(true, Ordering::SeqCst);
    INTERCEPT_COUNT.store(0, Ordering::SeqCst);

    {
        let mut shutdown = state.shutdown_tx.lock().await;
        *shutdown = Some(cancel_tx);
    }
    {
        let mut port = state.port.write().await;
        *port = Some(config.port);
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

    let count = INTERCEPT_COUNT.load(Ordering::SeqCst);
    let mut port = state.port.write().await;
    *port = None;

    Ok(ProxyStatus {
        running: false,
        port: None,
        intercepted_count: count,
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

#[tauri::command]
pub async fn get_intercepted_requests(
    state: tauri::State<'_, ProxyState>,
) -> Result<Vec<InterceptedRequest>, AppError> {
    let intercepted = state.intercepted.read().await;
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
                .map(|(k, v)| KeyValue { key: k.clone(), value: v.clone() })
                .collect(),
            body: d.body.clone(),
            status: d.status,
            response_headers: d
                .response_headers
                .iter()
                .map(|(k, v)| KeyValue { key: k.clone(), value: v.clone() })
                .collect(),
            response_body: d.response_body.clone(),
            duration_ms: d.duration_ms,
        })
        .collect())
}

#[tauri::command]
pub async fn clear_intercepted_requests(
    state: tauri::State<'_, ProxyState>,
) -> Result<(), AppError> {
    let mut intercepted = state.intercepted.write().await;
    intercepted.clear();
    INTERCEPT_COUNT.store(0, Ordering::SeqCst);
    Ok(())
}