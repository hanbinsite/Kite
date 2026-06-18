use crate::error::AppError;
use crate::script::engine::{ExecuteScriptParams, ScriptResult};

#[tauri::command]
pub async fn execute_script(
    app_handle: tauri::AppHandle,
    params: ExecuteScriptParams,
) -> Result<ScriptResult, AppError> {
    let url = params.context.request.as_ref()
        .and_then(|r| r.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    let params = resolve_script_cookies_and_auth(&app_handle, params).await;
    let timeout_ms = params.timeout_ms;
    let result = tokio::task::spawn_blocking(move || {
        crate::script::engine::ScriptEngine::execute(params)
    })
    .await
    .map_err(|e| AppError::internal(format!("Script engine panicked: {}", e)))?;

    if !result.set_cookie_headers.is_empty() && !url.is_empty() {
        crate::commands::http::save_cookies_from_response_headers(
            &app_handle,
            &url,
            &result.set_cookie_headers,
        ).await;
    }

    if result.timed_out {
        return Err(AppError::script_timeout(timeout_ms.unwrap_or(5000)));
    }
    Ok(result)
}

async fn resolve_script_cookies_and_auth(
    app_handle: &tauri::AppHandle,
    mut params: ExecuteScriptParams,
) -> ExecuteScriptParams {
    use crate::commands::http::apply_auth_to_config;

    let url = params.context.request.as_ref()
        .and_then(|r| r.get("url"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if params.context.cookie_header.is_none() {
        let cookie = crate::commands::http::load_cookie_header(app_handle, url).await;
        if !cookie.is_empty() {
            params.context.cookie_header = Some(cookie);
        }
    }

    if params.context.auth_header.is_none() {
        if let Some(auth_val) = params.context.request.as_ref().and_then(|r| r.get("auth")) {
            if let Ok(auth) = serde_json::from_value::<crate::commands::http::AuthConfig>(auth_val.clone()) {
                let mut config = crate::commands::http::HttpRequestConfig {
                    id: String::new(),
                    method: params.context.request.as_ref()
                        .and_then(|r| r.get("method"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("GET").to_string(),
                    url: url.to_string(),
                    headers: vec![],
                    params: vec![],
                    body: None,
                    auth: Some(auth),
                    settings: crate::commands::http::RequestSettings {
                        timeout_ms: 30000,
                        follow_redirects: true,
                        max_redirects: 10,
                        verify_ssl: true,
                        proxy_url: None,
                    },
                };
                if apply_auth_to_config(&mut config).is_ok() {
                    if let Some(auth_h) = config.headers.iter().find(|h| h.key.to_lowercase() == "authorization") {
                        params.context.auth_header = Some(crate::script::engine::AuthHeaderEntry {
                            key: auth_h.key.clone(),
                            value: auth_h.value.clone(),
                        });
                    }
                }
            }
        }
    }

    params
}
