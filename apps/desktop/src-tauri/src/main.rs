#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use api_client_lib::{AppState, commands, storage, ai, proxy};
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[tokio::main]
async fn main() {
    let file_appender = tracing_appender::rolling::daily(
        std::env::temp_dir().join("api-client-logs"),
        "api-client.log",
    );
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .json()
        .with_writer(non_blocking)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState { storage: Arc::new(Mutex::new(None)) })
        .manage(commands::http::HttpClientState::new())
        .manage(commands::websocket::WsState::new())
        .manage(commands::sse::SseState::new())
        .manage(commands::mqtt::MqttState::new())
        .manage(commands::grpc::GrpcState::new())
        .manage(commands::mock::MockState::new())
        .manage(ai::mcp_external::McpConnectionState::new())
        .invoke_handler(tauri::generate_handler![
            commands::http::send_http_request,
            commands::http::download_http_response,
            commands::http::cancel_http_request,
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::file_ops::delete_file,
            commands::file_ops::list_directory,
            commands::file_ops::create_directory,
            commands::file_ops::save_app_settings,
            commands::file_ops::load_app_settings,
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
            commands::collection::update_collection_config,
            commands::collection::update_folder_config,
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
            commands::mqtt::mqtt_unsubscribe,
            commands::mqtt::mqtt_publish,
            commands::mqtt::mqtt_disconnect,
            commands::grpc::parse_proto_file,
            commands::grpc::send_grpc_request,
            commands::grpc::reflect_grpc_services,
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
            ai::provider::ai_set_api_key,
            ai::provider::ai_get_api_key_status,
            ai::provider::ai_test_connection,
            ai::provider::ai_list_ollama_models,
            ai::provider::ai_chat,
            ai::provider::ai_stream_chat,
            ai::provider::ai_chat_with_tools,
            ai::provider::ai_save_session,
            ai::provider::ai_load_session,
            ai::provider::ai_delete_session,
            ai::mcp::list_mcp_tools,
            ai::mcp::call_mcp_tool_command,
            ai::mcp_external::mcp_list_external_servers,
            ai::mcp_external::mcp_save_external_server,
            ai::mcp_external::mcp_delete_external_server,
            ai::mcp_external::mcp_connect_server,
            ai::mcp_external::mcp_disconnect_server,
            ai::mcp_external::mcp_list_external_tools,
            ai::mcp_external::mcp_call_external_tool,
            proxy::start_proxy,
            proxy::stop_proxy,
            proxy::get_proxy_status,
            commands::oauth::start_oauth2_authorization,
            commands::oauth::exchange_oauth2_token,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(data_dir) = app_handle.path().app_data_dir() {
                    let _ = tokio::fs::create_dir_all(data_dir.join("collections")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("environments")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("vault")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("ai-sessions")).await;
                    let _ = tokio::fs::create_dir_all(data_dir.join("mcp-servers")).await;

                    if let Ok(s) = storage::Storage::new(&data_dir) {
                        let state = app_handle.state::<AppState>();
                        let mut storage_lock = state.storage.lock().expect("storage Mutex poisoned");
                        *storage_lock = Some(s);
                        tracing::info!("Storage initialized at {:?}", data_dir);
                    }

                    let app_handle2 = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
                        loop {
                            interval.tick().await;
                            app_handle2.state::<commands::http::HttpClientState>().cleanup_expired_tokens().await;
                        }
                    });

                    let log_dir = std::env::temp_dir().join("api-client-logs");
                    tauri::async_runtime::spawn(async move {
                        cleanup_old_logs(&log_dir, 7).await;
                    });
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn cleanup_old_logs(log_dir: &std::path::Path, max_age_days: u64) {
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(max_age_days * 86400));
    let Some(cutoff) = cutoff else { return };

    if let Ok(mut entries) = tokio::fs::read_dir(log_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(metadata) = entry.metadata().await {
                if metadata.is_file()
                    && metadata.modified().is_ok_and(|m| m < cutoff)
                    && entry.file_name().to_string_lossy().ends_with(".log")
                {
                    let _ = tokio::fs::remove_file(entry.path()).await;
                }
            }
        }
    }
}
