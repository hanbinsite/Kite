pub mod engine;
pub mod types;

use std::path::{Path, PathBuf};

use tauri::Manager;
use types::{
    PluginHookContext, PluginHookResult, PluginInfo, PluginManifest,
};

use crate::commands::file_ops::validate_path_within_app_data;
use crate::error::AppError;

const PLUGINS_DIR: &str = "plugins";
const MANIFEST_FILE: &str = "manifest.json";
const ENABLED_FILE: &str = ".enabled";

fn plugins_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(PLUGINS_DIR)
}

fn plugin_dir(app_data_dir: &Path, plugin_id: &str) -> PathBuf {
    plugins_root(app_data_dir).join(plugin_id)
}

fn validate_plugin_id(plugin_id: &str) -> Result<(), AppError> {
    if plugin_id.is_empty()
        || plugin_id.contains('/')
        || plugin_id.contains('\\')
        || plugin_id.contains("..")
        || plugin_id == "."
    {
        return Err(AppError::invalid_input(format!(
            "Invalid plugin id: {}",
            plugin_id
        )));
    }
    Ok(())
}

fn validate_plugins_path(app_data_dir: &Path, target: &Path) -> Result<(), AppError> {
    validate_path_within_app_data(&app_data_dir.join(PLUGINS_DIR), target)
}

fn read_enabled_state(plugin_path: &Path) -> bool {
    match std::fs::read_to_string(plugin_path.join(ENABLED_FILE)) {
        Ok(content) => content.trim() == "true",
        Err(_) => true,
    }
}

fn load_plugin_info(plugin_path: &Path) -> Option<PluginInfo> {
    let manifest_path = plugin_path.join(MANIFEST_FILE);
    let manifest_str = std::fs::read_to_string(&manifest_path).ok()?;
    match serde_json::from_str::<PluginManifest>(&manifest_str) {
        Ok(manifest) => {
            let enabled = read_enabled_state(plugin_path);
            Some(PluginInfo {
                manifest,
                enabled,
                has_error: false,
                error: None,
            })
        }
        Err(e) => {
            let fallback = PluginManifest {
                id: plugin_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                name: plugin_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                version: "0.0.0".to_string(),
                description: String::new(),
                author: None,
                entry: String::new(),
                permissions: vec![],
                hooks: vec![],
                commands: vec![],
            };
            Some(PluginInfo {
                manifest: fallback,
                enabled: read_enabled_state(plugin_path),
                has_error: true,
                error: Some(format!("Invalid manifest: {}", e)),
            })
        }
    }
}

fn read_entry_code(app_data_dir: &Path, plugin_id: &str) -> Result<String, AppError> {
    validate_plugin_id(plugin_id)?;
    let plugin_path = plugin_dir(app_data_dir, plugin_id);
    validate_plugins_path(app_data_dir, &plugin_path)?;

    let manifest_str = std::fs::read_to_string(plugin_path.join(MANIFEST_FILE))
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read manifest: {}", e)))?;
    let manifest: PluginManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse manifest: {}", e)))?;

    if manifest.entry.is_empty() {
        return Err(AppError::invalid_input("Plugin manifest has empty entry".into()));
    }

    let entry_path = plugin_path.join(&manifest.entry);
    validate_plugins_path(app_data_dir, &entry_path)?;

    std::fs::read_to_string(&entry_path)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read entry file: {}", e)))
}

#[tauri::command]
pub async fn plugin_list(app_handle: tauri::AppHandle) -> Result<Vec<PluginInfo>, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let root = plugins_root(&app_data_dir);

    if !root.exists() {
        return Ok(Vec::new());
    }

    let root_clone = root.clone();
    let mut entries = tokio::task::spawn_blocking(move || {
        let mut out = Vec::new();
        if let Ok(read_dir) = std::fs::read_dir(&root_clone) {
            for entry in read_dir.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    if let Some(info) = load_plugin_info(&entry.path()) {
                        out.push(info);
                    }
                }
            }
        }
        out
    })
    .await
    .map_err(|e| AppError::internal(format!("Failed to scan plugins: {}", e)))?;

    entries.sort_by(|a, b| a.manifest.id.cmp(&b.manifest.id));
    Ok(entries)
}

