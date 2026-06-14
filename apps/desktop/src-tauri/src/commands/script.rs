use crate::error::AppError;
use crate::script::engine::{ExecuteScriptParams, ScriptResult};

#[tauri::command]
pub async fn execute_script(
    params: ExecuteScriptParams,
) -> Result<ScriptResult, AppError> {
    let timeout_ms = params.timeout_ms;
    let result = crate::script::engine::ScriptEngine::execute(params);
    if result.timed_out {
        return Err(AppError::script_timeout(timeout_ms.unwrap_or(5000)));
    }
    Ok(result)
}
