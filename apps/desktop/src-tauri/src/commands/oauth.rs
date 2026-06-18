use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOAuth2Args {
    pub authorization_url: String,
    pub token_url: String,
    pub client_id: String,
    #[serde(default)]
    pub client_secret: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default = "default_redirect_uri")]
    pub redirect_uri: String,
}

fn default_redirect_uri() -> String {
    "http://localhost:16111/callback".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOAuth2Result {
    pub state: String,
    pub code_verifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeOAuth2Args {
    pub token_url: String,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub code: String,
    pub code_verifier: String,
    #[serde(default = "default_redirect_uri")]
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuth2TokenResponse {
    pub access_token: String,
    pub token_type: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
}

fn generate_pkce_verifier() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..64).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn compute_code_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

#[tauri::command]
pub async fn start_oauth2_authorization(
    app: AppHandle,
    args: StartOAuth2Args,
) -> Result<StartOAuth2Result, AppError> {
    let code_verifier = generate_pkce_verifier();
    let code_challenge = compute_code_challenge(&code_verifier);
    let state = generate_state();

    let mut auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&state={}&code_challenge={}&code_challenge_method=S256",
        args.authorization_url,
        urlencoding(&args.client_id),
        urlencoding(&args.redirect_uri),
        urlencoding(&state),
        urlencoding(&code_challenge),
    );

    if let Some(ref scope) = args.scope {
        if !scope.is_empty() {
            auth_url.push_str(&format!("&scope={}", urlencoding(scope)));
        }
    }

    open::that(&auth_url).map_err(|e| AppError::internal(format!("Failed to open browser: {}", e)))?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<bool>();
    let state_clone = state.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let addr: std::net::SocketAddr = ([127, 0, 0, 1], 16111).into();
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                let _ = app_clone.emit(
                    "oauth-callback",
                    serde_json::json!({
                        "code": serde_json::Value::Null,
                        "state": state_clone,
                        "success": false,
                        "error": format!("Failed to bind callback server: {}", e),
                    }),
                );
                return;
            }
        };

        let app_emit = app_clone.clone();
        let state_emit = state_clone.clone();

        #[derive(Clone)]
        struct AppHandleWrapper(AppHandle);

        use hyper::body::Incoming;
        use hyper::service::service_fn;
        use hyper::{Request, Response};
        use hyper_util::rt::TokioIo;
        use http_body_util::Full;
        use bytes::Bytes;

        let app_w = AppHandleWrapper(app_emit.clone());
        let state_w = state_emit.clone();
        let shutdown_tx = std::sync::Arc::new(std::sync::Mutex::new(Some(shutdown_tx)));

        let shutdown_tx_clone = shutdown_tx.clone();
        let svc = service_fn(move |req: Request<Incoming>| {
            let app = app_w.0.clone();
            let state = state_w.clone();
            let tx_mut = shutdown_tx_clone.lock().unwrap().take();

            async move {
                let query = req.uri().query().unwrap_or("");
                let params: std::collections::HashMap<String, String> = query
                    .split('&')
                    .filter_map(|p| {
                        let mut parts = p.splitn(2, '=');
                        Some((
                            parts.next()?.to_string(),
                            parts.next()?.to_string(),
                        ))
                    })
                    .collect();

                let returned_state = params.get("state").cloned().unwrap_or_default();
                let code = params.get("code").cloned();

                let success = returned_state == state && code.is_some();

                if let Some(tx) = tx_mut {
                    let _ = tx.send(true);
                }

                let _ = app.emit(
                    "oauth-callback",
                    serde_json::json!({
                        "code": code,
                        "state": returned_state,
                        "success": success,
                    }),
                );

                let body = if success {
                    "<html><body><h1>Authorization Successful</h1><p>You may close this window and return to the application.</p></body></html>"
                } else {
                    "<html><body><h1>Authorization Failed</h1><p>State mismatch or missing code. You may close this window.</p></body></html>"
                };

                Ok::<_, std::convert::Infallible>(
                    Response::builder()
                        .header("Content-Type", "text/html")
                        .body(Full::new(Bytes::from(body)))
                        .unwrap(),
                )
            }
        });

        let serve_future = async {
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        let io = TokioIo::new(stream);
                        let svc = svc.clone();
                        tokio::spawn(async move {
                            let server = hyper::server::conn::http1::Builder::new();
                            let conn = server.serve_connection(io, svc);
                            let _ = conn.await;
                        });
                        break;
                    }
                    Err(_) => continue,
                }
            }
        };

        match timeout(Duration::from_secs(120), serve_future).await {
            Ok(_) => {}
            Err(_) => {
                let _ = shutdown_rx.await;
            }
        }
    });

    Ok(StartOAuth2Result { state, code_verifier })
}

#[tauri::command]
pub async fn exchange_oauth2_token(args: ExchangeOAuth2Args) -> Result<OAuth2TokenResponse, AppError> {
    let client = reqwest::Client::new();

    let mut form = vec![
        ("grant_type".to_string(), "authorization_code".to_string()),
        ("code".to_string(), args.code),
        ("client_id".to_string(), args.client_id.clone()),
        ("code_verifier".to_string(), args.code_verifier),
        ("redirect_uri".to_string(), args.redirect_uri),
    ];

    if let Some(ref secret) = args.client_secret {
        if !secret.is_empty() {
            form.push(("client_secret".to_string(), secret.clone()));
        }
    }

    let response = client
        .post(&args.token_url)
        .form(&form)
        .send()
        .await
        .map_err(|e| {
            AppError::net_connect_failed(format!("Token exchange failed for {}: {}", args.token_url, e))
        })?;

    let status = response.status();
    let body = response.text().await.map_err(|e| {
        AppError::internal(format!("Failed to read token response: {}", e))
    })?;

    if !status.is_success() {
        return Err(AppError::net_auth_failed(format!(
            "Token exchange returned {}: {}",
            status, body
        )));
    }

    #[derive(Deserialize)]
    struct TokenJson {
        access_token: Option<String>,
        token_type: Option<String>,
        refresh_token: Option<String>,
        expires_in: Option<u64>,
    }

    let token: TokenJson = serde_json::from_str(&body).map_err(|e| {
        AppError::storage_parse_failed(format!("Failed to parse token response: {}", e))
    })?;

    Ok(OAuth2TokenResponse {
        access_token: token.access_token.unwrap_or_default(),
        token_type: token.token_type,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
    })
}

fn urlencoding(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect::<String>()
}