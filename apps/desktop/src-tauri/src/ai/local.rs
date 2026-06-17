use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct LocalAiConfig {
    pub model_path: String,
    pub port: u16,
}

impl LocalAiConfig {
    pub fn new(model_path: String, port: u16) -> Self {
        Self { model_path, port }
    }
}

pub async fn test_ollama_connection(base_url: &str, model: &str) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "Say hi"}],
        "stream": false,
        "options": { "num_predict": 10 }
    });

    let resp = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("Ollama connection", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!(
            "Ollama returned {}: {}",
            status,
            &text[..200.min(text.len())]
        )));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse Ollama response: {}", e)))?;

    let content = json["message"]["content"]
        .as_str()
        .unwrap_or("no content");

    Ok(format!("Connected to Ollama: {}", content))
}

pub async fn list_ollama_models(base_url: &str) -> Result<Vec<String>, AppError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));

    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("Ollama list models", e))?;

    if !resp.status().is_success() {
        return Err(AppError::net_auth_failed("Failed to list Ollama models".into()));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse Ollama response: {}", e)))?;

    let models = json["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

pub async fn ollama_chat(
    base_url: &str,
    model: &str,
    messages: &[serde_json::Value],
) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("Ollama chat", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!(
            "Ollama returned {}: {}",
            status,
            &text[..200.min(text.len())]
        )));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| AppError::internal(format!("Failed to parse Ollama response: {}", e)))?;

    json["message"]["content"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| AppError::internal("No content in Ollama response".into()))
}

pub async fn ollama_stream_chat(
    base_url: &str,
    model: &str,
    messages: &[serde_json::Value],
) -> Result<reqwest::Response, AppError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("Ollama stream chat", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::net_auth_failed(format!(
            "Ollama returned {}: {}",
            status,
            &text[..200.min(text.len())]
        )));
    }

    Ok(resp)
}