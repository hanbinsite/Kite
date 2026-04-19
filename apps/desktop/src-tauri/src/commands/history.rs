use crate::error::AppError;
use crate::storage::HistoryEntry;
use serde::Deserialize;
use tauri::Manager;

#[derive(Debug, Clone, Deserialize)]
pub struct InsertHistoryRequest {
    pub method: String,
    pub url: String,
    pub status: i32,
    pub duration: i32,
}

#[tauri::command]
pub async fn insert_history_entry(
    app_handle: tauri::AppHandle,
    request: InsertHistoryRequest,
) -> Result<i64, AppError> {
    let storage = app_handle.state::<crate::AppState>().storage.clone();
    tokio::task::spawn_blocking(move || {
        let storage_lock = storage.blocking_read();
        let storage = storage_lock
            .as_ref()
            .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
        storage
            .insert_history(&request.method, &request.url, request.status, request.duration)
            .map_err(AppError::storage_write_failed)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn query_history_entries(
    app_handle: tauri::AppHandle,
    limit: i32,
) -> Result<Vec<HistoryEntry>, AppError> {
    let storage = app_handle.state::<crate::AppState>().storage.clone();
    tokio::task::spawn_blocking(move || {
        let storage_lock = storage.blocking_read();
        let storage = storage_lock
            .as_ref()
            .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
        storage
            .query_history(limit)
            .map_err(AppError::storage_read_failed)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}
