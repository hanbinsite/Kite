use crate::error::AppError;
use crate::script::engine::{ExecuteScriptParams, ScriptResult};

#[tauri::command]
pub async fn execute_script(
    params: ExecuteScriptParams,
) -> Result<ScriptResult, AppError> {
    let timeout_ms = params.timeout_ms;
    let result = tokio::task::spawn_blocking(move || {
        crate::script::engine::ScriptEngine::execute(params)
    })
    .await
    .map_err(|e| AppError::internal(format!("Script engine panicked: {}", e)))?;

    if result.timed_out {
        return Err(AppError::script_timeout(timeout_ms.unwrap_or(5000)));
    }
    Ok(result)
}