#[tauri::command]
pub async fn plugin_install(
    app_handle: tauri::AppHandle,
    zip_path: String,
) -> Result<PluginInfo, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let root = plugins_root(&app_data_dir);

    tokio::fs::create_dir_all(&root)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to create plugins dir: {}", e)))?;

    let zip_path_std = PathBuf::from(&zip_path);
    let file = std::fs::File::open(&zip_path_std)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to open zip: {}", e)))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::invalid_input(format!("Invalid zip archive: {}", e)))?;

    let manifest_entry_idx = (0..archive.len())
        .find_map(|i| {
            let entry = archive.by_index(i).ok()?;
            let name = entry.name().to_string();
            let stripped = name
                .trim_end_matches('/')
                .rsplit('/')
                .next()?
                .to_string();
            if stripped == MANIFEST_FILE {
                Some(i)
            } else {
                None
            }
        })
        .ok_or_else(|| AppError::invalid_input("Zip does not contain manifest.json".into()))?;

    let manifest_str = {
        let mut entry = archive
            .by_index(manifest_entry_idx)
            .map_err(|e| AppError::storage_read_failed(format!("Failed to read manifest entry: {}", e)))?;
        let mut buf = String::new();
        use std::io::Read;
        entry
            .read_to_string(&mut buf)
            .map_err(|e| AppError::storage_read_failed(format!("Failed to read manifest: {}", e)))?;
        buf
    };

    let manifest: PluginManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse manifest: {}", e)))?;

    validate_plugin_id(&manifest.id)?;
    let target_dir = plugin_dir(&app_data_dir, &manifest.id);
    validate_plugins_path(&app_data_dir, &target_dir)?;

    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir).map_err(|e| {
            AppError::storage_write_failed(format!("Failed to remove existing plugin: {}", e))
        })?;
    }
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to create plugin dir: {}", e)))?;

    let manifest_prefix = {
        let name = archive
            .by_index(manifest_entry_idx)
            .map_err(|e| AppError::storage_read_failed(format!("Failed to read manifest entry: {}", e)))?;
        let full = name.name().to_string();
        let last_slash = full.rfind('/');
        if let Some(idx) = last_slash {
            full[..idx].to_string()
        } else {
            String::new()
        }
    };

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::storage_read_failed(format!("Failed to read zip entry {}: {}", i, e)))?;
        let entry_name = entry.name().to_string();
        if entry.is_dir() {
            continue;
        }
        let rel = if manifest_prefix.is_empty() {
            entry_name.clone()
        } else if let Some(stripped) = entry_name.strip_prefix(&format!("{}/", manifest_prefix)) {
            stripped.to_string()
        } else {
            continue;
        };

        if rel.is_empty() || rel.contains("..") {
            continue;
        }

        let dest = target_dir.join(&rel);
        validate_plugins_path(&app_data_dir, &dest)?;

        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::storage_write_failed(format!("Failed to create parent dir: {}", e))
            })?;
        }

        let mut buf = Vec::new();
        use std::io::Read;
        entry
            .read_to_end(&mut buf)
            .map_err(|e| AppError::storage_write_failed(format!("Failed to read entry: {}", e)))?;
        std::fs::write(&dest, &buf)
            .map_err(|e| AppError::storage_write_failed(format!("Failed to write file: {}", e)))?;
    }

    let info = load_plugin_info(&target_dir).ok_or_else(|| {
        AppError::internal("Plugin installed but manifest could not be re-read".into())
    })?;
    Ok(info)
}

#[tauri::command]
pub async fn plugin_uninstall(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), AppError> {
    validate_plugin_id(&id)?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let target = plugin_dir(&app_data_dir, &id);
    validate_plugins_path(&app_data_dir, &target)?;

    if !target.exists() {
        return Err(AppError::not_found(format!("Plugin not found: {}", id)));
    }

    tokio::fs::remove_dir_all(&target)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to remove plugin: {}", e)))
}

