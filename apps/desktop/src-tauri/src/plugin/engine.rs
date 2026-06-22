use rquickjs::{Context, Runtime, Value};
use std::time::Duration;

use crate::plugin::types::PluginHookResult;

const MEMORY_LIMIT_BYTES: usize = 64 * 1024 * 1024;
const STACK_SIZE_BYTES: usize = 1024 * 1024;
const TIMEOUT_MS: u64 = 3000;

pub struct PluginEngine;

impl PluginEngine {
    pub fn execute(
        plugin_id: &str,
        code: &str,
        function_name: &str,
        context_json: &str,
    ) -> PluginHookResult {
        let (tx, rx) = std::sync::mpsc::channel();
        let plugin_id_owned = plugin_id.to_string();
        let code_owned = code.to_string();
        let fn_name_owned = function_name.to_string();
        let ctx_json_owned = context_json.to_string();

        std::thread::spawn(move || {
            let result = Self::run_in_thread(
                &plugin_id_owned,
                &code_owned,
                &fn_name_owned,
                &ctx_json_owned,
            );
            let _ = tx.send(result);
        });

        match rx.recv_timeout(Duration::from_millis(TIMEOUT_MS)) {
            Ok(result) => result,
            Err(_) => PluginHookResult {
                plugin_id: plugin_id.to_string(),
                success: false,
                result: None,
                error: Some(format!("Plugin timed out after {}ms", TIMEOUT_MS)),
                logs: vec![],
                ui_inject: None,
            },
        }
    }

