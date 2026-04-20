#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use api_client_lib::{AppState, commands, storage};
use tokio::sync::RwLock;
use std::sync::Arc;
use tauri::Manager;

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
        .manage(AppState { storage: Arc::new(RwLock::new(None)) })
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
            commands::history::search_history_entries,
            commands::history::delete_history_entry,
            commands::history::clear_history,
            commands::history::get_setting,
            commands::history::set_setting,
            commands::history::insert_cookie,
            commands::history::query_cookies,
            commands::history::delete_cookie,
            commands::history::clear_cookies,
            commands::collection::list_collections,
            commands::collection::get_collection,
            commands::collection::save_collection,
            commands::collection::delete_collection,
            commands::environment::list_environments,
            commands::environment::get_environment,
            commands::environment::save_environment,
            commands::environment::delete_environment,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(data_dir) = app_handle.path().app_data_dir() {
                    let _ = tokio::fs::create_dir_all(data_dir.join("collections")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("environments")).await;

                    if let Ok(s) = storage::Storage::new(&data_dir) {
                        let state = app_handle.state::<AppState>();
                        let mut storage_lock = state.storage.write().await;
                        *storage_lock = Some(s);
                        tracing::info!("Storage initialized at {:?}", data_dir);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
