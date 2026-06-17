use crate::script::engine::{
    ScriptEngine, ExecuteScriptParams, ScriptContext, ScriptResult,
    ScriptLog, TestResult, ScriptVariableChange,
};

fn basic_context() -> ScriptContext {
    ScriptContext {
        request: Some(serde_json::json!({
            "method": "GET",
            "url": "https://api.example.com/test",
            "headers": [{"key": "Accept", "value": "application/json"}],
            "body": null
        })),
        response: None,
        environment: Some([("HOST".into(), "localhost".into())].into()),
        collection_variables: None,
        globals: None,
    }
}

#[test]
fn test_execute_simple_script() {
    let params = ExecuteScriptParams {
        code: "pm.test('always passes', function() { pm.expect(true).to.be.true(); });".into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.test_results.iter().any(|t| t.name == "always passes" && t.passed));
    assert!(result.error.is_none());
    assert!(!result.timed_out);
}

#[test]
fn test_execute_script_with_console_log() {
    let params = ExecuteScriptParams {
        code: "console.log('hello world');".into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.logs.iter().any(|l| l.message.contains("hello world")));
}

#[test]
fn test_execute_script_with_failing_test() {
    let params = ExecuteScriptParams {
        code: "pm.test('fails', function() { pm.expect(true).to.be.false(); });".into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.test_results.iter().any(|t| t.name == "fails" && !t.passed));
}

#[test]
fn test_pm_response_in_post_response_context() {
    let post_ctx = ScriptContext {
        request: Some(serde_json::json!({"method": "POST", "url": "https://api.example.com"})),
        response: Some(serde_json::json!({
            "status": 201,
            "statusText": "Created",
            "headers": {"Content-Type": "application/json"},
            "body": r#"{"id":1,"name":"test"}"#,
            "time": 42
        })),
        environment: Some([("BASE".into(), "https://api.example.com".into())].into()),
        collection_variables: None,
        globals: None,
    };
    let params = ExecuteScriptParams {
        code: r#"
            pm.test('status is 201', function() {
                pm.expect(pm.response.status).to.equal(201);
            });
            pm.test('body has id', function() {
                var data = pm.response.json();
                pm.expect(data.id).to.equal(1);
            });
        "#.into(),
        context: post_ctx,
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.test_results.len() >= 2);
    assert!(result.test_results.iter().all(|t| t.passed));
}

