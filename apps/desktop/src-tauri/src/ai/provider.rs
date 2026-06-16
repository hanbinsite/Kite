use crate::error::AppError;
use crate::emit_warn;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, RwLock};
use tauri::Manager;
use futures_util::StreamExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatWithToolsRequest {
    pub provider_id: String,
    pub messages: Vec<AiChatMessage>,
    pub tools: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiToolCallResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: AiToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatWithToolsResponse {
    pub id: String,
    pub content: Option<String>,
    pub model: String,
    pub tool_calls: Vec<AiToolCallResponse>,
    pub usage: AiUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub provider_id: String,
    pub messages: Vec<AiChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub id: String,
    pub content: String,
    pub model: String,
    pub usage: AiUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamChunk {
    pub session_id: String,
    pub delta: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiApiKeyStatus {
    pub has_key: bool,
}

static ACTIVE_PROVIDER: Mutex<Option<String>> = Mutex::new(None);
static PROVIDERS_CACHE: RwLock<Option<Vec<AiProviderConfig>>> = RwLock::new(None);

fn providers_file(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to create app data dir: {}", e)))?;
    Ok(data_dir.join("ai-providers.json"))
}

fn load_providers_from_file(path: &PathBuf) -> Result<Vec<AiProviderConfig>, AppError> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read providers file: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse providers file: {}", e)))
}

fn active_provider_file(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    Ok(data_dir.join("ai-active-provider.txt"))
}

fn load_active_provider(app: &tauri::AppHandle) -> Result<Option<String>, AppError> {
    let path = active_provider_file(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read active provider: {}", e)))?;
    Ok(Some(content.trim().to_string()).filter(|s| !s.is_empty()))
}

fn save_active_provider(app: &tauri::AppHandle, provider_id: &str) -> Result<(), AppError> {
    let path = active_provider_file(app)?;
    std::fs::write(&path, provider_id)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to save active provider: {}", e)))?;
    Ok(())
}

fn load_providers_cached(app: &tauri::AppHandle) -> Result<Vec<AiProviderConfig>, AppError> {
    if let Some(cached) = PROVIDERS_CACHE.read().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?.as_ref() {
        return Ok(cached.clone());
    }
    let path = providers_file(app)?;
    let providers = load_providers_from_file(&path)?;
    let mut cache = PROVIDERS_CACHE.write().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    *cache = Some(providers.clone());
    Ok(providers)
}

fn invalidate_providers_cache() {
    if let Ok(mut cache) = PROVIDERS_CACHE.write() {
        *cache = None;
    }
}

fn save_providers_to_file(path: &PathBuf, providers: &[AiProviderConfig]) -> Result<(), AppError> {
    let content = serde_json::to_string_pretty(providers)
        .map_err(|e| AppError::internal(format!("Failed to serialize providers: {}", e)))?;
    std::fs::write(path, content)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write providers file: {}", e)))?;
    Ok(())
}

fn api_keys_file(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    Ok(data_dir.join("ai-api-keys.json"))
}

fn load_api_keys(app: &tauri::AppHandle) -> Result<std::collections::HashMap<String, String>, AppError> {
    let path = api_keys_file(app)?;
    if !path.exists() {
        return Ok(std::collections::HashMap::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read keys: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse keys: {}", e)))
}

fn save_api_keys(app: &tauri::AppHandle, keys: &std::collections::HashMap<String, String>) -> Result<(), AppError> {
    let path = api_keys_file(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::storage_write_failed(format!("Failed to create dir: {}", e)))?;
    }
    let content = serde_json::to_string_pretty(keys)
        .map_err(|e| AppError::internal(format!("Failed to serialize keys: {}", e)))?;
    std::fs::write(&path, content)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write keys: {}", e)))?;
    Ok(())
}

fn get_api_key(app: &tauri::AppHandle, provider_id: &str) -> Result<String, AppError> {
    let keys = load_api_keys(app)?;
    keys.get(provider_id)
        .cloned()
        .ok_or_else(|| AppError::vault_keyring_failed(format!("AI API key not found for '{}'", provider_id)))
}

fn delete_api_key(app: &tauri::AppHandle, provider_id: &str) -> Result<(), AppError> {
    let mut keys = load_api_keys(app)?;
    keys.remove(provider_id);
    save_api_keys(app, &keys)
}

#[tauri::command]
pub async fn ai_list_providers(app: tauri::AppHandle) -> Result<Vec<AiProviderConfig>, AppError> {
    let providers = load_providers_cached(&app)?;
    // On first load, restore active provider from disk
    if ACTIVE_PROVIDER.lock().ok().and_then(|a| a.clone()).is_none() {
        if let Ok(Some(id)) = load_active_provider(&app) {
            if providers.iter().any(|p| p.id == id) {
                if let Ok(mut active) = ACTIVE_PROVIDER.lock() {
                    *active = Some(id);
                }
            }
        }
    }
    Ok(providers)
}

#[tauri::command]
pub async fn ai_set_provider(app: tauri::AppHandle, provider_id: String) -> Result<(), AppError> {
    let providers = load_providers_cached(&app)?;
    if !providers.iter().any(|p| p.id == provider_id) {
        return Err(AppError::storage_not_found(format!("Provider '{}' not found", provider_id)));
    }
    {
        let mut active = ACTIVE_PROVIDER.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
        *active = Some(provider_id.clone());
    }
    save_active_provider(&app, &provider_id)?;
    Ok(())
}

#[tauri::command]
pub async fn ai_add_provider(app: tauri::AppHandle, config: AiProviderConfig) -> Result<(), AppError> {
    let path = providers_file(&app)?;
    let mut providers = load_providers_from_file(&path)?;
    providers.retain(|p| p.id != config.id);
    providers.push(config);
    save_providers_to_file(&path, &providers)?;
    invalidate_providers_cache();
    Ok(())
}

#[tauri::command]
pub async fn ai_remove_provider(app: tauri::AppHandle, provider_id: String) -> Result<(), AppError> {
    let path = providers_file(&app)?;
    let mut providers = load_providers_from_file(&path)?;
    providers.retain(|p| p.id != provider_id);
    save_providers_to_file(&path, &providers)?;
    invalidate_providers_cache();
    let _ = delete_api_key(&app, &provider_id);
    Ok(())
}

#[tauri::command]
pub async fn ai_set_api_key(app: tauri::AppHandle, provider_id: String, api_key: String) -> Result<(), AppError> {
    let mut keys = load_api_keys(&app)?;
    keys.insert(provider_id.clone(), api_key);
    save_api_keys(&app, &keys)?;
    Ok(())
}

#[tauri::command]
pub async fn ai_get_api_key_status(app: tauri::AppHandle, provider_id: String) -> Result<AiApiKeyStatus, AppError> {
    let keys = load_api_keys(&app)?;
    Ok(AiApiKeyStatus { has_key: keys.contains_key(&provider_id) })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTestResult {
    pub usage: AiUsage,
    pub model: String,
    pub response_content: String,
}

#[tauri::command]
pub async fn ai_test_connection(app: tauri::AppHandle, provider_id: String, base_url: String, model: String) -> Result<AiTestResult, AppError> {
    let providers = load_providers_cached(&app)?;
    let provider = providers.iter().find(|p| p.id == provider_id);

    let client = Client::new();
    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "Say hi"}],
        "max_tokens": 50,
    });

    let mut req = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10));

    if let Some(p) = provider {
        if let Ok(api_key) = get_api_key(&app, &p.id) {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }
    }

    let mut used_key = false;
    match provider {
        None => {
            let path = providers_file(&app)?;
            let fresh = load_providers_from_file(&path)?;
            let fresh_provider = fresh.iter().find(|p| p.id == provider_id);
            if let Some(p) = fresh_provider {
                match get_api_key(&app, &p.id) {
                    Ok(api_key) => {
                        req = req.header("Authorization", format!("Bearer {}", api_key));
                        used_key = true;
                    }
                    Err(e) => eprintln!("[AI TEST] Key not found for '{}': {}", p.id, e),
                }
            }
        }
        Some(p) => {
            match get_api_key(&app, &p.id) {
                Ok(api_key) => {
                    req = req.header("Authorization", format!("Bearer {}", api_key));
                    used_key = true;
                }
                Err(e) => eprintln!("[AI TEST] Key not found for '{}': {}", p.id, e),
            }
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("AI provider connection", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let hint = if !used_key { " (No API key found in keyring. Click 'No Key' in settings to set a new key.)" } else { " (API key was used)" };
        return Err(AppError::net_auth_failed(format!("AI provider returned {}{}: {}", status, hint, text)));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse AI response: {}", e)))?;

    let response_content = json["choices"][0]["message"]["content"]
        .as_str().unwrap_or("").to_string();
    let response_model = json["model"].as_str().unwrap_or(&model).to_string();

    Ok(AiTestResult {
        usage: AiUsage {
            prompt_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        },
        model: response_model,
        response_content,
    })
}

#[tauri::command]
pub async fn ai_chat(app: tauri::AppHandle, request: AiChatRequest) -> Result<AiChatResponse, AppError> {
    let providers = load_providers_cached(&app)?;
    let provider = providers.iter().find(|p| p.id == request.provider_id)
        .ok_or(AppError::storage_not_found(format!("Provider '{}' not found", request.provider_id)))?;

    let api_key = get_api_key(&app, &provider.id)?;

    let client = Client::new();
    let url = format!("{}/v1/chat/completions", provider.base_url.trim_end_matches('/'));

    let messages_json: Vec<serde_json::Value> = request.messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": m.content})
    }).collect();

    let body = serde_json::json!({
        "model": provider.model,
        "messages": messages_json,
        "temperature": request.temperature.or(provider.temperature).unwrap_or(0.7),
        "max_tokens": request.max_tokens.or(provider.max_tokens).unwrap_or(2048),
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("AI chat request", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!("AI chat failed {}: {}", status, text)));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse AI response: {}", e)))?;

    let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
    let model = json["model"].as_str().unwrap_or(&provider.model).to_string();

    Ok(AiChatResponse {
        id: json["id"].as_str().unwrap_or_default().to_string(),
        content,
        model,
        usage: AiUsage {
            prompt_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        },
    })
}

#[tauri::command]
pub async fn ai_stream_chat(app: tauri::AppHandle, request: AiChatRequest) -> Result<String, AppError> {
    let providers = load_providers_cached(&app)?;
    let provider = providers.iter().find(|p| p.id == request.provider_id)
        .ok_or(AppError::storage_not_found(format!("Provider '{}' not found", request.provider_id)))?;

    let api_key = get_api_key(&app, &provider.id)?;

    let client = Client::new();
    let url = format!("{}/v1/chat/completions", provider.base_url.trim_end_matches('/'));

    let messages_json: Vec<serde_json::Value> = request.messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": m.content})
    }).collect();

    let body = serde_json::json!({
        "model": provider.model,
        "messages": messages_json,
        "temperature": request.temperature.or(provider.temperature).unwrap_or(0.7),
        "max_tokens": request.max_tokens.or(provider.max_tokens).unwrap_or(2048),
        "stream": true,
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("AI stream request", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!("AI stream failed {}: {}", status, text)));
    }

    let session_id = request.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut full_content = String::new();
    let mut line_buf = String::new();
    let mut stream = resp.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| AppError::internal(format!("Stream read error: {}", e)))?;
        line_buf.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = line_buf.find('\n') {
            let line = line_buf[..newline_pos].trim().to_string();
            line_buf = line_buf[newline_pos + 1..].to_string();

            let Some(data) = line.strip_prefix("data: ") else {
                continue;
            };
            if data == "[DONE]" {
                emit_warn(&app, "ai-stream-chunk", AiStreamChunk {
                    session_id: session_id.clone(),
                    delta: String::new(),
                    done: true,
                });
                return Ok(full_content);
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                    full_content.push_str(delta);
                    emit_warn(&app, "ai-stream-chunk", AiStreamChunk {
                        session_id: session_id.clone(),
                        delta: delta.to_string(),
                        done: false,
                    });
                }
            }
        }
    }

    if !line_buf.trim().is_empty() {
        let line = line_buf.trim();
        if let Some(data) = line.strip_prefix("data: ") {
            if data == "[DONE]" {
                emit_warn(&app, "ai-stream-chunk", AiStreamChunk {
                    session_id: session_id.clone(),
                    delta: String::new(),
                    done: true,
                });
                return Ok(full_content);
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                    full_content.push_str(delta);
                    emit_warn(&app, "ai-stream-chunk", AiStreamChunk {
                        session_id: session_id.clone(),
                        delta: delta.to_string(),
                        done: false,
                    });
                }
            }
        }
    }

    emit_warn(&app, "ai-stream-chunk", AiStreamChunk {
        session_id: session_id.clone(),
        delta: String::new(),
        done: true,
    });

    Ok(full_content)
}

