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
use std::time::{Duration, Instant};
use tauri::Manager;

static VAULT_KEY: Mutex<Option<([u8; 32], Instant)>> = Mutex::new(None);
const VAULT_KEY_IDLE_TIMEOUT: Duration = Duration::from_secs(300);

fn drop_key(key: &mut [u8; 32]) {
    for byte in key.iter_mut() {
        unsafe { std::ptr::write_volatile(byte, 0) };
    }
    std::sync::atomic::fence(std::sync::atomic::Ordering::SeqCst);
}

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

fn check_key_timeout() -> Result<(), AppError> {
    let mut vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    if let Some((_, last_used)) = *vault_key {
        if last_used.elapsed() > VAULT_KEY_IDLE_TIMEOUT {
            if let Some((ref mut key, _)) = *vault_key {
                drop_key(key);
            }
            *vault_key = None;
        }
    }
    Ok(())
}

fn get_key() -> Result<[u8; 32], AppError> {
    check_key_timeout()?;
    let mut vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    match *vault_key {
        Some((key, ref mut last_used)) => {
            *last_used = Instant::now();
            Ok(key)
        }
        None => Err(AppError::vault_locked()),
    }
}

#[tauri::command]
pub async fn unlock_vault(app: tauri::AppHandle, master_password: String) -> Result<(), AppError> {
    let vault_dir = vault_dir(&app)?;
    let salt_file = vault_dir.join("salt.bin");

    let salt: [u8; 16] = if salt_file.exists() {
        let salt_bytes = std::fs::read(&salt_file).map_err(|e| AppError::storage_read_failed(format!("Failed to read salt: {}", e)))?;
        if salt_bytes.len() < 16 {
            let new_salt = generate_salt();
            std::fs::write(&salt_file, new_salt).map_err(|e| AppError::storage_write_failed(format!("Failed to write salt: {}", e)))?;
            new_salt
        } else {
            let mut s = [0u8; 16];
            s.copy_from_slice(&salt_bytes[..16]);
            s
        }
    } else {
        let new_salt = generate_salt();
        std::fs::write(&salt_file, new_salt).map_err(|e| AppError::storage_write_failed(format!("Failed to write salt: {}", e)))?;
        new_salt
    };

    let key = derive_key(&master_password, &salt)?;

    {
        let mut vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
        *vault_key = Some((key, Instant::now()));
    }

    let verify_file = vault_dir.join("verify.bin");
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AppError::vault_unlock_failed(format!("Cipher init failed: {}", e)))?;
    let verify_plaintext = b"VAULT_VERIFIED";
    if verify_file.exists() {
        let encrypted = std::fs::read(&verify_file)
            .map_err(|e| AppError::storage_read_failed(format!("Failed to read verification file: {}", e)))?;
        if encrypted.len() < 12 {
            return Err(AppError::vault_unlock_failed("Invalid vault password".into()));
        }
        let nonce = Nonce::from_slice(&encrypted[..12]);
        let tag_and_ct = &encrypted[12..];
        cipher.decrypt(nonce, tag_and_ct)
            .map_err(|_| AppError::vault_unlock_failed("Invalid vault password".into()))?;
    } else {
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, verify_plaintext.as_ref())
            .map_err(|e| AppError::vault_unlock_failed(format!("Failed to create verification file: {}", e)))?;
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        std::fs::write(&verify_file, combined)
            .map_err(|e| AppError::storage_write_failed(format!("Failed to write verification file: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn lock_vault() -> Result<(), AppError> {
    let mut vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    if let Some((ref mut key, _)) = *vault_key {
        drop_key(key);
    }
    *vault_key = None;
    Ok(())
}

#[tauri::command]
pub async fn is_vault_unlocked(app: tauri::AppHandle) -> Result<VaultStatus, AppError> {
    let vault_key = VAULT_KEY.lock().map_err(|e| AppError::internal(format!("Lock error: {}", e)))?;
    let unlocked = vault_key.is_some();
    let secret_count = if unlocked {
        let vault_dir = vault_dir(&app)?;
        std::fs::read_dir(&vault_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).filter(|e| {
                e.path().extension().is_some_and(|ext| ext == "json") &&
                e.path().file_stem().is_some_and(|stem| stem.to_string_lossy().ends_with(".enc"))
            }).count())
            .unwrap_or(0)
    } else {
        0
    };
    Ok(VaultStatus { unlocked, secret_count })
}

#[tauri::command]
pub async fn encrypt_vault_secret(app: tauri::AppHandle, name: String, plaintext: String) -> Result<(), AppError> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::storage_path_traversal(format!("Invalid secret name: {}", name)));
    }
    let key_bytes = get_key()?;

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::vault_encrypt_failed(format!("Cipher init failed: {}", e)))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
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

    std::fs::write(&enc_file, serde_json::to_string_pretty(&entry).map_err(|e| AppError::internal(format!("Vault serialization failed: {}", e)))?)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write secret file: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn decrypt_vault_secret(app: tauri::AppHandle, name: String) -> Result<String, AppError> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::storage_path_traversal(format!("Invalid secret name: {}", name)));
    }
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
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::storage_path_traversal(format!("Invalid secret name: {}", name)));
    }
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