#[tauri::command]
pub async fn plugin_toggle(
    app_handle: tauri::AppHandle,
    id: String,
    enabled: bool,
) -> Result<(), AppError> {
    validate_plugin_id(&id)?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let target = plugin_dir(&app_data_dir, &id);
    validate_plugins_path(&app_data_dir, &target)?;

    if !target.exists() {
        return Err(AppError::not_found(format!("Plugin not found: {}", id)));
    }

    let enabled_path = target.join(ENABLED_FILE);
    validate_plugins_path(&app_data_dir, &enabled_path)?;

    let content = if enabled { "true" } else { "false" };
    tokio::fs::write(&enabled_path, content)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write enabled state: {}", e)))
}

#[tauri::command]
pub async fn plugin_execute_hook(
    app_handle: tauri::AppHandle,
    hook: String,
    context: PluginHookContext,
) -> Result<Vec<PluginHookResult>, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let root = plugins_root(&app_data_dir);

    if !root.exists() {
        return Ok(Vec::new());
    }

    let context_json = serde_json::to_string(&context)
        .map_err(|e| AppError::internal(format!("Failed to serialize context: {}", e)))?;

    let hook_for_scan = hook.clone();
    let root_for_scan = root.clone();
    let app_data_for_scan = app_data_dir.clone();
    enum HookScanEntry {
        Ready { plugin_id: String, code: String },
        Failed(PluginHookResult),
    }

    let entries = tokio::task::spawn_blocking(move || {
        let mut out: Vec<HookScanEntry> = Vec::new();
        if let Ok(read_dir) = std::fs::read_dir(&root_for_scan) {
            for entry in read_dir.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let info = match load_plugin_info(&entry.path()) {
                    Some(i) => i,
                    None => continue,
                };
                if !info.enabled || info.has_error {
                    continue;
                }
                if !info.manifest.hooks.iter().any(|h| h == &hook_for_scan) {
                    continue;
                }
                match read_entry_code(&app_data_for_scan, &info.manifest.id) {
                    Ok(c) => out.push(HookScanEntry::Ready {
                        plugin_id: info.manifest.id,
                        code: c,
                    }),
                    Err(e) => out.push(HookScanEntry::Failed(PluginHookResult {
                        plugin_id: info.manifest.id.clone(),
                        success: false,
                        result: None,
                        error: Some(format!("Failed to read plugin code: {}", e)),
                        logs: vec![],
                        ui_inject: None,
                    })),
                }
            }
        }
        out
    })
    .await
    .map_err(|e| AppError::internal(format!("Failed to scan plugins: {}", e)))?;

    let mut results = Vec::new();
    for entry in entries {
        let result = match entry {
            HookScanEntry::Failed(r) => r,
            HookScanEntry::Ready { plugin_id, code } => {
                let hook_clone = hook.clone();
                let ctx_clone = context_json.clone();
                tokio::task::spawn_blocking(move || {
                    engine::PluginEngine::execute(&plugin_id, &code, &hook_clone, &ctx_clone)
                })
                .await
                .map_err(|e| AppError::internal(format!("Plugin execution panicked: {}", e)))?
            }
        };
        results.push(result);
    }

    Ok(results)
}

