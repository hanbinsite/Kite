use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::{Manager, State};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;
use crate::storage::CookieEntry;

pub struct HttpClientState {
    pub cancellation_tokens: Arc<RwLock<HashMap<String, CancellationToken>>>,
}

impl HttpClientState {
    pub fn new() -> Self {
        Self {
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
    pub auth: Option<AuthConfig>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(default)]
    pub formdata: Vec<FormDataParam>,
    #[serde(default)]
    pub urlencoded: Vec<UrlEncodedParam>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphql_query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphql_variables: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormDataParam {
    pub key: String,
    pub value: String,
    #[serde(default = "default_form_type")]
    pub param_type: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

fn default_form_type() -> String {
    "text".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlEncodedParam {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum AuthConfig {
    #[serde(rename = "none")]
    None(EmptyAuth),
    #[serde(rename = "apikey")]
    ApiKey(ApiKeyAuth),
    #[serde(rename = "bearer")]
    Bearer(BearerAuth),
    #[serde(rename = "basic")]
    Basic(BasicAuth),
    #[serde(rename = "jwt")]
    Jwt(JwtAuth),
    #[serde(rename = "oauth1")]
    OAuth1(OAuth1Auth),
    #[serde(rename = "oauth2")]
    OAuth2(OAuth2Auth),
    #[serde(rename = "awsv4")]
    AwsV4(AwsV4Auth),
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmptyAuth {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyAuth {
    pub key: String,
    pub value: String,
    #[serde(default = "default_add_to_header")]
    pub add_to: String,
}

fn default_add_to_header() -> String {
    "header".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BearerAuth {
    pub token: String,
    #[serde(default = "default_bearer_prefix")]
    pub prefix: String,
}

fn default_bearer_prefix() -> String {
    "Bearer".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BasicAuth {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JwtAuth {
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuth1Auth {
    pub consumer_key: String,
    pub consumer_secret: String,
    pub token: String,
    pub token_secret: String,
    #[serde(default = "default_hmac_sha1")]
    pub signature_method: String,
}

fn default_hmac_sha1() -> String {
    "HMAC-SHA1".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuth2Auth {
    pub access_token: String,
    #[serde(default = "default_token_type")]
    pub token_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in: Option<u64>,
}

fn default_token_type() -> String {
    "Bearer".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsV4Auth {
    pub access_key_id: String,
    pub secret_access_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
    pub service: String,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestSettings {
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default = "default_redirects")]
    pub max_redirects: u32,
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
}

fn default_timeout() -> u64 {
    30000
}
fn default_true() -> bool {
    true
}
fn default_redirects() -> u32 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

fn build_client(settings: &RequestSettings) -> Result<Client, AppError> {
    let mut builder = Client::builder()
        .cookie_store(true)
        .timeout(std::time::Duration::from_millis(settings.timeout_ms));

    if !settings.follow_redirects {
        builder = builder.redirect(reqwest::redirect::Policy::none());
    } else {
        builder = builder.redirect(reqwest::redirect::Policy::limited(settings.max_redirects as usize));
    }

    if !settings.verify_ssl {
        builder = builder.danger_accept_invalid_certs(true);
    }

    builder.build().map_err(|e| AppError::internal(format!("Failed to build HTTP client: {}", e)))
}

fn apply_auth_to_config(
    config: &mut HttpRequestConfig,
) {
    if let Some(auth) = &config.auth {
        match auth {
            AuthConfig::Bearer(b) => {
                if !b.token.is_empty() {
                    let header_value = if b.prefix.is_empty() {
                        b.token.clone()
                    } else {
                        format!("{} {}", b.prefix, b.token)
                    };
                    config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                    config.headers.push(Header {
                        key: "Authorization".into(),
                        value: header_value,
                        disabled: false,
                    });
                }
            }
            AuthConfig::Basic(b) => {
                let encoded = BASE64_ENGINE.encode(format!("{}:{}", b.username, b.password));
                config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                config.headers.push(Header {
                    key: "Authorization".into(),
                    value: format!("Basic {}", encoded),
                    disabled: false,
                });
            }
            AuthConfig::ApiKey(a) => {
                if !a.key.is_empty() && !a.value.is_empty() {
                    if a.add_to == "query" {
                        config.params.push(QueryParam {
                            key: a.key.clone(),
                            value: a.value.clone(),
                            disabled: false,
                        });
                    } else {
                        config.headers.retain(|h| h.key.to_lowercase() != a.key.to_lowercase());
                        config.headers.push(Header {
                            key: a.key.clone(),
                            value: a.value.clone(),
                            disabled: false,
                        });
                    }
                }
            }
            AuthConfig::Jwt(j) => {
                if !j.token.is_empty() {
                    config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                    config.headers.push(Header {
                        key: "Authorization".into(),
                        value: format!("Bearer {}", j.token),
                        disabled: false,
                    });
                }
            }
            AuthConfig::OAuth2(o) => {
                if !o.access_token.is_empty() {
                    config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                    config.headers.push(Header {
                        key: "Authorization".into(),
                        value: format!("{} {}", o.token_type, o.access_token),
                        disabled: false,
                    });
                }
            }
            AuthConfig::None(_) => {}
            AuthConfig::OAuth1(_) => {
                eprintln!("[WARN] OAuth 1.0a signing not yet implemented — request sent without auth");
            }
            AuthConfig::AwsV4(_) => {
                eprintln!("[WARN] AWS Signature v4 signing not yet implemented — request sent without auth");
            }
        }
    }
}

use base64::Engine;
const BASE64_ENGINE: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

#[tauri::command]
pub async fn send_http_request(
    app_handle: tauri::AppHandle,
    http_state: State<'_, HttpClientState>,
    mut config: HttpRequestConfig,
) -> Result<HttpResponse, AppError> {
    let request_id = config.id.clone();
    let start = Instant::now();

    let cancel_token = CancellationToken::new();
    http_state.cancellation_tokens.write().await.insert(request_id.clone(), cancel_token.clone());

    apply_auth_to_config(&mut config);

    let client = build_client(&config.settings)?;

    let mut url = config.url.clone();
    let params: Vec<(&str, &str)> = config
        .params
        .iter()
        .filter(|p| !p.disabled && !p.key.is_empty())
        .map(|p| (p.key.as_str(), p.value.as_str()))
        .collect();

    if !params.is_empty() {
        let query_string = serde_urlencoded::to_string(&params)
            .map_err(|e| AppError::internal(e.to_string()))?;
        if url.contains('?') {
            url = format!("{}&{}", url, query_string);
        } else {
            url = format!("{}?{}", url, query_string);
        }
    }

    let method = reqwest::Method::from_bytes(config.method.to_uppercase().as_bytes())
        .unwrap_or(reqwest::Method::GET);

    let mut request_builder = client.request(method, &url);

    for header in &config.headers {
        if !header.disabled && !header.key.is_empty() {
            request_builder = request_builder.header(&header.key, &header.value);
        }
    }

    let cookie_header = load_cookie_header(&app_handle, &url).await;
    if !cookie_header.is_empty() {
        request_builder = request_builder.header("Cookie", &cookie_header);
    }

    if let Some(body) = &config.body {
        match body.mode.as_str() {
            "raw" => {
                if let Some(content) = &body.content {
                    if !content.is_empty() {
                        if let Some(ct) = &body.content_type {
                            request_builder = request_builder.header("Content-Type", ct);
                        }
                        request_builder = request_builder.body(content.clone());
                    }
                }
            }
            "urlencoded" => {
                let pairs: Vec<(&str, &str)> = body
                    .urlencoded
                    .iter()
                    .filter(|p| !p.disabled && !p.key.is_empty())
                    .map(|p| (p.key.as_str(), p.value.as_str()))
                    .collect();
                request_builder = request_builder.form(&pairs);
            }
            "formdata" => {
                let mut form = reqwest::multipart::Form::new();
                for param in &body.formdata {
                    if param.disabled || param.key.is_empty() {
                        continue;
                    }
                    match param.param_type.as_str() {
                        "text" => {
                            form = form.text(param.key.clone(), param.value.clone());
                        }
"file" => {
    if let Ok(data) = std::fs::read(&param.value) {
        let file_name = std::path::Path::new(&param.value)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".into());
        let part = reqwest::multipart::Part::bytes(data)
            .file_name(file_name);
        let part = match part.mime_str(
            param.content_type.as_deref().unwrap_or("application/octet-stream"),
        ) {
            Ok(p) => p,
            Err(_) => reqwest::multipart::Part::bytes(Vec::<u8>::new())
                .file_name("file"),
        };
        form = form.part(param.key.clone(), part);
    }
}
                        _ => {
                            form = form.text(param.key.clone(), param.value.clone());
                        }
                    }
                }
                request_builder = request_builder.multipart(form);
            }
            "graphql" => {
                let payload = serde_json::json!({
                    "query": body.graphql_query.as_deref().unwrap_or(""),
                    "variables": body.graphql_variables.as_deref()
                        .and_then(|v| serde_json::from_str(v).ok())
                        .unwrap_or(serde_json::Value::Null),
                });
                request_builder = request_builder
                    .header("Content-Type", "application/json")
                    .json(&payload);
            }
            "binary" => {
                if let Some(content) = &body.content {
                    if !content.is_empty() {
                        if let Some(ct) = &body.content_type {
                            request_builder = request_builder.header("Content-Type", ct);
                        }
                        let data = if std::path::Path::new(content).exists() {
                            std::fs::read(content).map_err(|e| AppError::storage_read_failed(format!("Failed to read binary file: {}", e)))?
                        } else {
                            content.as_bytes().to_vec()
                        };
                        request_builder = request_builder.body(data);
                    }
                }
            }
            _ => {}
        }
    }

    let response_result = tokio::select! {
        res = request_builder.send() => res,
        _ = cancel_token.cancelled() => {
            http_state.cancellation_tokens.write().await.remove(&request_id);
            return Err(AppError::net_cancelled());
        }
    };

    http_state.cancellation_tokens.write().await.remove(&request_id);

    let response = response_result.map_err(|e| {
        if e.is_timeout() {
            AppError::net_timeout(config.settings.timeout_ms)
        } else if e.is_connect() {
            AppError::net_connect_failed(e.to_string())
        } else if e.is_redirect() {
            AppError::net_redirect_limit(config.settings.max_redirects)
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

    save_cookies_from_response(&app_handle, &url, response.headers()).await;

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

async fn load_cookie_header(
    app_handle: &tauri::AppHandle,
    url: &str,
) -> String {
    let host = match reqwest::Url::parse(url) {
        Ok(u) => u.host_str().unwrap_or("").to_string(),
        Err(_) => return String::new(),
    };
    if host.is_empty() {
        return String::new();
    }

    let storage = app_handle.state::<crate::AppState>().storage.clone();
    let cookies = match tokio::task::spawn_blocking(move || {
        let storage_lock = storage.blocking_read();
        let storage = storage_lock.as_ref().ok_or("Storage not initialized".to_string())?;
        storage.query_cookies(Some(&host))
    })
    .await
    {
        Ok(Ok(cookies)) => cookies,
        _ => return String::new(),
    };

    if cookies.is_empty() {
        return String::new();
    }

    cookies
        .iter()
        .map(|c| format!("{}={}", c.name, c.value))
        .collect::<Vec<_>>()
        .join("; ")
}

async fn save_cookies_from_response(
    app_handle: &tauri::AppHandle,
    url: &str,
    response_headers: &reqwest::header::HeaderMap,
) {
    let set_cookie_headers: Vec<String> = response_headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok().map(|s| s.to_string()))
        .collect();

    if set_cookie_headers.is_empty() {
        return;
    }

    let host = match reqwest::Url::parse(url) {
        Ok(u) => u.host_str().unwrap_or("").to_string(),
        Err(_) => return,
    };

    let storage = app_handle.state::<crate::AppState>().storage.clone();
    let _ = tokio::task::spawn_blocking(move || {
        let storage_lock = storage.blocking_write();
        let storage = match storage_lock.as_ref() {
            Some(s) => s,
            None => return,
        };

        for cookie_str in set_cookie_headers {
            let cookie = parse_set_cookie(&cookie_str, &host);
            let _ = storage.upsert_cookie(&cookie);
        }
    })
    .await;
}

fn parse_set_cookie(header_value: &str, default_domain: &str) -> CookieEntry {
    let parts: Vec<&str> = header_value.split(';').collect();
    let mut name = String::new();
    let mut value = String::new();
    let mut domain = format!(".{}", default_domain);
    let mut path = "/".to_string();
    let mut expires = None;
    let mut secure = false;
    let mut http_only = false;
    let mut same_site = "Lax".to_string();

    for (i, part) in parts.iter().enumerate() {
        let part = part.trim();
        if i == 0 {
            if let Some((n, v)) = part.split_once('=') {
                name = n.to_string();
                value = v.to_string();
            }
            continue;
        }
        let lower = part.to_lowercase();
        if lower.starts_with("domain=") {
            if let Some(d) = part.strip_prefix("Domain=") {
                domain = d.trim().to_string();
            } else if let Some(d) = part.strip_prefix("domain=") {
                domain = d.trim().to_string();
            }
        } else if lower.starts_with("path=") {
            if let Some(p) = part.strip_prefix("Path=") {
                path = p.trim().to_string();
            } else if let Some(p) = part.strip_prefix("path=") {
                path = p.trim().to_string();
            }
        } else if lower.starts_with("expires=") {
            let exp_str = if let Some(e) = part.strip_prefix("Expires=") {
                e.trim()
            } else if let Some(e) = part.strip_prefix("expires=") {
                e.trim()
            } else {
                continue;
            };
            if let Ok(dt) = parse_cookie_expires(exp_str) {
                expires = Some(dt.to_rfc3339());
            }
        } else if lower == "secure" {
            secure = true;
        } else if lower == "httponly" {
            http_only = true;
        } else if lower.starts_with("samesite=") {
            let ss = if let Some(s) = part.strip_prefix("SameSite=") {
                s.trim().to_string()
            } else if let Some(s) = part.strip_prefix("samesite=") {
                s.trim().to_string()
            } else {
                continue;
            };
            same_site = ss;
        }
    }

    CookieEntry {
        id: None,
        domain,
        name,
        value,
        path,
        expires,
        secure,
        http_only,
        same_site,
    }
}

fn parse_cookie_expires(s: &str) -> Result<chrono::DateTime<chrono::Utc>, Box<dyn std::error::Error>> {
    let s = s.trim();
    for fmt in &[
        "%a, %d %b %Y %H:%M:%S GMT",
        "%A, %d-%b-%y %H:%M:%S GMT",
        "%a, %d-%b-%Y %H:%M:%S GMT",
    ] {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, fmt) {
            return Ok(dt.and_utc());
        }
    }
    Err(format!("Cannot parse cookie date: {}", s).into())
}
