use crate::error::AppError;
use crate::storage::{CookieEntry, HistoryEntry};
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
    let storage_lock = storage.lock().unwrap();
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
        let storage_lock = storage.lock().unwrap();
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

#[tauri::command]
pub async fn search_history_entries(
    app_handle: tauri::AppHandle,
    query: String,
    limit: i32,
) -> Result<Vec<HistoryEntry>, AppError> {
    let storage = app_handle.state::<crate::AppState>().storage.clone();
    tokio::task::spawn_blocking(move || {
        let storage_lock = storage.lock().unwrap();
        let storage = storage_lock
            .as_ref()
            .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
        storage
            .search_history(&query, limit)
            .map_err(AppError::storage_read_failed)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn delete_history_entry(
  app_handle: tauri::AppHandle,
  id: i64,
) -> Result<(), AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .delete_history(id)
      .map_err(AppError::storage_write_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn clear_history(
  app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .clear_history()
      .map_err(AppError::storage_write_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}

// --- Settings Commands ---

#[tauri::command]
pub async fn get_setting(
  app_handle: tauri::AppHandle,
  key: String,
) -> Result<Option<String>, AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .get_setting(&key)
      .map_err(AppError::storage_read_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn set_setting(
  app_handle: tauri::AppHandle,
  key: String,
  value: String,
) -> Result<(), AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .set_setting(&key, &value)
      .map_err(AppError::storage_write_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}

// --- Cookie Commands ---

#[tauri::command]
pub async fn insert_cookie(
  app_handle: tauri::AppHandle,
  cookie: CookieEntry,
) -> Result<i64, AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .insert_cookie(&cookie)
      .map_err(AppError::storage_write_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn query_cookies(
    app_handle: tauri::AppHandle,
    domain: Option<String>,
) -> Result<Vec<CookieEntry>, AppError> {
    let storage = app_handle.state::<crate::AppState>().storage.clone();
    tokio::task::spawn_blocking(move || {
        let storage_lock = storage.lock().unwrap();
        let storage = storage_lock
            .as_ref()
            .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
        storage
            .query_cookies(domain.as_deref())
            .map_err(AppError::storage_read_failed)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn delete_cookie(
  app_handle: tauri::AppHandle,
  id: i64,
) -> Result<(), AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .delete_cookie(id)
      .map_err(AppError::storage_write_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn clear_cookies(
  app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
  let storage = app_handle.state::<crate::AppState>().storage.clone();
  tokio::task::spawn_blocking(move || {
    let storage_lock = storage.lock().unwrap();
    let storage = storage_lock
      .as_ref()
      .ok_or_else(|| AppError::storage_read_failed("Storage not initialized".into()))?;
    storage
      .clear_cookies()
      .map_err(AppError::storage_write_failed)
  })
  .await
  .map_err(|e| AppError::internal(e.to_string()))?
}
