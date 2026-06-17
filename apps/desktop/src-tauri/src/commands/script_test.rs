use crate::commands::script;
use crate::script::engine::{ExecuteScriptParams, ScriptContext, ScriptResult};

#[test]
fn test_execute_script_success() {
    let params = ExecuteScriptParams {
        code: "pm.test('ok', function() { pm.expect(true).to.be.true(); });".into(),
        context: ScriptContext {
            request: None,
            response: None,
            environment: None,
            collection_variables: None,
            globals: None,
        },
        timeout_ms: Some(5000),
    };
    let result = crate::script::engine::ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.test_results.iter().any(|t| t.name == "ok" && t.passed));
}

#[test]
fn test_execute_script_failure() {
    let params = ExecuteScriptParams {
        code: "pm.test('fail', function() { pm.expect(false).to.be.true(); });".into(),
        context: ScriptContext {
            request: None,
            response: None,
            environment: None,
            collection_variables: None,
            globals: None,
        },
        timeout_ms: Some(5000),
    };
    let result = crate::script::engine::ScriptEngine::execute(params);
    assert!(!result.test_results.iter().any(|t| t.name == "fail" && t.passed));
}