    fn run_in_thread(
        plugin_id: &str,
        code: &str,
        function_name: &str,
        context_json: &str,
    ) -> PluginHookResult {
        let empty_result = || PluginHookResult {
            plugin_id: plugin_id.to_string(),
            success: false,
            result: None,
            error: None,
            logs: vec![],
            ui_inject: None,
        };

        let rt = match Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                let mut r = empty_result();
                r.error = Some(format!("Failed to create runtime: {}", e));
                return r;
            }
        };

        rt.set_memory_limit(MEMORY_LIMIT_BYTES);
        rt.set_max_stack_size(STACK_SIZE_BYTES);

        let ctx = match Context::full(&rt) {
            Ok(ctx) => ctx,
            Err(e) => {
                let mut r = empty_result();
                r.error = Some(format!("Failed to create context: {}", e));
                return r;
            }
        };

        let preamble = Self::build_preamble(context_json);
        let full_script = format!("{}\n{}", preamble, code);

        let eval_error: Option<String> = ctx.with(|qctx| {
            match qctx.eval::<(), _>(full_script.as_str()) {
                Ok(()) => None,
                Err(rquickjs::Error::Exception) => Some(Self::extract_exception(&qctx)),
                Err(e) => Some(format!("Plugin eval error: {}", e)),
            }
        });

        let logs_after_eval = ctx.with(|qctx| Self::extract_logs(&qctx));

        if let Some(err_msg) = eval_error {
            return PluginHookResult {
                plugin_id: plugin_id.to_string(),
                success: false,
                result: None,
                error: Some(err_msg),
                logs: logs_after_eval,
                ui_inject: None,
            };
        }

        let (call_outcome, logs_after_call) = ctx.with(|qctx| {
            let globals = qctx.globals();
            let func: Option<rquickjs::Function> = globals.get(function_name).ok();
            let Some(func) = func else {
                return (CallOutcome::Missing, Self::extract_logs(&qctx));
            };
            let arg = match qctx.json_parse(context_json.as_bytes()) {
                Ok(v) => v,
                Err(rquickjs::Error::Exception) => {
                    return (
                        CallOutcome::Error(Self::extract_exception(&qctx)),
                        Self::extract_logs(&qctx),
                    );
                }
                Err(e) => {
                    return (
                        CallOutcome::Error(format!("Failed to parse context: {}", e)),
                        Self::extract_logs(&qctx),
                    );
                }
            };
            match func.call::<_, Value>((arg,)) {
                Ok(value) => {
                    let opt_str = qctx.json_stringify(&value).ok().flatten();
                    let str_val = opt_str
                        .and_then(|s| s.to_string().ok())
                        .unwrap_or_else(|| "null".to_string());
                    (CallOutcome::Value(str_val), Self::extract_logs(&qctx))
                }
                Err(rquickjs::Error::Exception) => {
                    (
                        CallOutcome::Error(Self::extract_exception(&qctx)),
                        Self::extract_logs(&qctx),
                    )
                }
                Err(e) => (
                    CallOutcome::Error(format!("Plugin execution error: {}", e)),
                    Self::extract_logs(&qctx),
                ),
            }
        });

        let ui_inject = ctx.with(|qctx| Self::extract_ui_inject(&qctx));

        match call_outcome {
            CallOutcome::Missing => PluginHookResult {
                plugin_id: plugin_id.to_string(),
                success: false,
                result: None,
                error: Some(format!("Function '{}' not exported by plugin", function_name)),
                logs: logs_after_call,
                ui_inject,
            },
            CallOutcome::Error(msg) => PluginHookResult {
                plugin_id: plugin_id.to_string(),
                success: false,
                result: None,
                error: Some(msg),
                logs: logs_after_call,
                ui_inject,
            },
            CallOutcome::Value(json_str) => {
                let parsed = serde_json::from_str::<serde_json::Value>(&json_str).ok();
                let is_null = parsed.as_ref().map(|v| v.is_null()).unwrap_or(true);
                PluginHookResult {
                    plugin_id: plugin_id.to_string(),
                    success: true,
                    result: if is_null { None } else { parsed },
                    error: None,
                    logs: logs_after_call,
                    ui_inject,
                }
            }
        }
    }

    fn extract_exception(qctx: &rquickjs::Ctx) -> String {
        let exc = qctx.catch();
        if exc.is_undefined() || exc.is_null() {
            return "Unknown exception".to_string();
        }
        if let Some(s) = exc.as_string() {
            if let Ok(msg) = s.to_string() {
                return msg;
            }
        }
        if let Some(obj) = exc.as_object() {
            if let Ok(msg) = obj.get::<_, String>("message") {
                return msg;
            }
        }
        "Unknown exception".to_string()
    }

    fn build_preamble(context_json: &str) -> String {
        let ctx_json_safe = serde_json::to_string(context_json)
            .unwrap_or_else(|_| "\"{}\"".to_string());
        format!(
            r#"
var __pluginLogs = [];
var __pluginUiInject = null;
var __pluginContextJson = {ctx_json_safe};

function __pluginJoinArgs(args) {{
    var parts = [];
    for (var i = 0; i < args.length; i++) {{
        var a = args[i];
        if (typeof a === 'string') {{
            parts.push(a);
        }} else if (typeof a === 'object' && a !== null) {{
            try {{ parts.push(JSON.stringify(a)); }}
            catch(e) {{ parts.push(String(a)); }}
        }} else {{
            parts.push(String(a));
        }}
    }}
    return parts.join(' ');
}}

var __plugin = {{
    log: function() {{
        __pluginLogs.push(__pluginJoinArgs(Array.prototype.slice.call(arguments)));
    }},
    injectUI: function(target, html) {{
        __pluginUiInject = target + '::' + html;
    }},
    getData: function() {{
        try {{ return JSON.parse(__pluginContextJson); }}
        catch(e) {{ return {{}}; }}
    }}
}};

var console = {{
    log: function() {{ __pluginLogs.push('[log] ' + __pluginJoinArgs(Array.prototype.slice.call(arguments))); }},
    info: function() {{ __pluginLogs.push('[info] ' + __pluginJoinArgs(Array.prototype.slice.call(arguments))); }},
    warn: function() {{ __pluginLogs.push('[warn] ' + __pluginJoinArgs(Array.prototype.slice.call(arguments))); }},
    error: function() {{ __pluginLogs.push('[error] ' + __pluginJoinArgs(Array.prototype.slice.call(arguments))); }}
}};
"#,
            ctx_json_safe = ctx_json_safe
        )
    }

    fn extract_logs(qctx: &rquickjs::Ctx) -> Vec<String> {
        let mut result = Vec::new();
        let Ok(arr) = qctx.globals().get::<_, rquickjs::Value>("__pluginLogs") else {
            return result;
        };
        let Some(obj) = arr.as_object() else {
            return result;
        };
        let Ok(len) = obj.get::<_, i32>("length") else {
            return result;
        };
        for i in 0..len {
            if let Ok(s) = obj.get::<_, String>(i) {
                result.push(s);
            }
        }
        result
    }

    fn extract_ui_inject(qctx: &rquickjs::Ctx) -> Option<String> {
        let val: rquickjs::Value = qctx.globals().get("__pluginUiInject").ok()?;
        if val.is_null() || val.is_undefined() {
            return None;
        }
        let s: String = val.as_string()?.to_string().ok()?;
        if s.is_empty() {
            None
        } else {
            Some(s)
        }
    }
}

