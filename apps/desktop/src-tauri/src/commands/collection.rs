use crate::error::AppError;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionFile {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<CollectionConfig>,
    #[serde(default, rename = "items")]
    pub items: Vec<CollectionItem>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<Vec<SavedHeader>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<SavedAuth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<CollectionVariable>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scripts: Option<SavedScripts>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<Vec<SavedHeader>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<SavedAuth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<CollectionVariable>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scripts: Option<SavedScripts>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum CollectionItem {
    Folder(Box<CollectionFolder>),
    Request(Box<SavedRequest>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionFolder {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<FolderConfig>,
    #[serde(default)]
    pub items: Vec<CollectionItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedRequest {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<SavedHeader>,
    #[serde(default)]
    pub params: Vec<SavedParam>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<SavedBody>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<SavedAuth>,
    #[serde(default)]
    pub scripts: SavedScripts,
    #[serde(default)]
    pub settings: SavedSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SavedHeader {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SavedParam {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedBody {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(default)]
    pub formdata: Vec<SavedFormDataParam>,
    #[serde(default)]
    pub urlencoded: Vec<SavedParam>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphql_query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphql_variables: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedFormDataParam {
    pub key: String,
    pub value: String,
    #[serde(default = "default_form_type")]
    pub param_type: String,
    #[serde(default)]
    pub disabled: bool,
}

fn default_form_type() -> String { "text".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "config", rename_all = "camelCase")]
pub enum SavedAuth {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "bearer")]
    Bearer {
        token: String,
        #[serde(default)]
        prefix: Option<String>,
    },
    #[serde(rename = "basic")]
    Basic {
        username: String,
        password: String,
    },
    #[serde(rename = "apikey")]
    ApiKey {
        key: String,
        value: String,
        #[serde(default)]
        add_to: Option<String>,
    },
    #[serde(rename = "jwt")]
    Jwt {
        token: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        secret: Option<String>,
        #[serde(default)]
        algorithm: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        payload: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expiry_seconds: Option<u64>,
        #[serde(default)]
        prefix: Option<String>,
    },
    #[serde(rename = "oauth1")]
    OAuth1 {
        consumer_key: String,
        consumer_secret: String,
        token: String,
        token_secret: String,
        #[serde(default)]
        signature_method: Option<String>,
    },
    #[serde(rename = "oauth2")]
    OAuth2 {
        access_token: String,
        #[serde(default)]
        token_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        refresh_token: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expires_in: Option<u64>,
    },
    #[serde(rename = "awsv4")]
    AwsV4 {
        access_key_id: String,
        secret_access_key: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        session_token: Option<String>,
        service: String,
        region: String,
    },
}

impl SavedAuth {
    pub fn to_auth_config(&self) -> super::http::AuthConfig {
        use super::http::{
            AuthConfig, EmptyAuth, BearerAuth, BasicAuth, ApiKeyAuth,
            JwtAuth, OAuth1Auth, OAuth2Auth, AwsV4Auth,
        };
        match self {
            SavedAuth::None => AuthConfig::None(EmptyAuth {}),
            SavedAuth::Bearer { token, prefix } => AuthConfig::Bearer(BearerAuth {
                token: token.clone(),
                prefix: prefix.clone().unwrap_or_else(|| "Bearer".into()),
            }),
            SavedAuth::Basic { username, password } => AuthConfig::Basic(BasicAuth {
                username: username.clone(),
                password: password.clone(),
            }),
            SavedAuth::ApiKey { key, value, add_to } => AuthConfig::ApiKey(ApiKeyAuth {
                key: key.clone(),
                value: value.clone(),
                add_to: add_to.clone().unwrap_or_else(|| "header".into()),
            }),
            SavedAuth::Jwt { token, secret, algorithm, payload, expiry_seconds, prefix } => AuthConfig::Jwt(JwtAuth {
                token: token.clone(),
                secret: secret.clone(),
                algorithm: algorithm.clone().unwrap_or_else(|| "HS256".into()),
                payload: payload.clone(),
                expiry_seconds: *expiry_seconds,
                prefix: prefix.clone().unwrap_or_else(|| "Bearer".into()),
            }),
            SavedAuth::OAuth1 { consumer_key, consumer_secret, token, token_secret, signature_method } => {
                AuthConfig::OAuth1(OAuth1Auth {
                    consumer_key: consumer_key.clone(),
                    consumer_secret: consumer_secret.clone(),
                    token: token.clone(),
                    token_secret: token_secret.clone(),
                    signature_method: signature_method.clone().unwrap_or_else(|| "HMAC-SHA1".into()),
                })
            }
            SavedAuth::OAuth2 { access_token, token_type, refresh_token, expires_in } => {
                AuthConfig::OAuth2(OAuth2Auth {
                    access_token: access_token.clone(),
                    token_type: token_type.clone().unwrap_or_else(|| "Bearer".into()),
                    refresh_token: refresh_token.clone(),
                    expires_in: *expires_in,
                })
            }
            SavedAuth::AwsV4 { access_key_id, secret_access_key, session_token, service, region } => {
                AuthConfig::AwsV4(AwsV4Auth {
                    access_key_id: access_key_id.clone(),
                    secret_access_key: secret_access_key.clone(),
                    session_token: session_token.clone(),
                    service: service.clone(),
                    region: region.clone(),
                })
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SavedScripts {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_request: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_response: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SavedSettings {
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default = "default_redirects")]
    pub max_redirects: u32,
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
}

fn default_timeout() -> u64 { 30000 }
fn default_true() -> bool { true }
fn default_redirects() -> u32 { 10 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionVariable {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSummary {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub request_count: usize,
    pub updated_at: String,
}

fn count_requests(items: &[CollectionItem]) -> usize {
    items.iter().map(|item| match item {
        CollectionItem::Request(_) => 1,
        CollectionItem::Folder(f) => count_requests(&f.items),
    }).sum()
}

#[tauri::command]
pub async fn list_collections(
    app_handle: tauri::AppHandle,
) -> Result<Vec<CollectionSummary>, AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let collections_dir = app_data_dir.join("collections");

    if !collections_dir.exists() {
        return Ok(Vec::new());
    }

    let mut summaries = Vec::new();
    let mut entries = tokio::fs::read_dir(&collections_dir).await
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;

    while let Some(entry) = entries.next_entry().await
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?
    {
        if !entry.file_type().await
            .map_err(|e| AppError::storage_read_failed(e.to_string()))?
            .is_dir()
        {
            continue;
        }

        let collection_json = entry.path().join("collection.json");
        if collection_json.exists() {
            let content = tokio::fs::read_to_string(&collection_json).await
                .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
            let collection: CollectionFile = serde_json::from_str(&content)
                .map_err(|e| AppError::internal(format!("Failed to parse collection: {}", e)))?;
    summaries.push(CollectionSummary {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            request_count: count_requests(&collection.items),
            updated_at: collection.updated_at,
        });
        }
    }

    Ok(summaries)
}

#[tauri::command]
pub async fn get_collection(
    app_handle: tauri::AppHandle,
    collection_id: String,
) -> Result<CollectionFile, AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_read_failed(e.to_string()))?;
    let path = app_data_dir.join("collections").join(&collection_id).join("collection.json");

    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    let content = tokio::fs::read_to_string(&path).await
        .map_err(|e| AppError::storage_read_failed(format!("Collection not found: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::internal(format!("Failed to parse collection: {}", e)))
}

#[tauri::command]
pub async fn save_collection(
    app_handle: tauri::AppHandle,
    collection: CollectionFile,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let dir = app_data_dir.join("collections").join(&collection.id);
    let path = dir.join("collection.json");

    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;

    let content = serde_json::to_string_pretty(&collection)
        .map_err(|e| AppError::internal(e.to_string()))?;

    if path.exists() {
        crate::storage::file::create_backup(&path)?;
    }
    crate::storage::file::atomic_write(&path, &content)?;

    Ok(())
}

#[tauri::command]
pub async fn delete_collection(
    app_handle: tauri::AppHandle,
    collection_id: String,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let dir = app_data_dir.join("collections").join(&collection_id);

    super::file_ops::validate_path_within_app_data(&app_data_dir, &dir)?;

    if dir.exists() {
        tokio::fs::remove_dir_all(&dir).await
            .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn update_collection_config(
    app_handle: tauri::AppHandle,
    collection_id: String,
    config: CollectionConfig,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let path = app_data_dir.join("collections").join(&collection_id).join("collection.json");
    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    let content = crate::storage::file::read_with_backup(&path)?;
    let mut col: CollectionFile = serde_json::from_str(&content)
        .map_err(|e| AppError::internal(format!("Failed to parse collection: {}", e)))?;
    col.updated_at = chrono::Utc::now().to_rfc3339();
    col.config = Some(config);

    let new_content = serde_json::to_string_pretty(&col)
        .map_err(|e| AppError::internal(e.to_string()))?;
    crate::storage::file::create_backup(&path)?;
    crate::storage::file::atomic_write(&path, &new_content)?;
    Ok(())
}

#[tauri::command]
pub async fn update_folder_config(
    app_handle: tauri::AppHandle,
    collection_id: String,
    folder_id: String,
    config: FolderConfig,
) -> Result<(), AppError> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| AppError::storage_write_failed(e.to_string()))?;
    let path = app_data_dir.join("collections").join(&collection_id).join("collection.json");
    super::file_ops::validate_path_within_app_data(&app_data_dir, &path)?;

    let content = crate::storage::file::read_with_backup(&path)?;
    let mut col: CollectionFile = serde_json::from_str(&content)
        .map_err(|e| AppError::internal(format!("Failed to parse collection: {}", e)))?;
    col.updated_at = chrono::Utc::now().to_rfc3339();

    update_folder_config_in_items(&mut col.items, &folder_id, config)?;

    let new_content = serde_json::to_string_pretty(&col)
        .map_err(|e| AppError::internal(e.to_string()))?;
    crate::storage::file::create_backup(&path)?;
    crate::storage::file::atomic_write(&path, &new_content)?;
    Ok(())
}

fn update_folder_config_in_items(items: &mut [CollectionItem], folder_id: &str, config: FolderConfig) -> Result<(), AppError> {
    for item in items {
        match item {
            CollectionItem::Folder(folder) => {
                if folder.id == folder_id {
                    folder.config = Some(config);
                    return Ok(());
                }
                update_folder_config_in_items(&mut folder.items, folder_id, config.clone())?;
            }
            CollectionItem::Request(_) => {}
        }
    }
    Err(AppError::not_found(format!("Folder {} not found in collection", folder_id)))
}

#[cfg(test)]
mod tests {
  use super::{CollectionFile, CollectionItem, SavedRequest, SavedSettings, SavedScripts, CollectionVariable, CollectionConfig};
  use tempfile::TempDir;

  fn sample_collection(id: &str, name: &str) -> CollectionFile {
    CollectionFile {
      id: id.to_string(),
      name: name.to_string(),
      description: None,
      version: None,
      items: vec![
        CollectionItem::Request(Box::new(SavedRequest {
          id: "req-1".to_string(),
          name: "Get Users".to_string(),
          method: "GET".to_string(),
          url: "https://api.example.com/users".to_string(),
          headers: vec![],
          params: vec![],
          body: None,
          auth: None,
          scripts: SavedScripts::default(),
          settings: SavedSettings::default(),
        })),
      ],
      config: Some(CollectionConfig {
        headers: None,
        auth: None,
        variables: Some(vec![
          CollectionVariable { key: "base_url".to_string(), value: "https://api.example.com".to_string(), enabled: true },
        ]),
        scripts: None,
      }),
      created_at: "2026-01-01T00:00:00Z".to_string(),
      updated_at: "2026-01-01T00:00:00Z".to_string(),
    }
  }

  #[test]
  fn test_collection_serde_roundtrip() {
    let col = sample_collection("col-1", "Test Collection");
    let json = serde_json::to_string_pretty(&col).unwrap();
    let parsed: CollectionFile = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, "col-1");
    assert_eq!(parsed.name, "Test Collection");
    assert_eq!(parsed.items.len(), 1);
    match &parsed.items[0] {
      CollectionItem::Request(req) => assert_eq!(req.method, "GET"),
      _ => panic!("Expected Request item"),
    }
    assert_eq!(parsed.config.unwrap().variables.unwrap().len(), 1);
  }

  #[tokio::test]
  async fn test_collection_file_write_read() {
    let dir = TempDir::new().unwrap();
    let col_dir = dir.path().join("collections").join("col-1");
    tokio::fs::create_dir_all(&col_dir).await.unwrap();

    let col = sample_collection("col-1", "Test");
    let json = serde_json::to_string_pretty(&col).unwrap();
    let path = col_dir.join("collection.json");

    let tmp = path.with_extension("json.tmp");
    tokio::fs::write(&tmp, &json).await.unwrap();
    tokio::fs::rename(&tmp, &path).await.unwrap();

    let content = tokio::fs::read_to_string(&path).await.unwrap();
    let parsed: CollectionFile = serde_json::from_str(&content).unwrap();
    assert_eq!(parsed.id, col.id);
    assert_eq!(parsed.items.len(), col.items.len());
  }
}
