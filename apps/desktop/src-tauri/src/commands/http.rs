use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, State};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;
use crate::storage::CookieEntry;

const CANCELLATION_TOKEN_TTL: Duration = Duration::from_secs(300);

pub struct HttpClientState {
    pub cancellation_tokens: Arc<RwLock<HashMap<String, (CancellationToken, Instant)>>>,
}

impl HttpClientState {
    pub fn new() -> Self {
        Self {
            cancellation_tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn cleanup_expired_tokens(&self) {
        let mut tokens = self.cancellation_tokens.write().await;
        tokens.retain(|_, (_, created)| created.elapsed() < CANCELLATION_TOKEN_TTL);
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
    #[serde(default = "default_jwt_algorithm")]
    pub algorithm: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry_seconds: Option<u64>,
    #[serde(default = "default_jwt_prefix")]
    pub prefix: String,
}

fn default_jwt_algorithm() -> String {
    "HS256".into()
}

fn default_jwt_prefix() -> String {
    "Bearer".into()
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestSettings {
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default = "default_redirects")]
    pub max_redirects: u32,
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
    #[serde(default)]
    pub proxy_url: Option<String>,
}

impl Default for RequestSettings {
    fn default() -> Self {
        Self {
            timeout_ms: default_timeout(),
            follow_redirects: default_true(),
            max_redirects: default_redirects(),
            verify_ssl: default_true(),
            proxy_url: None,
        }
    }
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
  pub body_base64: Option<String>,
  pub body_size: u64,
  pub time: u64,
  pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseHeader {
    pub key: String,
    pub value: String,
}

static DEFAULT_CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .cookie_store(false)
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create default HTTP client")
});

pub(crate) fn build_client(settings: &RequestSettings) -> Result<Client, AppError> {
    let needs_custom = settings.proxy_url.as_ref().is_some_and(|p| !p.is_empty())
        || !settings.follow_redirects
        || !settings.verify_ssl
        || settings.timeout_ms != 30000;

    if !needs_custom {
        return Ok(DEFAULT_CLIENT.clone());
    }

    let mut builder = Client::builder()
        .cookie_store(false)
        .timeout(std::time::Duration::from_millis(settings.timeout_ms));

    if let Some(ref proxy_url) = settings.proxy_url {
        if !proxy_url.is_empty() {
            builder = builder.proxy(
                reqwest::Proxy::all(proxy_url)
                    .map_err(|e| AppError::internal(format!("Invalid proxy URL: {}", e)))?,
            );
        }
    }

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

pub(crate) fn sign_jwt(jwt: &JwtAuth) -> Result<String, AppError> {
    if let Some(ref secret) = jwt.secret {
        let header = match jwt.algorithm.as_str() {
            "HS256" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            "HS384" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS384),
            "HS512" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS512),
            "RS256" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
            "RS384" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS384),
            "RS512" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS512),
            "ES256" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::ES256),
            "ES384" => jsonwebtoken::Header::new(jsonwebtoken::Algorithm::ES384),
            _ => return Err(AppError::internal(format!("Unsupported JWT algorithm: {}", jwt.algorithm))),
        };
        let mut claims: serde_json::Value = if let Some(ref payload) = jwt.payload {
            serde_json::from_str(payload).map_err(|e| AppError::internal(format!("Invalid JWT payload JSON: {}", e)))?
        } else {
            serde_json::Value::Object(serde_json::Map::new())
        };
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if let Some(obj) = claims.as_object_mut() {
            obj.entry("iat").or_insert_with(|| serde_json::Value::Number(now.into()));
            if let Some(exp) = jwt.expiry_seconds {
                obj.insert("exp".into(), serde_json::Value::Number((now + exp).into()));
            }
        }
        let token = jsonwebtoken::encode(&header, &claims, &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()))
            .map_err(|e| AppError::internal(format!("JWT signing failed: {}", e)))?;
        Ok(token)
    } else {
        Ok(jwt.token.clone())
    }
}