enum CallOutcome {
    Value(String),
    Error(String),
    Missing,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execute_simple_return() {
        let code = "globalThis.onCommand = function(ctx) { return { ok: true }; };";
        let result = PluginEngine::execute("test-plugin", code, "onCommand", "{}");
        assert!(result.success, "expected success, error: {:?}", result.error);
        assert_eq!(result.plugin_id, "test-plugin");
        let val = result.result.expect("result should be present");
        assert_eq!(val["ok"], true);
    }

    #[test]
    fn test_execute_collects_logs() {
        let code =
            "globalThis.onCommand = function(ctx) { __plugin.log('hello', 42); return null; };";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(result.success);
        assert!(result.logs.iter().any(|l| l.contains("hello") && l.contains("42")));
    }

    #[test]
    fn test_execute_console_log_collected() {
        let code =
            "globalThis.onCommand = function(ctx) { console.log('from console'); return null; };";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(result.success);
        assert!(result
            .logs
            .iter()
            .any(|l| l.contains("from console") && l.contains("[log]")));
    }

    #[test]
    fn test_execute_collects_ui_injection() {
        let code = "globalThis.onResponseReceived = function(ctx) { __plugin.injectUI('response-tab', '<div>hi</div>'); return { modified: false }; };";
        let result = PluginEngine::execute("p", code, "onResponseReceived", "{}");
        assert!(result.success);
        assert!(result.ui_inject.is_some());
        let inject = result.ui_inject.unwrap();
        assert!(inject.contains("response-tab"));
        assert!(inject.contains("<div>hi</div>"));
    }

    #[test]
    fn test_execute_missing_function() {
        let code = "var x = 1;";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("not exported"));
    }

    #[test]
    fn test_execute_handles_eval_error() {
        let code = "throw new Error('boom');";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("boom"));
    }

    #[test]
    fn test_execute_get_data_returns_context() {
        let code = "globalThis.onCommand = function(ctx) { var d = __plugin.getData(); return { event: d.event }; };";
        let ctx_json = r#"{"event":"custom-event","data":{}}"#;
        let result = PluginEngine::execute("p", code, "onCommand", ctx_json);
        assert!(result.success);
        let val = result.result.unwrap();
        assert_eq!(val["event"], "custom-event");
    }

    #[test]
    fn test_execute_timeout_returns_error() {
        let code = "globalThis.onCommand = function(ctx) { while(true){} return null; };";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("timed out"));
    }

    #[test]
    fn test_execute_null_return() {
        let code = "globalThis.onCommand = function(ctx) { return null; };";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(result.success);
        assert!(result.result.is_none());
    }

    #[test]
    fn test_execute_function_throws() {
        let code = "globalThis.onCommand = function(ctx) { throw new Error('cmd-failed'); };";
        let result = PluginEngine::execute("p", code, "onCommand", "{}");
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("cmd-failed"));
    }
}
