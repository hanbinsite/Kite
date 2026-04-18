use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::State;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;

pub struct HttpClientState {
    pub client: Client,
    pub cancellation_tokens: Arc<RwLock<HashMap<String, CancellationToken>>>,
}

impl HttpClientState {
    pub fn new() -> Self {
        let client = Client::builder()
            .cookie_store(true)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            cancellation_tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for HttpClientState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequestConfig {
    pub id: String,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<Header>,
    #[serde(default)]
    pub params: Vec<QueryParam>,
    #[serde(default)]
    pub body: Option<BodyConfig>,
    #[serde(default)]
    pub settings: RequestSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParam {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BodyConfig {
    pub mode: String,
    pub content: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestSettings {
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
}

fn default_timeout() -> u64 { 30000 }
fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub id: String,
    pub request_id: String,
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<ResponseHeader>,
    pub body: String,
    pub body_size: u64,
    pub time: u64,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseHeader {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn send_http_request(
    state: State<'_, HttpClientState>,
    config: HttpRequestConfig,
) -> Result<HttpResponse, AppError> {
    let request_id = config.id.clone();
    let start = Instant::now();

    let cancel_token = CancellationToken::new();
    state.cancellation_tokens.write().await.insert(request_id.clone(), cancel_token.clone());

    let mut url = config.url.clone();
    let params: Vec<(&str, &str)> = config
        .params
        .iter()
        .filter(|p| !p.disabled && !p.key.is_empty())
        .map(|p| (p.key.as_str(), p.value.as_str()))
        .collect();

    if !params.is_empty() {
        let query_string = serde_urlencoded::to_string(&params).map_err(|e| AppError::internal(e.to_string()))?;
        if url.contains('?') {
            url = format!("{}&{}", url, query_string);
        } else {
            url = format!("{}?{}", url, query_string);
        }
    }

    let mut request_builder = state.client.request(
        reqwest::Method::from_bytes(config.method.to_uppercase().as_bytes())
            .unwrap_or(reqwest::Method::GET),
        &url,
    );

    for header in &config.headers {
        if !header.disabled && !header.key.is_empty() {
            request_builder = request_builder.header(&header.key, &header.value);
        }
    }

    if let Some(body) = &config.body {
        if let Some(content) = &body.content {
            if !content.is_empty() {
                if let Some(ct) = &body.content_type {
                    request_builder = request_builder.header("Content-Type", ct);
                }
                request_builder = request_builder.body(content.clone());
            }
        }
    }

    request_builder = request_builder.timeout(std::time::Duration::from_millis(config.settings.timeout_ms));

    let response_result = request_builder.send().await;

    state.cancellation_tokens.write().await.remove(&request_id);

    if cancel_token.is_cancelled() {
        return Err(AppError::net_cancelled());
    }

    let response = response_result.map_err(|e| {
        if e.is_timeout() {
            AppError::net_timeout(config.settings.timeout_ms)
        } else if e.is_connect() {
            AppError::net_connect_failed(e.to_string())
        } else {
            AppError::internal(e.to_string())
        }
    })?;

    let elapsed = start.elapsed().as_millis() as u64;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("Unknown").to_string();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let headers: Vec<ResponseHeader> = response
        .headers()
        .iter()
        .map(|(k, v)| ResponseHeader {
            key: k.to_string(),
            value: v.to_str().unwrap_or("").to_string(),
        })
        .collect();

    let body = response.text().await.map_err(|e| AppError::internal(e.to_string()))?;
    let body_size = body.len() as u64;

    Ok(HttpResponse {
        id: uuid::Uuid::new_v4().to_string(),
        request_id,
        status: status.as_u16(),
        status_text,
        headers,
        body,
        body_size,
        time: elapsed,
        content_type,
    })
}

#[tauri::command]
pub async fn cancel_http_request(
    state: State<'_, HttpClientState>,
    request_id: String,
) -> Result<(), AppError> {
    let mut tokens = state.cancellation_tokens.write().await;
    if let Some(token) = tokens.remove(&request_id) {
        token.cancel();
    }
    Ok(())
}