pub(crate) fn apply_auth_to_config(
    config: &mut HttpRequestConfig,
) -> Result<(), AppError> {
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
                let signed_token = sign_jwt(j)?;
                if signed_token.is_empty() {
                    return Ok(());
                }
                config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                let header_value = if j.prefix.is_empty() {
                    signed_token
                } else {
                    format!("{} {}", j.prefix, signed_token)
                };
                config.headers.push(Header {
                    key: "Authorization".into(),
                    value: header_value,
                    disabled: false,
                });
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
            AuthConfig::OAuth1(o) => {
                let url = extract_base_url(&config.url);
                let auth_header = build_oauth1_header(o, &config.method, &url)?;
                config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                config.headers.push(Header {
                    key: "Authorization".into(),
                    value: auth_header,
                    disabled: false,
                });
            }
            AuthConfig::AwsV4(a) => {
                let body_str = config.body.as_ref()
                    .and_then(|b| b.content.as_ref())
                    .map(|c| c.as_str())
                    .unwrap_or("");
                let content_type = config.body.as_ref()
                    .and_then(|b| b.content_type.as_ref())
                    .map(|c| c.as_str())
                    .unwrap_or("application/x-www-form-urlencoded");
                let (auth_header, amz_date) =
                    build_aws_v4_header(a, &config.method, &config.url, body_str.as_bytes(), content_type)?;
                config.headers.retain(|h| h.key.to_lowercase() != "authorization");
                config.headers.push(Header {
                    key: "Authorization".into(),
                    value: auth_header,
                    disabled: false,
                });
                config.headers.retain(|h| h.key.to_lowercase() != "x-amz-date");
                config.headers.push(Header {
                    key: "x-amz-date".into(),
                    value: amz_date,
                    disabled: false,
                });
                if let Some(ref session_token) = a.session_token {
                    config.headers.retain(|h| h.key.to_lowercase() != "x-amz-security-token");
                    config.headers.push(Header {
                        key: "x-amz-security-token".into(),
                        value: session_token.clone(),
                        disabled: false,
                    });
                }
            }
        }
    }
    Ok(())
}

use base64::Engine;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

