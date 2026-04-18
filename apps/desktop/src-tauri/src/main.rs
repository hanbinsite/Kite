#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod storage;

use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::Manager;

pub struct AppState {
    pub storage: Arc<RwLock<Option<storage::Storage>>>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            storage: Arc::new(RwLock::new(None)),
        })
        .manage(commands::http::HttpClientState::new())
        .invoke_handler(tauri::generate_handler![
            commands::http::send_http_request,
            commands::http::cancel_http_request,
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::file_ops::delete_file,
            commands::file_ops::list_directory,
            commands::file_ops::create_directory,
        commands::history::insert_history_entry,
        commands::history::query_history_entries,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(data_dir) = app_handle.path().app_data_dir() {
                    if let Ok(storage) = storage::Storage::new(&data_dir) {
                        let state = app_handle.state::<AppState>();
                        let mut storage_lock = state.storage.write().await;
                        *storage_lock = Some(storage);
                        tracing::info!("Storage initialized at {:?}", data_dir);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}