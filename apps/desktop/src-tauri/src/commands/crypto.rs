use crate::error::AppError;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use argon2::Argon2;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

static VAULT_KEY: Mutex<Option<[u8; 32]>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretInfo {
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub unlocked: bool,
    pub secret_count: usize,
}

fn vault_dir(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Failed to get app data dir: {}", e)))?;
    let vault_dir = data_dir.join("vault");
    if !vault_dir.exists() {
        std::fs::create_dir_all(&vault_dir).map_err(|e| AppError::storage_write_failed(format!("Failed to create vault dir: {}", e)))?;
    }
    Ok(vault_dir)
}

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], AppError> {
    let argon2 = Argon2::default();
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| AppError::vault_unlock_failed(format!("Key derivation failed: {}", e)))?;
    Ok(key)
}

fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

fn get_key() -> Result<[u8; 32], AppError> {
    let vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    vault_key.ok_or(AppError::vault_locked())
}

#[tauri::command]
pub async fn unlock_vault(app: tauri::AppHandle, master_password: String) -> Result<(), AppError> {
    let vault_dir = vault_dir(&app)?;
    let salt_file = vault_dir.join("salt.bin");

    let salt: [u8; 16] = if salt_file.exists() {
        let salt_bytes = std::fs::read(&salt_file).map_err(|e| AppError::storage_read_failed(format!("Failed to read salt: {}", e)))?;
        let mut s = [0u8; 16];
        s.copy_from_slice(&salt_bytes[..16]);
        s
    } else {
        let new_salt = generate_salt();
        std::fs::write(&salt_file, new_salt).map_err(|e| AppError::storage_write_failed(format!("Failed to write salt: {}", e)))?;
        new_salt
    };

    let key = derive_key(&master_password, &salt)?;

    {
        let mut vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
        *vault_key = Some(key);
    }

    if let Ok(kr) = keyring::Entry::new("api-client", "vault-master-key") {
        let _ = kr.set_password(&master_password);
    }

    Ok(())
}

#[tauri::command]
pub async fn lock_vault() -> Result<(), AppError> {
    {
        let mut vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
        *vault_key = None;
    }

    if let Ok(kr) = keyring::Entry::new("api-client", "vault-master-key") {
        let _ = kr.delete_credential();
    }

    Ok(())
}

#[tauri::command]
pub async fn is_vault_unlocked() -> Result<VaultStatus, AppError> {
    let vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    Ok(VaultStatus { unlocked: vault_key.is_some(), secret_count: 0 })
}

#[tauri::command]
pub async fn encrypt_vault_secret(app: tauri::AppHandle, name: String, plaintext: String) -> Result<(), AppError> {
    let key_bytes = get_key()?;

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::vault_encrypt_failed(format!("Cipher init failed: {}", e)))?;

    let nonce = Nonce::from_slice(b"unique-nonce-vau");
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::vault_encrypt_failed(format!("Encryption failed: {}", e)))?;

    let vault_dir = vault_dir(&app)?;
    let enc_file = vault_dir.join(format!("{}.enc.json", name));

    let entry = serde_json::json!({
        "name": name,
        "ciphertext": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ciphertext),
        "nonce": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, nonce.as_slice()),
        "createdAt": chrono::Utc::now().to_rfc3339(),
    });

    std::fs::write(&enc_file, serde_json::to_string_pretty(&entry).unwrap())
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write secret file: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn decrypt_vault_secret(app: tauri::AppHandle, name: String) -> Result<String, AppError> {
    let key_bytes = get_key()?;

    let vault_dir = vault_dir(&app)?;
    let enc_file = vault_dir.join(format!("{}.enc.json", name));

    if !enc_file.exists() {
        return Err(AppError::storage_not_found(format!("Secret '{}' not found", name)));
    }

    let content = std::fs::read_to_string(&enc_file)
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read secret file: {}", e)))?;
    let entry: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse secret file: {}", e)))?;

    let ciphertext_b64 = entry["ciphertext"].as_str().unwrap_or("");
    let nonce_b64 = entry["nonce"].as_str().unwrap_or("");

    let ciphertext = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, ciphertext_b64)
        .map_err(|e| AppError::vault_decrypt_failed(format!("Failed to decode ciphertext: {}", e)))?;
    let nonce_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, nonce_b64)
        .map_err(|e| AppError::vault_decrypt_failed(format!("Failed to decode nonce: {}", e)))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::vault_decrypt_failed(format!("Cipher init failed: {}", e)))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| AppError::vault_decrypt_failed(format!("Decryption failed (wrong password?): {}", e)))?;

    String::from_utf8(plaintext).map_err(|e| AppError::vault_decrypt_failed(format!("Invalid UTF-8: {}", e)))
}

#[tauri::command]
pub async fn delete_vault_secret(app: tauri::AppHandle, name: String) -> Result<(), AppError> {
    let vault_dir = vault_dir(&app)?;
    let enc_file = vault_dir.join(format!("{}.enc.json", name));

    if enc_file.exists() {
        std::fs::remove_file(&enc_file).map_err(|e| AppError::storage_write_failed(format!("Failed to delete secret: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn list_vault_secrets(app: tauri::AppHandle) -> Result<Vec<VaultSecretInfo>, AppError> {
    let vault_dir = vault_dir(&app)?;
    let mut secrets = Vec::new();

    let entries = std::fs::read_dir(&vault_dir).map_err(|e| AppError::storage_read_failed(format!("Failed to read vault dir: {}", e)))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "json") {
            if let Some(filename) = path.file_stem() {
                let name = filename.to_string_lossy().to_string();
                if name.ends_with(".enc") {
                    let secret_name = name.strip_suffix(".enc").unwrap_or(&name);
                    let content = std::fs::read_to_string(&path).ok();
                    let created_at = content
                        .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
                        .and_then(|v| v["createdAt"].as_str().map(|s| s.to_string()))
                        .unwrap_or_default();
                    secrets.push(VaultSecretInfo {
                        name: secret_name.to_string(),
                        created_at,
                    });
                }
            }
        }
    }

    Ok(secrets)
}