fn validate_session_id(session_id: &str) -> Result<(), AppError> {
    if session_id.contains('/') || session_id.contains('\\') || session_id.contains("..") {
        return Err(AppError::storage_path_traversal(format!("Invalid session ID: {}", session_id)));
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_save_session(app: tauri::AppHandle, session_id: String, messages: Vec<AiChatMessage>) -> Result<(), AppError> {
    validate_session_id(&session_id)?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    let sessions_dir = data_dir.join("ai-sessions");
    std::fs::create_dir_all(&sessions_dir)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to create sessions dir: {}", e)))?;
    let path = sessions_dir.join(format!("{}.json", session_id));
    let content = serde_json::to_string_pretty(&messages)
        .map_err(|e| AppError::internal(format!("Failed to serialize session: {}", e)))?;
    std::fs::write(&path, content)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write session: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn ai_load_session(app: tauri::AppHandle, session_id: String) -> Result<Vec<AiChatMessage>, AppError> {
    validate_session_id(&session_id)?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    let path = data_dir.join("ai-sessions").join(format!("{}.json", session_id));
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read session: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse session: {}", e)))
}

#[tauri::command]
pub async fn ai_delete_session(app: tauri::AppHandle, session_id: String) -> Result<(), AppError> {
    validate_session_id(&session_id)?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    let path = data_dir.join("ai-sessions").join(format!("{}.json", session_id));
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| AppError::storage_write_failed(format!("Failed to delete session: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_chat_with_tools(app: tauri::AppHandle, request: AiChatWithToolsRequest) -> Result<AiChatWithToolsResponse, AppError> {
    let providers = load_providers_cached(&app)?;
    let provider = providers.iter().find(|p| p.id == request.provider_id)
        .ok_or(AppError::storage_not_found(format!("Provider '{}' not found", request.provider_id)))?;

    let api_key = get_api_key(&app, &provider.id)?;

    let client = Client::new();
    let url = format!("{}/v1/chat/completions", provider.base_url.trim_end_matches('/'));

    let messages_json: Vec<serde_json::Value> = request.messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": m.content})
    }).collect();

    let body = serde_json::json!({
        "model": provider.model,
        "messages": messages_json,
        "temperature": provider.temperature.unwrap_or(0.7),
        "max_tokens": provider.max_tokens.unwrap_or(4096),
        "tools": request.tools,
        "tool_choice": "auto",
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("AI chat with tools", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!("AI chat failed {}: {}", status, text)));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse AI response: {}", e)))?;

    let choice = &json["choices"][0];
    let message = &choice["message"];
    let content = message["content"].as_str().map(|s| s.to_string());

    let tool_calls: Vec<AiToolCallResponse> = message["tool_calls"]
        .as_array()
        .map(|arr| {
            arr.iter().map(|tc| AiToolCallResponse {
                id: tc["id"].as_str().unwrap_or_default().to_string(),
                call_type: tc["type"].as_str().unwrap_or("function").to_string(),
                function: AiToolCallFunction {
                    name: tc["function"]["name"].as_str().unwrap_or_default().to_string(),
                    arguments: tc["function"]["arguments"].as_str().unwrap_or("{}").to_string(),
                },
            }).collect()
        })
        .unwrap_or_default();

    Ok(AiChatWithToolsResponse {
        id: json["id"].as_str().unwrap_or_default().to_string(),
        content,
        model: json["model"].as_str().unwrap_or(&provider.model).to_string(),
        tool_calls,
        usage: AiUsage {
            prompt_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        },
    })
}