#[tauri::command]
pub async fn plugin_execute_command(
    app_handle: tauri::AppHandle,
    plugin_id: String,
    command_id: String,
    context: PluginHookContext,
) -> Result<PluginHookResult, AppError> {
    validate_plugin_id(&plugin_id)?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;

    let plugin_path = plugin_dir(&app_data_dir, &plugin_id);
    validate_plugins_path(&app_data_dir, &plugin_path)?;

    if !plugin_path.exists() {
        return Err(AppError::not_found(format!("Plugin not found: {}", plugin_id)));
    }

    let info = load_plugin_info(&plugin_path)
        .ok_or_else(|| AppError::not_found(format!("Plugin manifest not found: {}", plugin_id)))?;

    if !info.enabled {
        return Err(AppError::invalid_input(format!("Plugin is disabled: {}", plugin_id)));
    }
    if info.has_error {
        return Err(AppError::invalid_input(format!(
            "Plugin has manifest error: {}",
            info.error.unwrap_or_default()
        )));
    }

    let has_command = info
        .manifest
        .commands
        .iter()
        .any(|c| c.id == command_id);
    if !has_command {
        return Err(AppError::not_found(format!(
            "Command '{}' not found in plugin '{}'",
            command_id, plugin_id
        )));
    }

    let code = read_entry_code(&app_data_dir, &plugin_id)?;
    let context_json = serde_json::to_string(&context)
        .map_err(|e| AppError::internal(format!("Failed to serialize context: {}", e)))?;

    let pid = plugin_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        engine::PluginEngine::execute(&pid, &code, "onCommand", &context_json)
    })
    .await
    .map_err(|e| AppError::internal(format!("Plugin execution panicked: {}", e)))?;

    Ok(result)
}

#[tauri::command]
pub async fn plugin_get_code(
    app_handle: tauri::AppHandle,
    plugin_id: String,
) -> Result<String, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    read_entry_code(&app_data_dir, &plugin_id)
}

#[tauri::command]
pub async fn plugin_save_code(
    app_handle: tauri::AppHandle,
    plugin_id: String,
    code: String,
) -> Result<(), AppError> {
    validate_plugin_id(&plugin_id)?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let plugin_path = plugin_dir(&app_data_dir, &plugin_id);
    validate_plugins_path(&app_data_dir, &plugin_path)?;

    if !plugin_path.exists() {
        return Err(AppError::not_found(format!("Plugin not found: {}", plugin_id)));
    }

    let manifest_str = tokio::fs::read_to_string(plugin_path.join(MANIFEST_FILE))
        .await
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read manifest: {}", e)))?;
    let manifest: PluginManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse manifest: {}", e)))?;

    if manifest.entry.is_empty() {
        return Err(AppError::invalid_input("Plugin manifest has empty entry".into()));
    }

    let entry_path = plugin_path.join(&manifest.entry);
    validate_plugins_path(&app_data_dir, &entry_path)?;

    tokio::fs::write(&entry_path, &code)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write entry file: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_plugin_id_rejects_traversal() {
        assert!(validate_plugin_id("../etc").is_err());
        assert!(validate_plugin_id("a/b").is_err());
        assert!(validate_plugin_id("a\\b").is_err());
        assert!(validate_plugin_id(".").is_err());
        assert!(validate_plugin_id("").is_err());
        assert!(validate_plugin_id("valid-id").is_ok());
        assert!(validate_plugin_id("jwt_inspector").is_ok());
    }

    #[test]
    fn test_read_enabled_state_defaults_true() {
        let dir = tempfile::TempDir::new().unwrap();
        assert!(read_enabled_state(dir.path()));
    }

    #[test]
    fn test_read_enabled_state_reads_file() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(dir.path().join(ENABLED_FILE), "false").unwrap();
        assert!(!read_enabled_state(dir.path()));
        std::fs::write(dir.path().join(ENABLED_FILE), "true\n").unwrap();
        assert!(read_enabled_state(dir.path()));
    }

    #[test]
    fn test_load_plugin_info_valid() {
        let dir = tempfile::TempDir::new().unwrap();
        let manifest = r#"{
            "id": "test",
            "name": "Test",
            "version": "1.0.0",
            "description": "test",
            "entry": "index.js",
            "permissions": [],
            "hooks": ["onCommand"],
            "commands": []
        }"#;
        std::fs::write(dir.path().join(MANIFEST_FILE), manifest).unwrap();
        let info = load_plugin_info(dir.path()).unwrap();
        assert_eq!(info.manifest.id, "test");
        assert!(info.enabled);
        assert!(!info.has_error);
    }

    #[test]
    fn test_load_plugin_info_invalid_manifest() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(dir.path().join(MANIFEST_FILE), "{not json").unwrap();
        let info = load_plugin_info(dir.path()).unwrap();
        assert!(info.has_error);
        assert!(info.error.as_ref().unwrap().contains("Invalid manifest"));
    }
}
