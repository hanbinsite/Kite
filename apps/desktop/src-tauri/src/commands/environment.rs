use crate::error::AppError;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentFile {
    pub id: String,
    pub name: String,
    pub variables: Vec<EnvironmentVariable>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentSummary {
    pub id: String,
    pub name: String,
    pub variable_count: usize,
    pub updated_at: String,
}

#[tauri::command]
pub async fn list_environments(
    app_handle: tauri::AppHandle,
) -> Result<Vec<EnvironmentSummary>, AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let env_dir = app_data_dir.join("environments");

    if !env_dir.exists() {
        return Ok(Vec::new());
    }

    let mut summaries = Vec::new();
    let mut entries = tokio::fs::read_dir(&env_dir).await
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;

    while let Some(entry) = entries.next_entry().await
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?
    {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let content = tokio::fs::read_to_string(&path).await
            .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
        let env: EnvironmentFile = serde_json::from_str(&content)
            .map_err(|e| AppError::internal(format!("Failed to parse environment: {}", e)))?;
        summaries.push(EnvironmentSummary {
            id: env.id,
            name: env.name,
            variable_count: env.variables.len(),
            updated_at: env.updated_at,
        });
    }

    Ok(summaries)
}

#[tauri::command]
pub async fn get_environment(
    app_handle: tauri::AppHandle,
    environment_id: String,
) -> Result<EnvironmentFile, AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let path = app_data_dir.join("environments").join(format!("{}.json", environment_id));

    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    let content = tokio::fs::read_to_string(&path).await
        .map_err(|e| AppError::storage_read_failed(format!("Environment not found: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::internal(format!("Failed to parse environment: {}", e)))
}

#[tauri::command]
pub async fn save_environment(
    app_handle: tauri::AppHandle,
    environment: EnvironmentFile,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let dir = app_data_dir.join("environments");
    let path = dir.join(format!("{}.json", environment.id));

    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;

    let content = serde_json::to_string_pretty(&environment)
        .map_err(|e| AppError::internal(e.to_string()))?;

    let tmp_path = path.with_extension("json.tmp");
    tokio::fs::write(&tmp_path, &content).await
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    tokio::fs::rename(&tmp_path, &path).await
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_environment(
    app_handle: tauri::AppHandle,
    environment_id: String,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let path = app_data_dir.join("environments").join(format!("{}.json", environment_id));

    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    if path.exists() {
        tokio::fs::remove_file(&path).await
            .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    }
    Ok(())
}
