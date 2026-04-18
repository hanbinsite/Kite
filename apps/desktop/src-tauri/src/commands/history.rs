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
    let state = app_handle.state::<crate::AppState>();
    let storage_lock = state.storage.read().await;
    let storage = storage_lock
        .as_ref()
        .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;

    storage
        .insert_history(&request.method, &request.url, request.status, request.duration)
        .map_err(|e| AppError::storage_write_failed(e))
}

#[tauri::command]
pub async fn query_history_entries(
    app_handle: tauri::AppHandle,
    limit: i32,
) -> Result<Vec<HistoryEntry>, AppError> {
    let state = app_handle.state::<crate::AppState>();
    let storage_lock = state.storage.read().await;
    let storage = storage_lock
        .as_ref()
        .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;

    storage
        .query_history(limit)
        .map_err(|e| AppError::storage_read_failed(e))
}
