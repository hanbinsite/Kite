use std::path::Path;
use tauri::Manager;

fn validate_path_within_app_data(app_data_dir: &Path, target_path: &Path) -> Result<(), String> {
    let canonical_app = app_data_dir.canonicalize().map_err(|e| e.to_string())?;
    let canonical_target = target_path.canonicalize().map_err(|e| e.to_string())?;

    if canonical_target.starts_with(&canonical_app) {
        Ok(())
    } else {
        Err("Path traversal detected".to_string())
    }
}

pub async fn read_file(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    tokio::fs::read_to_string(&target_path).await.map_err(|e| e.to_string())
}

pub async fn write_file(
    app_handle: tauri::AppHandle,
    path: String,
    content: String,
) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    tokio::fs::write(&target_path, content).await.map_err(|e| e.to_string())
}

pub async fn delete_file(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    tokio::fs::remove_file(&target_path).await.map_err(|e| e.to_string())
}

pub async fn list_directory(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<Vec<DirEntry>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    let mut entries = Vec::new();
    let mut dir = tokio::fs::read_dir(&target_path).await.map_err(|e| e.to_string())?;

    while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_directory: file_type.is_dir(),
            is_file: file_type.is_file(),
        });
    }

    Ok(entries)
}

pub async fn create_directory(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    tokio::fs::create_dir_all(&target_path).await.map_err(|e| e.to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
}