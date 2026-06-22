use crate::error::AppError;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub code: String,
    pub category: String,
    pub is_builtin: bool,
}

const TEMPLATES_FILE: &str = "script-templates.json";

fn builtin_templates() -> Vec<ScriptTemplate> {
    vec![
        ScriptTemplate {
            id: "builtin-set-timestamp".into(),
            name: "Set timestamp variable".into(),
            description: "Sets a timestamp variable in ISO format".into(),
            code: "pm.variables.set('timestamp', new Date().toISOString());".into(),
            category: "variables".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-extract-token".into(),
            name: "Extract token from response".into(),
            description: "Extracts access_token from JSON response".into(),
            code: "const jsonData = pm.response.json();\npm.variables.set('token', jsonData.access_token);".into(),
            category: "extraction".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-add-header".into(),
            name: "Add custom header".into(),
            description: "Adds a custom request header with a UUID".into(),
            code: "pm.request.addHeader('X-Request-ID', crypto.randomUUID());".into(),
            category: "request".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-status-assertion".into(),
            name: "Status code assertion".into(),
            description: "Asserts that response status is 200".into(),
            code: "pm.test('Status code is 200', () => {\n  pm.expect(pm.response.status).to.eql(200);\n});".into(),
            category: "tests".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-body-assertion".into(),
            name: "Response body assertion".into(),
            description: "Asserts response body has a property".into(),
            code: "pm.test('Has expected property', () => {\n  const jsonData = pm.response.json();\n  pm.expect(jsonData).to.have.property('id');\n});".into(),
            category: "tests".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-time-assertion".into(),
            name: "Response time assertion".into(),
            description: "Asserts response time is under 500ms".into(),
            code: "pm.test('Response time is less than 500ms', () => {\n  pm.expect(pm.response.time).to.be.below(500);\n});".into(),
            category: "tests".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-send-request".into(),
            name: "Send additional request".into(),
            description: "Performs a health check request".into(),
            code: "pm.sendRequest('https://api.example.com/health', function(err, res) {\n  if (err) { console.error(err); return; }\n  pm.test('Health check passes', () => {\n    pm.expect(res.status).to.eql(200);\n  });\n});".into(),
            category: "request".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-clear-variable".into(),
            name: "Clear environment variable".into(),
            description: "Unsets an environment variable".into(),
            code: "pm.environment.unset('tempVar');".into(),
            category: "variables".into(),
            is_builtin: true,
        },
        ScriptTemplate {
            id: "builtin-set-variables".into(),
            name: "Set multiple variables".into(),
            description: "Sets baseUrl and apiKey environment variables".into(),
            code: "pm.environment.set('baseUrl', 'https://api.example.com');\npm.environment.set('apiKey', 'your-key-here');".into(),
            category: "variables".into(),
            is_builtin: true,
        },
    ]
}

fn templates_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Cannot get app data dir: {}", e)))?;
    Ok(data_dir.join(TEMPLATES_FILE))
}

async fn load_user_templates(app: &tauri::AppHandle) -> Result<Vec<ScriptTemplate>, AppError> {
    let path = templates_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read templates: {}", e)))?;
    let templates: Vec<ScriptTemplate> = serde_json::from_str(&content)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse templates: {}", e)))?;
    Ok(templates)
}

async fn write_user_templates(
    app: &tauri::AppHandle,
    templates: &[ScriptTemplate],
) -> Result<(), AppError> {
    let path = templates_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::storage_write_failed(format!("Failed to create dir: {}", e)))?;
    }
    let content = serde_json::to_string_pretty(templates)
        .map_err(|e| AppError::internal(format!("Failed to serialize templates: {}", e)))?;
    let tmp_path = path.with_extension("json.tmp");
    tokio::fs::write(&tmp_path, &content)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write templates: {}", e)))?;
    tokio::fs::rename(&tmp_path, &path)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to rename templates file: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn list_script_templates(app: tauri::AppHandle) -> Result<Vec<ScriptTemplate>, AppError> {
    let mut builtins = builtin_templates();
    let user_templates = load_user_templates(&app).await?;

    // Merge: user templates override builtins with the same id (by id)
    let user_ids: std::collections::HashSet<&str> =
        user_templates.iter().map(|t| t.id.as_str()).collect();
    builtins.retain(|b| !user_ids.contains(b.id.as_str()));

    let mut combined = builtins;
    combined.extend(user_templates);
    // Sort by category then name for stable ordering
    combined.sort_by(|a, b| {
        a.category
            .cmp(&b.category)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(combined)
}

#[tauri::command]
pub async fn save_script_template(
    app: tauri::AppHandle,
    template: ScriptTemplate,
) -> Result<(), AppError> {
    if template.id.is_empty() {
        return Err(AppError::invalid_input("Template id is required".into()));
    }
    if template.name.is_empty() {
        return Err(AppError::invalid_input("Template name is required".into()));
    }
    // Force is_builtin=false for user-saved templates
    let mut template = template;
    template.is_builtin = false;

    let mut user_templates = load_user_templates(&app).await?;
    if let Some(existing) = user_templates.iter_mut().find(|t| t.id == template.id) {
        *existing = template;
    } else {
        user_templates.push(template);
    }
    write_user_templates(&app, &user_templates).await
}

#[tauri::command]
pub async fn delete_script_template(
    app: tauri::AppHandle,
    template_id: String,
) -> Result<(), AppError> {
    if template_id.is_empty() {
        return Err(AppError::invalid_input("Template id is required".into()));
    }
    let mut user_templates = load_user_templates(&app).await?;
    let before = user_templates.len();
    user_templates.retain(|t| t.id != template_id);
    if user_templates.len() == before {
        // Not found in user templates - could be a builtin (which cannot be deleted) or doesn't exist
        let is_builtin = builtin_templates().iter().any(|t| t.id == template_id);
        if is_builtin {
            return Err(AppError::invalid_input(
                "Cannot delete a built-in template".into(),
            ));
        }
        // Idempotent: deleting a non-existent user template is fine
        return Ok(());
    }
    write_user_templates(&app, &user_templates).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_exist() {
        let builtins = builtin_templates();
        assert!(builtins.len() >= 9);
        assert!(builtins.iter().all(|t| t.is_builtin));
        assert!(builtins.iter().all(|t| !t.id.is_empty()));
        assert!(builtins.iter().all(|t| !t.code.is_empty()));
    }

    #[test]
    fn test_builtin_template_ids_are_unique() {
        let builtins = builtin_templates();
        let mut ids: Vec<&str> = builtins.iter().map(|t| t.id.as_str()).collect();
        ids.sort();
        let len_before = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), len_before, "duplicate builtin ids found");
    }

    #[test]
    fn test_builtin_template_ids_prefixed() {
        let builtins = builtin_templates();
        assert!(builtins.iter().all(|t| t.id.starts_with("builtin-")));
    }

    #[test]
    fn test_script_template_serde_camel_case() {
        let t = ScriptTemplate {
            id: "x".into(),
            name: "n".into(),
            description: "d".into(),
            code: "c".into(),
            category: "cat".into(),
            is_builtin: false,
        };
        let json = serde_json::to_string(&t).unwrap();
        assert!(json.contains("\"isBuiltin\""));
        assert!(!json.contains("\"is_builtin\""));
    }
}
