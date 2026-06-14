use std::path::Path;
use tauri::Manager;

use crate::error::AppError;

#[tauri::command]
pub async fn save_app_settings(app: tauri::AppHandle, settings: String) -> Result<(), AppError> {
    let data_dir = app.path().app_data_dir().map_err(|e| AppError::internal(format!("Cannot get app data dir: {}", e)))?;
    std::fs::write(data_dir.join("settings.json"), &settings)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to save settings: {}", e)))
}

#[tauri::command]
pub async fn load_app_settings(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    let data_dir = app.path().app_data_dir().map_err(|e| AppError::internal(format!("Cannot get app data dir: {}", e)))?;
    let path = data_dir.join("settings.json");
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to load settings: {}", e)))
}

pub fn validate_path_within_app_data(app_data_dir: &Path, target_path: &Path) -> Result<(), AppError> {
    let canonical_app = app_data_dir.canonicalize().map_err(|e| AppError::internal(format!("Cannot resolve app data dir: {}", e)))?;
    let target_normalized = target_path.to_path_buf();
    let canonical_target = if target_path.exists() {
        target_path.canonicalize().map_err(|e| AppError::internal(format!("Cannot resolve target path: {}", e)))?
    } else {
        if let Some(parent) = target_path.parent() {
            if parent.exists() {
                let canonical_parent = parent.canonicalize().map_err(|e| AppError::internal(format!("Cannot resolve parent: {}", e)))?;
                if let Some(file_name) = target_path.file_name() {
                    canonical_parent.join(file_name)
                } else {
                    canonical_parent
                }
            } else {
                let mut current = target_path.to_path_buf();
                let mut suffix_parts: Vec<std::ffi::OsString> = Vec::new();
                while !current.exists() && current != app_data_dir {
                    if let Some(file_name) = current.file_name() {
                        suffix_parts.push(file_name.to_os_string());
                    }
                    current = current.parent().unwrap_or(app_data_dir).to_path_buf();
                }
                let canonical_current = current.canonicalize().map_err(|e| AppError::internal(format!("Cannot resolve: {}", e)))?;
                let mut result = canonical_current;
                for part in suffix_parts.iter().rev() {
                    result = result.join(part);
                }
                result
            }
        } else {
            canonical_app.join(target_path)
        }
    };
    if canonical_target.starts_with(&canonical_app) {
        Ok(())
    } else {
        Err(AppError::storage_path_traversal(format!("Path traversal detected: target {} is outside app data dir {}", target_normalized.display(), canonical_app.display())))
    }
}

#[tauri::command]
pub async fn read_file(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<String, AppError> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    tokio::fs::read_to_string(&target_path).await.map_err(|e| AppError::storage_read_failed(e.to_string()))
}

#[tauri::command]
pub async fn write_file(
    app_handle: tauri::AppHandle,
    path: String,
    content: String,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    }

    tokio::fs::write(&target_path, content).await.map_err(|e| AppError::storage_write_failed(e.to_string()))
}

#[tauri::command]
pub async fn delete_file(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    tokio::fs::remove_file(&target_path).await.map_err(|e| AppError::storage_write_failed(e.to_string()))
}

#[tauri::command]
pub async fn list_directory(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<Vec<DirEntry>, AppError> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    let mut entries = Vec::new();
    let mut dir = tokio::fs::read_dir(&target_path).await.map_err(|e| AppError::storage_read_failed(e.to_string()))?;

    while let Some(entry) = dir.next_entry().await.map_err(|e| AppError::storage_read_failed(e.to_string()))? {
        let file_type = entry.file_type().await.map_err(|e| AppError::storage_read_failed(e.to_string()))?;
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_directory: file_type.is_dir(),
            is_file: file_type.is_file(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub async fn create_directory(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let target_path = app_data_dir.join(&path);

    validate_path_within_app_data(&app_data_dir, &target_path)?;

    tokio::fs::create_dir_all(&target_path).await.map_err(|e| AppError::storage_write_failed(e.to_string()))
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
}

#[cfg(test)]
mod tests {
    use super::validate_path_within_app_data;
    use std::path::PathBuf;

    fn setup_dirs() -> (PathBuf, PathBuf) {
        let dir = tempfile::TempDir::new().unwrap();
        let app_data = dir.path().to_path_buf();
        std::fs::create_dir_all(app_data.join("subdir")).unwrap();
        std::fs::write(app_data.join("test.txt"), "hello").unwrap();
        std::fs::write(app_data.join("subdir/nested.txt"), "nested").unwrap();
        (app_data, dir.keep())
    }

    #[test]
    fn test_valid_paths() {
        let (app_data, _) = setup_dirs();

        assert!(validate_path_within_app_data(&app_data, &app_data.join("test.txt")).is_ok());
        assert!(validate_path_within_app_data(&app_data, &app_data.join("subdir")).is_ok());
        assert!(validate_path_within_app_data(&app_data, &app_data.join("subdir/nested.txt")).is_ok());
        assert!(validate_path_within_app_data(&app_data, &app_data.join("newfile.txt")).is_ok());
        assert!(validate_path_within_app_data(&app_data, &app_data.join("newdir/newfile.txt")).is_ok());
    }

    #[test]
    fn test_path_traversal_blocked() {
        let (app_data, _) = setup_dirs();

        let traversal = app_data.join("../../etc/passwd");
        let canonical_app = app_data.canonicalize().unwrap();
        let result = validate_path_within_app_data(&canonical_app, &traversal);
        assert!(result.is_err());
        if let Err(e) = result {
            assert!(e.code == "STORAGE_PATH_TRAVERSAL" || e.code == "INTERNAL");
        }
    }

    #[test]
    fn test_path_within_works_for_nonexistent_deep_paths() {
        let (app_data, _) = setup_dirs();
        let canonical_app = app_data.canonicalize().unwrap();

        let deep_new = canonical_app.join("collections").join("col-123").join("collection.json");
        assert!(validate_path_within_app_data(&canonical_app, &deep_new).is_ok());
    }
}