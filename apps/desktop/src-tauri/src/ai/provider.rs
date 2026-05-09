use crate::error::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, Emitter};
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
pub struct AiChatRequest {
    pub provider_id: String,
    pub messages: Vec<AiChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
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

static ACTIVE_PROVIDER: Mutex<Option<String>> = Mutex::new(None);

fn providers_file(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
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

fn save_providers_to_file(path: &PathBuf, providers: &[AiProviderConfig]) -> Result<(), AppError> {
    let content = serde_json::to_string_pretty(providers)
        .map_err(|e| AppError::internal(format!("Failed to serialize providers: {}", e)))?;
    std::fs::write(path, content)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write providers file: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn ai_list_providers(app: tauri::AppHandle) -> Result<Vec<AiProviderConfig>, AppError> {
    let path = providers_file(&app)?;
    load_providers_from_file(&path)
}

#[tauri::command]
pub async fn ai_set_provider(app: tauri::AppHandle, provider_id: String) -> Result<(), AppError> {
    let path = providers_file(&app)?;
    let providers = load_providers_from_file(&path)?;
    if !providers.iter().any(|p| p.id == provider_id) {
        return Err(AppError::storage_not_found(format!("Provider '{}' not found", provider_id)));
    }
    {
        let mut active = ACTIVE_PROVIDER.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
        *active = Some(provider_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_add_provider(app: tauri::AppHandle, config: AiProviderConfig) -> Result<(), AppError> {
    let path = providers_file(&app)?;
    let mut providers = load_providers_from_file(&path)?;
    providers.retain(|p| p.id != config.id);
    providers.push(config);
    save_providers_to_file(&path, &providers)?;
    Ok(())
}

#[tauri::command]
pub async fn ai_remove_provider(app: tauri::AppHandle, provider_id: String) -> Result<(), AppError> {
    let path = providers_file(&app)?;
    let mut providers = load_providers_from_file(&path)?;
    providers.retain(|p| p.id != provider_id);
    save_providers_to_file(&path, &providers)?;
    Ok(())
}

#[tauri::command]
pub async fn ai_test_connection(_provider_id: String, base_url: String, model: String) -> Result<AiUsage, AppError> {
    let client = Client::new();
    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 5,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::net_connect_failed(format!("AI provider connection failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!("AI provider returned {}: {}", status, text)));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse AI response: {}", e)))?;

    Ok(AiUsage {
        prompt_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
        completion_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
        total_tokens: json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
    })
}

#[tauri::command]
pub async fn ai_chat(app: tauri::AppHandle, request: AiChatRequest) -> Result<AiChatResponse, AppError> {
    let path = providers_file(&app)?;
    let providers = load_providers_from_file(&path)?;
    let provider = providers.iter().find(|p| p.id == request.provider_id)
        .ok_or(AppError::storage_not_found(format!("Provider '{}' not found", request.provider_id)))?;

    let keyring_entry = keyring::Entry::new("api-client", &format!("ai-key-{}", provider.id))
        .map_err(|e| AppError::vault_keyring_failed(format!("Keyring error: {}", e)))?;
    let api_key = keyring_entry.get_password()
        .map_err(|e| AppError::vault_keyring_failed(format!("AI API key not found in keyring: {}", e)))?;

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
        .map_err(|e| AppError::net_connect_failed(format!("AI chat request failed: {}", e)))?;

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
    let path = providers_file(&app)?;
    let providers = load_providers_from_file(&path)?;
    let provider = providers.iter().find(|p| p.id == request.provider_id)
        .ok_or(AppError::storage_not_found(format!("Provider '{}' not found", request.provider_id)))?;

    let keyring_entry = keyring::Entry::new("api-client", &format!("ai-key-{}", provider.id))
        .map_err(|e| AppError::vault_keyring_failed(format!("Keyring error: {}", e)))?;
    let api_key = keyring_entry.get_password()
        .map_err(|e| AppError::vault_keyring_failed(format!("AI API key not found in keyring: {}", e)))?;

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
        .map_err(|e| AppError::net_connect_failed(format!("AI stream request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!("AI stream failed {}: {}", status, text)));
    }

    let session_id = uuid::Uuid::new_v4().to_string();
    let mut full_content = String::new();
    let mut stream = resp.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| AppError::internal(format!("Stream read error: {}", e)))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            let line = line.trim();
            if !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                let _ = app.emit("ai-stream-chunk", AiStreamChunk {
                    session_id: session_id.clone(),
                    delta: String::new(),
                    done: true,
                });
                return Ok(full_content);
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                    full_content.push_str(delta);
                    let _ = app.emit("ai-stream-chunk", AiStreamChunk {
                        session_id: session_id.clone(),
                        delta: delta.to_string(),
                        done: false,
                    });
                }
            }
        }
    }

    let _ = app.emit("ai-stream-chunk", AiStreamChunk {
        session_id: session_id.clone(),
        delta: String::new(),
        done: true,
    });

    Ok(full_content)
}