#[test]
fn test_pm_environment_set() {
    let params = ExecuteScriptParams {
        code: r#"
            pm.environment.set('TOKEN', 'abc123');
            pm.environment.set('VERSION', '1.0');
        "#.into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.variables.iter().any(|v| v.key == "TOKEN" && v.value == "abc123" && v.scope == "environment"));
    assert!(result.variables.iter().any(|v| v.key == "VERSION" && v.value == "1.0"));
}

#[test]
fn test_pm_globals_set_and_get() {
    let params = ExecuteScriptParams {
        code: r#"
            pm.globals.set('counter', '42');
            var val = pm.globals.get('counter');
            pm.test('globals get', function() {
                pm.expect(val).to.equal('42');
            });
        "#.into(),
        context: ScriptContext {
            request: Some(serde_json::json!({"method": "GET", "url": "https://api.example.com"})),
            response: None,
            environment: None,
            collection_variables: None,
            globals: Some([("existing".into(), "value".into())].into()),
        },
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    // pm.globals.set pushes scope as 'globals' (plural) per engine.rs line 404
    assert!(result.test_results.iter().any(|t| t.name == "globals get" && t.passed));
    assert!(result.variables.iter().any(|v| v.key == "counter" && v.scope == "globals"));
}

#[test]
fn test_pm_collection_variables() {
    let params = ExecuteScriptParams {
        code: r#"pm.collectionVariables.set('api_key', 'xyz');"#.into(),
        context: ScriptContext {
            request: Some(serde_json::json!({"method": "GET", "url": "https://api.example.com"})),
            response: None,
            environment: None,
            collection_variables: Some([("version".into(), "v1".into())].into()),
            globals: None,
        },
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.variables.iter().any(|v| v.key == "api_key" && v.scope == "collection"));
}

#[test]
fn test_script_with_syntax_error() {
    let params = ExecuteScriptParams {
        code: "this is not valid javascript!!!".into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(!result.success);
    assert!(result.error.is_some());
}

#[test]
fn test_script_timeout() {
    let params = ExecuteScriptParams {
        code: "while(true) {}".into(),
        context: basic_context(),
        timeout_ms: Some(100),
    };
    let result = ScriptEngine::execute(params);
    assert!(!result.success);
    assert!(result.timed_out);
    assert!(result.error.unwrap().contains("timed out"));
}

#[test]
fn test_pm_expect_basic_assertions() {
    let params = ExecuteScriptParams {
        code: r#"
            pm.test('equal', function() { pm.expect(1).to.equal(1); });
            pm.test('eql', function() { pm.expect({a:1}).to.eql({a:1}); });
            pm.test('true', function() { pm.expect(true).to.be.true(); });
            pm.test('false', function() { pm.expect(false).to.be.false(); });
            pm.test('a type', function() { pm.expect(42).to.be.a('number'); });
            pm.test('above', function() { pm.expect(10).to.be.above(5); });
            pm.test('below', function() { pm.expect(3).to.be.below(10); });
        "#.into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.test_results[0].passed);
    assert_eq!(result.test_results.len(), 7);
    assert!(result.test_results.iter().all(|t| t.passed));
}

#[test]
fn test_pm_expect_include_and_property() {
    let params = ExecuteScriptParams {
        code: r#"
            pm.test('include', function() { pm.expect([1,2,3]).to.include(2); });
            pm.test('has property', function() { pm.expect({x:1}).to.have.property('x'); });
        "#.into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.test_results.iter().all(|t| t.passed));
}

#[test]
fn test_console_levels() {
    let params = ExecuteScriptParams {
        code: r#"
            console.log('log message');
            console.warn('warning message');
            console.error('error message');
            console.info('info message');
        "#.into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    assert!(result.logs.iter().any(|l| l.level == "log" && l.message.contains("log message")));
    assert!(result.logs.iter().any(|l| l.level == "warn" && l.message.contains("warning message")));
    assert!(result.logs.iter().any(|l| l.level == "error" && l.message.contains("error message")));
    assert!(result.logs.iter().any(|l| l.level == "info" && l.message.contains("info message")));
}

#[test]
fn test_crypto_random_uuid() {
    let params = ExecuteScriptParams {
        code: "var id = crypto.randomUUID(); pm.test('is uuid', function() { pm.expect(id).to.have.property('length'); });".into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
    // UUID is a string, so it has the .length property
}

#[test]
fn test_empty_script() {
    let params = ExecuteScriptParams {
        code: "".into(),
        context: basic_context(),
        timeout_ms: Some(5000),
    };
    let result = ScriptEngine::execute(params);
    assert!(result.success);
}

#[test]
fn test_script_result_serde() {
    let result = ScriptResult {
        success: true,
        logs: vec![ScriptLog { level: "info".into(), message: "test".into(), timestamp: "2025-01-01T00:00:00Z".into() }],
        test_results: vec![TestResult { name: "T1".into(), passed: true, error: None, duration_ms: 5 }],
        variables: vec![ScriptVariableChange { scope: "environment".into(), key: "KEY".into(), value: "val".into() }],
        modified_request: None,
        error: None,
        timed_out: false,
    };
    let json = serde_json::to_string(&result).unwrap();
    let parsed: ScriptResult = serde_json::from_str(&json).unwrap();
    assert!(parsed.success);
    assert_eq!(parsed.logs.len(), 1);
    assert_eq!(parsed.test_results.len(), 1);
    assert_eq!(parsed.variables.len(), 1);
}

#[test]
fn test_script_result_timeout() {
    let result = ScriptResult {
        success: false,
        logs: vec![],
        test_results: vec![],
        variables: vec![],
        modified_request: None,
        error: Some("Script timed out after 100ms".into()),
        timed_out: true,
    };
    let json = serde_json::to_string(&result).unwrap();
    let parsed: ScriptResult = serde_json::from_str(&json).unwrap();
    assert!(parsed.timed_out);
    assert_eq!(parsed.error.unwrap(), "Script timed out after 100ms");
}