#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use api_client_lib::{AppState, commands, storage, ai};
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
        .manage(commands::websocket::WsState::new())
        .manage(commands::sse::SseState::new())
        .manage(commands::mqtt::MqttState::new())
        .manage(commands::grpc::GrpcState::new())
        .manage(commands::mock::MockState::new())
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
            commands::websocket::ws_connect,
            commands::websocket::ws_send,
            commands::websocket::ws_close,
            commands::sse::sse_connect,
            commands::sse::sse_disconnect,
            commands::mqtt::mqtt_connect,
            commands::mqtt::mqtt_subscribe,
            commands::mqtt::mqtt_publish,
            commands::mqtt::mqtt_disconnect,
            commands::grpc::parse_proto_file,
            commands::grpc::send_grpc_request,
            commands::mock::start_mock_server,
            commands::mock::stop_mock_server,
            commands::mock::get_mock_server_status,
            commands::mock::add_mock_route,
            commands::mock::remove_mock_route,
            commands::mock::update_mock_route,
            commands::mock::list_mock_routes,
            commands::mock::clear_mock_routes,
            commands::script::execute_script,
            commands::codegen::generate_code,
            commands::crypto::unlock_vault,
            commands::crypto::lock_vault,
            commands::crypto::is_vault_unlocked,
            commands::crypto::encrypt_vault_secret,
            commands::crypto::decrypt_vault_secret,
commands::crypto::delete_vault_secret,
            commands::crypto::list_vault_secrets,
            ai::provider::ai_list_providers,
            ai::provider::ai_set_provider,
            ai::provider::ai_add_provider,
            ai::provider::ai_remove_provider,
            ai::provider::ai_test_connection,
            ai::provider::ai_chat,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(data_dir) = app_handle.path().app_data_dir() {
                    let _ = tokio::fs::create_dir_all(data_dir.join("collections")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("environments")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("vault")).await;

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