type HmacSha1 = Hmac<Sha1>;
type HmacSha256 = Hmac<Sha256>;

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
    http_state.cancellation_tokens.write().await.insert(request_id.clone(), (cancel_token.clone(), Instant::now()));

    apply_auth_to_config(&mut config)?;

    let client = build_client(&config.settings)?;

    let mut parsed_url = reqwest::Url::parse(&config.url)
        .map_err(|e| AppError::net_invalid_url(format!("Invalid URL: {}", e)))?;
    {
        let mut query = parsed_url.query_pairs_mut();
        for p in &config.params {
            if !p.disabled && !p.key.is_empty() {
                query.append_pair(&p.key, &p.value);
            }
        }
    }
    let url = parsed_url.to_string();

    let method = reqwest::Method::from_bytes(config.method.to_uppercase().as_bytes())
        .map_err(|_| AppError::internal(format!("Invalid HTTP method: {}", config.method)))?;

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
     let file_path = std::path::Path::new(&param.value);
     let app_data = app_handle.path().app_data_dir();
     if let Ok(app_data_dir) = app_data {
         if crate::commands::file_ops::validate_path_within_app_data(&app_data_dir, file_path).is_ok() {
             if let Ok(data) = std::fs::read(file_path) {
                 let file_name = file_path
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
                            let file_path = std::path::Path::new(content);
                            let app_data = app_handle.path().app_data_dir();
                            if let Ok(app_data_dir) = app_data {
                                if crate::commands::file_ops::validate_path_within_app_data(&app_data_dir, file_path).is_err() {
                                    return Err(AppError::storage_path_traversal(format!(
                                        "Binary file path is outside app data directory: {}",
                                        content
                                    )));
                                }
                            }
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
        .map(|(k, v)| {
            let value = v.to_str().map(|s| s.to_string()).unwrap_or_else(|_| {
                let lossy = String::from_utf8_lossy(v.as_bytes()).to_string();
                tracing::warn!("Non-UTF8 response header '{}': replaced with lossy conversion", k);
                lossy
            });
            ResponseHeader { key: k.to_string(), value }
        })
        .collect();

    save_cookies_from_response(&app_handle, &url, response.headers()).await;

    let (body, body_base64) = {
        let body_bytes = response.bytes().await.map_err(|e| AppError::internal(e.to_string()))?;
        const MAX_BODY_SIZE: usize = 10 * 1024 * 1024;
        if body_bytes.len() > MAX_BODY_SIZE {
            return Err(AppError::net_body_too_large(body_bytes.len() as u64, MAX_BODY_SIZE as u64));
        }
        match String::from_utf8(body_bytes.to_vec()) {
            Ok(utf8_body) => (utf8_body, None),
            Err(_) => {
                let binary_info = format!("[Binary Response - {} bytes]", body_bytes.len());
                let encoded = BASE64_ENGINE.encode(&body_bytes);
                (binary_info, Some(encoded))
            }
        }
    };
    let body_size = body.len() as u64;

    Ok(HttpResponse {
        id: uuid::Uuid::new_v4().to_string(),
        request_id,
        status: status.as_u16(),
        status_text,
        headers,
        body,
        body_base64,
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
    if let Some((token, _)) = tokens.remove(&request_id) {
        token.cancel();
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub request_id: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadComplete {
    pub request_id: String,
    pub file_path: String,
    pub total_bytes: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadError {
    pub request_id: String,
    pub error: String,
}

#[tauri::command]
pub async fn download_http_response(
    app_handle: tauri::AppHandle,
    http_state: State<'_, HttpClientState>,
    mut config: HttpRequestConfig,
    download_path: String,
) -> Result<(), AppError> {
    let request_id = config.id.clone();
    let start = Instant::now();

    let cancel_token = CancellationToken::new();
    http_state.cancellation_tokens.write().await.insert(request_id.clone(), (cancel_token.clone(), Instant::now()));

    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::internal(format!("Cannot get app data dir: {}", e)))?;
    let download_path = std::path::Path::new(&download_path);
    crate::commands::file_ops::validate_path_within_app_data(&app_data_dir, download_path)?;

    apply_auth_to_config(&mut config)?;

    let client = build_client(&config.settings)?;

    let mut parsed_url = reqwest::Url::parse(&config.url)
        .map_err(|e| AppError::net_invalid_url(format!("Invalid URL: {}", e)))?;
    {
        let mut query = parsed_url.query_pairs_mut();
        for p in &config.params {
            if !p.disabled && !p.key.is_empty() {
                query.append_pair(&p.key, &p.value);
            }
        }
    }
    let url = parsed_url.to_string();

    let method = reqwest::Method::from_bytes(config.method.to_uppercase().as_bytes())
        .map_err(|_| AppError::internal(format!("Invalid HTTP method: {}", config.method)))?;

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
     let file_path = std::path::Path::new(&param.value);
     let app_data = app_handle.path().app_data_dir();
     if let Ok(app_data_dir) = app_data {
         if crate::commands::file_ops::validate_path_within_app_data(&app_data_dir, file_path).is_ok() {
             if let Ok(data) = std::fs::read(file_path) {
                 let file_name = file_path
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
                            let file_path = std::path::Path::new(content);
                            let app_data = app_handle.path().app_data_dir();
                            if let Ok(app_data_dir) = app_data {
                                if crate::commands::file_ops::validate_path_within_app_data(&app_data_dir, file_path).is_err() {
                                    return Err(AppError::storage_path_traversal(format!(
                                        "Binary file path is outside app data directory: {}",
                                        content
                                    )));
                                }
                            }
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

    let response = tokio::select! {
        res = request_builder.send() => res,
        _ = cancel_token.cancelled() => {
            http_state.cancellation_tokens.write().await.remove(&request_id);
            return Err(AppError::net_cancelled());
        }
    };

    http_state.cancellation_tokens.write().await.remove(&request_id);

    let response = response.map_err(|e| {
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

    if let Some(parent) = download_path.parent() {
        tokio::fs::create_dir_all(parent).await
            .map_err(|e| AppError::internal(format!("Cannot create download parent dir: {}", e)))?;
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;
    let mut file = tokio::fs::File::create(download_path).await
        .map_err(|e| AppError::internal(format!("Cannot create download file: {}", e)))?;

    use tokio::io::AsyncWriteExt;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        if cancel_token.is_cancelled() {
            let _ = tokio::fs::remove_file(download_path).await;
            return Err(AppError::net_cancelled());
        }
        let chunk = chunk_result.map_err(|e| AppError::internal(e.to_string()))?;
        file.write_all(&chunk).await
            .map_err(|e| AppError::internal(format!("Failed to write chunk: {}", e)))?;
        downloaded_bytes += chunk.len() as u64;

        let percentage = if total_bytes > 0 {
            (downloaded_bytes as f64 / total_bytes as f64) * 100.0
        } else {
            0.0
        };

        let _ = app_handle.emit("http-download-progress", DownloadProgress {
            request_id: request_id.clone(),
            total_bytes,
            downloaded_bytes,
            percentage,
        });
    }

    file.flush().await.map_err(|e| AppError::internal(format!("Failed to flush file: {}", e)))?;
    drop(file);

    let elapsed = start.elapsed().as_millis() as u64;

    let _ = app_handle.emit("http-download-complete", DownloadComplete {
        request_id: request_id.clone(),
        file_path: download_path.to_string_lossy().to_string(),
        total_bytes: downloaded_bytes,
        duration_ms: elapsed,
    });

    Ok(())
}

pub(crate) async fn load_cookie_header(
    app_handle: &tauri::AppHandle,
    url: &str,
) -> String {
    let parsed_url = match reqwest::Url::parse(url) {
        Ok(u) => u,
        Err(_) => return String::new(),
    };
    let host = parsed_url.host_str().unwrap_or("").to_string();
    let request_path = parsed_url.path().to_string();
    let is_https = parsed_url.scheme() == "https";
    if host.is_empty() {
        return String::new();
    }

    let now = chrono::Utc::now().to_rfc3339();

    let storage = app_handle.state::<crate::AppState>().storage.clone();
    let cookies = match tokio::task::spawn_blocking(move || {
        let storage_lock = storage.lock().expect("storage Mutex poisoned");
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
        .filter(|c| {
            if let Some(ref expiry) = c.expires {
                if expiry < &now {
                    return false;
                }
            }
            if c.secure && !is_https {
                return false;
            }
            let cookie_path = &c.path;
            if !request_path.starts_with(cookie_path) {
                return false;
            }
            true
        })
        .map(|c| format!("{}={}", c.name, c.value))
        .collect::<Vec<_>>()
        .join("; ")
}

pub(crate) async fn save_cookies_from_response_headers(
    app_handle: &tauri::AppHandle,
    url: &str,
    set_cookie_headers: &[String],
) {
    if set_cookie_headers.is_empty() {
        return;
    }

    let host = match reqwest::Url::parse(url) {
        Ok(u) => match u.host_str() {
            Some(h) => h.to_string(),
            None => {
                tracing::warn!("URL has no host: {}", url);
                return;
            }
        },
        Err(_) => return,
    };

    let storage = app_handle.state::<crate::AppState>().storage.clone();
    let cookies = set_cookie_headers.to_vec();
    let _ = tokio::task::spawn_blocking(move || {
        let storage_lock = storage.lock().expect("storage Mutex poisoned");
        let storage = match storage_lock.as_ref() {
            Some(s) => s,
            None => return,
        };
        for cookie_str in cookies {
            let cookie = parse_set_cookie(&cookie_str, &host);
            let _ = storage.upsert_cookie(&cookie);
        }
    })
    .await;
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
        Ok(u) => match u.host_str() {
            Some(h) => h.to_string(),
            None => { tracing::warn!("URL has no host: {}", url); return; }
        },
        Err(_) => return,
    };

    let storage = app_handle.state::<crate::AppState>().storage.clone();
    let _ = tokio::task::spawn_blocking(move || {
        let storage_lock = storage.lock().expect("storage Mutex poisoned");
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

#[tauri::command]
pub async fn graphql_introspect(url: String, headers: Option<Vec<(String, String)>>) -> Result<serde_json::Value, AppError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::safe_net_error("build client", e))?;

    let introspection_query = r#"query IntrospectionQuery { __schema { queryType { name } mutationType { name } subscriptionType { name } types { kind name description fields(includeDeprecated: true) { name description args { name description type { name kind ofType { name kind } } } type { name kind ofType { name kind ofType { name kind } } } } inputFields { name description type { name kind ofType { name kind } } } } } }"#;

    let body = serde_json::json!({ "query": introspection_query });

    let mut req = client.post(&url).json(&body);

    if let Some(h) = &headers {
        for (k, v) in h {
            req = req.header(k.as_str(), v.as_str());
        }
    }

    let resp = req.send().await
        .map_err(|e| AppError::safe_net_error("GraphQL introspection", e))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!("GraphQL endpoint returned {}: {}", status.as_u16(), &text[..200.min(text.len())])));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse introspection response: {}", e)))?;

    Ok(json)
}

fn percent_encode(s: &str) -> String {
    let mut result = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => result.push(byte as char),
            _ => result.push_str(&format!("%{:02X}", byte)),
        }
    }
    result
}

fn make_param_string(params: &BTreeMap<&str, &str>) -> String {
    let parts: Vec<_> = params.iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect();
    parts.join("&")
}

fn make_oauth1_signature(
    method: &str,
    base_url: &str,
    params: &BTreeMap<&str, &str>,
    consumer_secret: &str,
    token_secret: &str,
) -> String {
    let signing_key = format!("{}&{}", percent_encode(consumer_secret), percent_encode(token_secret));
    let mut mac = HmacSha1::new_from_slice(signing_key.as_bytes()).expect("HMAC key");
    let param_string = make_param_string(params);
    let base_string = format!("{}&{}&{}", method, percent_encode(base_url), percent_encode(&param_string));
    mac.update(base_string.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn extract_base_url(url: &str) -> String {
    if let Ok(parsed) = reqwest::Url::parse(url) {
        let scheme = parsed.scheme();
        let host = parsed.host_str().unwrap_or("");
        if let Some(port) = parsed.port() {
            format!("{}://{}:{}", scheme, host, port)
        } else {
            format!("{}://{}{}", scheme, host, parsed.path())
        }
    } else {
        url.to_string()
    }
}

fn build_oauth1_header(
    config: &OAuth1Auth,
    method: &str,
    url: &str,
) -> Result<String, AppError> {
    let nonce: String = std::iter::repeat_with(rand::random::<char>)
        .filter(|c| c.is_ascii_alphanumeric())
        .take(32)
        .collect();
    let timestamp = chrono::Utc::now().timestamp().to_string();

    let mut params: BTreeMap<&str, &str> = BTreeMap::new();
    params.insert("oauth_consumer_key", &config.consumer_key);
    params.insert("oauth_nonce", &nonce);
    params.insert("oauth_signature_method", &config.signature_method);
    params.insert("oauth_timestamp", &timestamp);
    params.insert("oauth_token", &config.token);
    params.insert("oauth_version", "1.0");

    let sig = make_oauth1_signature(method, url, &params, &config.consumer_secret, &config.token_secret);

    let mut auth_params: Vec<_> = params.into_iter().collect();
    auth_params.push(("oauth_signature", sig.as_str()));
    auth_params.sort_by(|a, b| a.0.cmp(b.0));
    let auth_parts: Vec<_> = auth_params.iter()
        .map(|(k, v)| format!("{}=\"{}\"", percent_encode(k), percent_encode(v)))
        .collect();
    Ok(format!("OAuth {}", auth_parts.join(", ")))
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], msg: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key");
    mac.update(msg.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn hmac_sha256_as_bytes(key: &[u8], msg: &str) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key");
    mac.update(msg.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

fn aws_signing_key(secret: &str, date: &str, region: &str, service: &str) -> Vec<u8> {
    let ksecret = format!("AWS4{}", secret);
    let date_key = hmac_sha256_as_bytes(ksecret.as_bytes(), date);
    let region_key = hmac_sha256_as_bytes(&date_key, region);
    let service_key = hmac_sha256_as_bytes(&region_key, service);
    hmac_sha256_as_bytes(&service_key, "aws4_request")
}

fn build_aws_v4_header(
    config: &AwsV4Auth,
    method: &str,
    url: &str,
    body: &[u8],
    content_type: &str,
) -> Result<(String, String), AppError> {
    let amz_date = chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = chrono::Utc::now().format("%Y%m%d").to_string();
    let service = &config.service;
    let region = &config.region;

    let parsed = reqwest::Url::parse(url)
        .map_err(|e| AppError::net_invalid_url(e.to_string()))?;
    let host = parsed.host_str().unwrap_or("");
    let canonical_uri = if parsed.path().is_empty() { "/" } else { parsed.path() };
    let canonical_query = parsed.query().unwrap_or("");

    let payload_hash = sha256_hex(body);

    let canonical_headers = format!(
        "content-type:{}\nhost:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n",
        content_type, host, payload_hash, amz_date
    );
    let signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date";

    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        method, canonical_uri, canonical_query, canonical_headers, signed_headers, payload_hash
    );

    let credential_scope = format!("{}/{}/{}/aws4_request", date_stamp, region, service);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        amz_date, credential_scope, sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = aws_signing_key(&config.secret_access_key, &date_stamp, region, service);
    let signature = hmac_sha256(&signing_key, &string_to_sign);

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        config.access_key_id, credential_scope, signed_headers, signature
    );

    Ok((authorization, amz_date))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = RequestSettings::default();
        assert_eq!(settings.timeout_ms, 30000);
        assert!(settings.follow_redirects);
        assert_eq!(settings.max_redirects, 10);
        assert!(settings.verify_ssl);
        assert!(settings.proxy_url.is_none());
    }

    #[test]
    fn test_build_client_default() {
        let settings = RequestSettings::default();
        let client = build_client(&settings);
        assert!(client.is_ok());
    }

    #[test]
    fn test_build_client_no_redirects() {
        let settings = RequestSettings { follow_redirects: false, ..Default::default() };
        let client = build_client(&settings);
        assert!(client.is_ok());
    }

    #[test]
    fn test_build_client_no_ssl_verify() {
        let settings = RequestSettings { verify_ssl: false, ..Default::default() };
        let client = build_client(&settings);
        assert!(client.is_ok());
    }

    #[test]
    fn test_build_client_custom_timeout() {
        let settings = RequestSettings { timeout_ms: 5000, ..Default::default() };
        let client = build_client(&settings);
        assert!(client.is_ok());
    }

    #[test]
    fn test_apply_auth_none() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::None(EmptyAuth {})),
            settings: RequestSettings::default(),
        };
        let result = apply_auth_to_config(&mut config);
        assert!(result.is_ok());
        assert!(config.headers.is_empty());
    }

    #[test]
    fn test_apply_auth_bearer() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Bearer(BearerAuth {
                token: "abc123".into(),
                prefix: "Bearer".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert_eq!(auth_header.value, "Bearer abc123");
    }

    #[test]
    fn test_apply_auth_bearer_custom_prefix() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Bearer(BearerAuth {
                token: "xyz".into(),
                prefix: "Token".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert_eq!(auth_header.value, "Token xyz");
    }

    #[test]
    fn test_apply_auth_bearer_empty_token() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![Header { key: "Authorization".into(), value: "old".into(), disabled: false }],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Bearer(BearerAuth {
                token: "".into(),
                prefix: "Bearer".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert_eq!(auth_header.value, "old");
    }

    #[test]
    fn test_apply_auth_basic() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Basic(BasicAuth {
                username: "user".into(),
                password: "pass".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert!(auth_header.value.starts_with("Basic "));
    }

    #[test]
    fn test_apply_auth_apikey_header() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::ApiKey(ApiKeyAuth {
                key: "X-API-Key".into(),
                value: "secret-key".into(),
                add_to: "header".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let header = config.headers.iter().find(|h| h.key == "X-API-Key").unwrap();
        assert_eq!(header.value, "secret-key");
    }

    #[test]
    fn test_apply_auth_apikey_query() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::ApiKey(ApiKeyAuth {
                key: "api_key".into(),
                value: "val123".into(),
                add_to: "query".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let param = config.params.iter().find(|p| p.key == "api_key").unwrap();
        assert_eq!(param.value, "val123");
    }

    #[test]
    fn test_apply_auth_jwt_presigned() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Jwt(JwtAuth {
                token: "jwt.token.here".into(),
                secret: None,
                algorithm: "HS256".into(),
                payload: None,
                expiry_seconds: None,
                prefix: "Bearer".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert_eq!(auth_header.value, "Bearer jwt.token.here");
    }

    #[test]
    fn test_apply_auth_jwt_signed() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Jwt(JwtAuth {
                token: String::new(),
                secret: Some("my-secret-key".into()),
                algorithm: "HS256".into(),
                payload: Some(r#"{"sub":"123"}"#.into()),
                expiry_seconds: Some(3600),
                prefix: "Bearer".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert!(auth_header.value.starts_with("Bearer eyJ"));
    }

    #[test]
    fn test_apply_auth_jwt_signed_custom_prefix() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::Jwt(JwtAuth {
                token: String::new(),
                secret: Some("my-secret-key".into()),
                algorithm: "HS256".into(),
                payload: Some(r#"{"sub":"456"}"#.into()),
                expiry_seconds: None,
                prefix: "JWT".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert!(auth_header.value.starts_with("JWT eyJ"));
    }

    #[test]
    fn test_sign_jwt_no_secret() {
        let jwt = JwtAuth {
            token: "pre-signed.jwt.token".into(),
            secret: None,
            algorithm: "HS256".into(),
            payload: None,
            expiry_seconds: None,
            prefix: "Bearer".into(),
        };
        let result = sign_jwt(&jwt).unwrap();
        assert_eq!(result, "pre-signed.jwt.token");
    }

    #[test]
    fn test_sign_jwt_with_secret_hs256() {
        let jwt = JwtAuth {
            token: String::new(),
            secret: Some("secret123".into()),
            algorithm: "HS256".into(),
            payload: Some(r#"{"sub":"user1"}"#.into()),
            expiry_seconds: Some(3600),
            prefix: "Bearer".into(),
        };
        let result = sign_jwt(&jwt).unwrap();
        assert!(!result.is_empty());
        assert_ne!(result, jwt.token);
        let parts: Vec<&str> = result.split('.').collect();
        assert_eq!(parts.len(), 3);
    }

    #[test]
    fn test_sign_jwt_invalid_payload_json() {
        let jwt = JwtAuth {
            token: String::new(),
            secret: Some("secret123".into()),
            algorithm: "HS256".into(),
            payload: Some("not-json".into()),
            expiry_seconds: None,
            prefix: "Bearer".into(),
        };
        let result = sign_jwt(&jwt);
        assert!(result.is_err());
    }

    #[test]
    fn test_sign_jwt_unsupported_algorithm() {
        let jwt = JwtAuth {
            token: String::new(),
            secret: Some("secret123".into()),
            algorithm: "INVALID".into(),
            payload: Some(r#"{"sub":"user1"}"#.into()),
            expiry_seconds: None,
            prefix: "Bearer".into(),
        };
        let result = sign_jwt(&jwt);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_auth_oauth2() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::OAuth2(OAuth2Auth {
                access_token: "access123".into(),
                token_type: "Bearer".into(),
                refresh_token: None,
                expires_in: None,
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert_eq!(auth_header.value, "Bearer access123");
    }

    #[test]
    fn test_apply_auth_oauth1_header() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::OAuth1(OAuth1Auth {
                consumer_key: "ck".into(),
                consumer_secret: "cs".into(),
                token: "t".into(),
                token_secret: "ts".into(),
                signature_method: "HMAC-SHA1".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert!(auth_header.value.starts_with("OAuth "));
        assert!(auth_header.value.contains("oauth_consumer_key=\"ck\""));
        assert!(auth_header.value.contains("oauth_signature=\""));
        assert!(auth_header.value.contains("oauth_signature_method=\"HMAC-SHA1\""));
        assert!(auth_header.value.contains("oauth_version=\"1.0\""));
    }

    #[test]
    fn test_apply_auth_awsv4_header() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "GET".into(),
            url: "https://example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::AwsV4(AwsV4Auth {
                access_key_id: "ak".into(),
                secret_access_key: "sk".into(),
                session_token: None,
                service: "s3".into(),
                region: "us-east-1".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert!(auth_header.value.starts_with("AWS4-HMAC-SHA256 "));
        assert!(auth_header.value.contains("Credential=ak/"));
        assert!(auth_header.value.contains("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date"));
        assert!(auth_header.value.contains("Signature="));

        let amz_date_header = config.headers.iter().find(|h| h.key == "x-amz-date").unwrap();
        assert!(amz_date_header.value.ends_with("Z"));
    }

    #[test]
    fn test_apply_auth_awsv4_with_session_token() {
        let mut config = HttpRequestConfig {
            id: "t1".into(),
            method: "PUT".into(),
            url: "https://s3.amazonaws.com/bucket/key".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: Some(AuthConfig::AwsV4(AwsV4Auth {
                access_key_id: "ak".into(),
                secret_access_key: "sk".into(),
                session_token: Some("st".into()),
                service: "s3".into(),
                region: "us-east-1".into(),
            })),
            settings: RequestSettings::default(),
        };
        apply_auth_to_config(&mut config).unwrap();
        let auth_header = config.headers.iter().find(|h| h.key == "Authorization").unwrap();
        assert!(auth_header.value.contains("/us-east-1/s3/aws4_request"));

        let st_header = config.headers.iter().find(|h| h.key == "x-amz-security-token").unwrap();
        assert_eq!(st_header.value, "st");
    }

    #[test]
    fn test_parse_set_cookie_full() {
        let cookie = parse_set_cookie(
            "session=abc123; Path=/; Domain=.example.com; HttpOnly; Secure; SameSite=Strict; Expires=Fri, 31 Dec 2027 23:59:59 GMT; Max-Age=3600",
            "example.com",
        );
        assert_eq!(cookie.domain, ".example.com");
        assert_eq!(cookie.name, "session");
        assert_eq!(cookie.value, "abc123");
        assert_eq!(cookie.path, "/");
        assert!(cookie.secure);
        assert!(cookie.http_only);
        assert_eq!(cookie.same_site, "Strict");
    }

    #[test]
    fn test_parse_set_cookie_minimal() {
        let cookie = parse_set_cookie("simple=value", "example.com");
        assert_eq!(cookie.name, "simple");
        assert_eq!(cookie.value, "value");
        assert_eq!(cookie.domain, ".example.com");
        assert_eq!(cookie.path, "/");
        assert!(!cookie.secure);
        assert!(!cookie.http_only);
        assert_eq!(cookie.same_site, "Lax");
    }

    #[test]
    fn test_parse_set_cookie_empty() {
        let cookie = parse_set_cookie("", "example.com");
        assert_eq!(cookie.name, "");
    }

    #[test]
    fn test_parse_cookie_expires_rfc1123() {
        let result = parse_cookie_expires("Fri, 31 Dec 2027 23:59:59 GMT");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_cookie_expires_invalid() {
        let result = parse_cookie_expires("not-a-date");
        assert!(result.is_err());
    }

    #[test]
    fn test_http_client_state_new() {
        let state = HttpClientState::new();
        let tokens = tokio::runtime::Runtime::new().unwrap().block_on(async {
            state.cancellation_tokens.read().await.len()
        });
        assert_eq!(tokens, 0);
    }

    #[test]
    fn test_cleanup_expired_tokens_no_panic() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let state = HttpClientState::new();
            state.cleanup_expired_tokens().await;
        });
    }
}
