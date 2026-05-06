use crate::error::AppError;
use crate::script::engine::{ExecuteScriptParams, ScriptResult};

#[tauri::command]
pub async fn execute_script(
    params: ExecuteScriptParams,
) -> Result<ScriptResult, AppError> {
    let result = crate::script::engine::ScriptEngine::execute(params);
    if !result.success && result.error.as_ref().is_some_and(|e| e.contains("timed out")) {
        return Err(AppError::script_timeout(0));
    }
    Ok(result)
}