#[cfg(test)]
fn contains_path_traversal(name: &str) -> bool {
    name.contains('/') || name.contains('\\') || name.contains("..")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reset_vault() {
        let mut vk = VAULT_KEY.lock().unwrap();
        if let Some((ref mut key, _)) = *vk {
            drop_key(key);
        }
        *vk = None;
    }

    #[test]
    fn test_derive_key_produces_32_byte_key() {
        let salt = generate_salt();
        let key = derive_key("password123", &salt).unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_derive_key_deterministic() {
        let salt = generate_salt();
        let key1 = derive_key("password123", &salt).unwrap();
        let key2 = derive_key("password123", &salt).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_derive_key_different_password() {
        let salt = generate_salt();
        let key1 = derive_key("password1", &salt).unwrap();
        let key2 = derive_key("password2", &salt).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_drop_key_zeroizes() {
        let mut key = [42u8; 32];
        drop_key(&mut key);
        for byte in &key {
            assert_eq!(*byte, 0);
        }
    }

    #[test]
    fn test_vault_initial_state_locked() {
        reset_vault();
        let result = get_key();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "VAULT_LOCKED");
    }

    #[test]
    fn test_vault_after_manual_set() {
        reset_vault();
        let key = [1u8; 32];
        {
            let mut vk = VAULT_KEY.lock().unwrap();
            *vk = Some((key, std::time::Instant::now()));
        }
        let result = get_key();
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_key_timeout_fresh() {
        reset_vault();
        let key = [1u8; 32];
        {
            let mut vk = VAULT_KEY.lock().unwrap();
            *vk = Some((key, std::time::Instant::now()));
        }
        assert!(check_key_timeout().is_ok());
        let result = get_key();
        assert!(result.is_ok());
    }

    #[test]
    fn test_path_traversal_slash() {
        assert!(contains_path_traversal("a/b"));
        assert!(contains_path_traversal("a\\b"));
    }

    #[test]
    fn test_path_traversal_dotdot() {
        assert!(contains_path_traversal(".."));
        assert!(contains_path_traversal("a..b"));
    }

    #[test]
    fn test_valid_secret_names() {
        assert!(!contains_path_traversal("my_secret"));
        assert!(!contains_path_traversal("api-key-123"));
        assert!(!contains_path_traversal("JWT_TOKEN"));
    }

    #[test]
    fn test_generate_salt_is_random() {
        let salt1 = generate_salt();
        let salt2 = generate_salt();
        assert_ne!(salt1, salt2);
    }

    #[test]
    fn test_generate_salt_length() {
        let salt = generate_salt();
        assert_eq!(salt.len(), 16);
    }

    #[test]
    fn test_drop_key_zeroizes_stack_key() {
        let mut key = [42u8; 32];
        drop_key(&mut key);
        for byte in &key {
            assert_eq!(*byte, 0);
        }
    }

    #[test]
    fn test_lock_vault_scenario() {
        reset_vault();
        let key = [42u8; 32];
        {
            let mut vk = VAULT_KEY.lock().unwrap();
            *vk = Some((key, std::time::Instant::now()));
        }
        {
            let mut vk = VAULT_KEY.lock().unwrap();
            if let Some((ref mut k, _)) = *vk {
                drop_key(k);
            }
            *vk = None;
        }
        assert!(VAULT_KEY.lock().unwrap().is_none());
    }
}