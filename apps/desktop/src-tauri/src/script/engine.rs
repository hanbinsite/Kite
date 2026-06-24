use rquickjs::{Runtime, Context, Ctx, Object};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

const MEMORY_LIMIT_BYTES: usize = 128 * 1024 * 1024;
const STACK_SIZE_BYTES: usize = 1024 * 1024;
const DEFAULT_TIMEOUT_MS: u64 = 5000;
const SEND_REQUEST_TIMEOUT_SECS: u64 = 30;

static SEND_REQUEST_CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();

fn send_request_client() -> &'static reqwest::blocking::Client {
    SEND_REQUEST_CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(SEND_REQUEST_TIMEOUT_SECS))
            .build()
            .expect("Failed to build script HTTP client")
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLog {
    pub level: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptVariableChange {
    pub scope: String,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptResult {
    pub success: bool,
    pub logs: Vec<ScriptLog>,
    pub test_results: Vec<TestResult>,
    pub variables: Vec<ScriptVariableChange>,
    pub modified_request: Option<serde_json::Value>,
    pub error: Option<String>,
    pub timed_out: bool,
    pub set_cookie_headers: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptContext {
    pub request: Option<serde_json::Value>,
    pub response: Option<serde_json::Value>,
    pub environment: Option<HashMap<String, String>>,
    pub collection_variables: Option<HashMap<String, String>>,
    pub globals: Option<HashMap<String, String>>,
    pub cookie_header: Option<String>,
    pub auth_header: Option<AuthHeaderEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthHeaderEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteScriptParams {
    pub code: String,
    pub context: ScriptContext,
    pub timeout_ms: Option<u64>,
}

pub struct ScriptEngine;

impl ScriptEngine {
    pub fn execute(params: ExecuteScriptParams) -> ScriptResult {
        let timeout_ms = params.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
        let (tx, rx) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            let result = Self::run_in_thread(&params);
            let _ = tx.send(result);
        });

        match rx.recv_timeout(Duration::from_millis(timeout_ms)) {
            Ok(result) => result,
            Err(_) => ScriptResult {
                success: false,
                logs: vec![],
                test_results: vec![],
                variables: vec![],
                modified_request: None,
                error: Some(format!("Script timed out after {}ms", timeout_ms)),
                timed_out: true,
                set_cookie_headers: vec![],
            },
        }
    }

    fn run_in_thread(params: &ExecuteScriptParams) -> ScriptResult {
        let rt = match Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                return ScriptResult {
                    success: false, logs: vec![], test_results: vec![],
                    variables: vec![], modified_request: None,
                    timed_out: false, set_cookie_headers: vec![],
                    error: Some(format!("Failed to create runtime: {}", e)),
                };
            }
        };

        rt.set_memory_limit(MEMORY_LIMIT_BYTES);
        rt.set_max_stack_size(STACK_SIZE_BYTES);

        let ctx = match Context::full(&rt) {
            Ok(ctx) => ctx,
            Err(e) => {
                return ScriptResult {
                    success: false, logs: vec![], test_results: vec![],
                    variables: vec![], modified_request: None,
                    timed_out: false, set_cookie_headers: vec![],
                    error: Some(format!("Failed to create context: {}", e)),
                };
            }
        };

        let cookie_header = params.context.cookie_header.clone();
        let auth_header = params.context.auth_header.clone();
        let collected_cookies = Arc::new(Mutex::new(Vec::<String>::new()));

        let pm_js = Self::build_pm_js(&params.context);

        ctx.with(|ctx| {
            let cc = Arc::clone(&collected_cookies);
            let send_req_fn = match rquickjs::Function::new(
                ctx.clone(),
                move |config: Object| -> String {
                    Self::handle_send_request_json(config, &cookie_header, &auth_header, &cc)
                },
            ) {
                Ok(f) => f,
                Err(e) => {
                    tracing::warn!("Failed to create sendRequest function: {}", e);
                    return;
                }
            };
            let _ = ctx.globals().set("__sendRequest", send_req_fn);
        });

        let full_script = format!("{}\n{}", pm_js, params.code);

        let exec_result: Result<(), rquickjs::Error> = ctx.with(|ctx| {
            ctx.eval::<(), _>(full_script.as_str())
        });

        let (logs, test_results, variables) = ctx.with(|ctx| {
            let logs = Self::extract_logs(&ctx);
            let tests = Self::extract_tests(&ctx);
            let vars = Self::extract_variables(&ctx);
            (logs, tests, vars)
        });

        match exec_result {
            Ok(()) => {
                let cookies: Vec<String> = match Arc::try_unwrap(collected_cookies) {
                    Ok(mutex) => mutex.into_inner().unwrap_or_default(),
                    Err(arc) => arc.lock().unwrap_or_else(|e| e.into_inner()).clone(),
                };
                ScriptResult {
                    success: true,
                    logs,
                    test_results,
                    variables,
                    modified_request: None,
                    error: None,
                    timed_out: false,
                    set_cookie_headers: cookies,
                }
            }
            Err(e) => ScriptResult {
                success: false,
                logs,
                test_results,
                variables,
                modified_request: None,
                error: Some(format!("{}", e)),
                timed_out: false,
                set_cookie_headers: vec![],
            },
        }
    }

    fn handle_send_request_json(
        config: Object,
        cookie_header: &Option<String>,
        auth_header: &Option<AuthHeaderEntry>,
        collected_cookies: &Arc<Mutex<Vec<String>>>,
    ) -> String {
        let url: String = config.get("url").unwrap_or_default();
        let method: String = config.get("method").unwrap_or_else(|_| "GET".into());

        let mut headers_vec: Vec<(String, String)> = Vec::new();
        if let Ok(headers_val) = config.get::<_, Object>("header") {
            for key in headers_val.keys::<String>().flatten() {
                if let Ok(val) = headers_val.get::<_, String>(&key) {
                    headers_vec.push((key, val));
                }
            }
        }

        let body_str: Option<String> = config.get("body").ok();

        let client = send_request_client();

        let method_req = match method.to_uppercase().as_str() {
            "POST" => reqwest::Method::POST,
            "PUT" => reqwest::Method::PUT,
            "PATCH" => reqwest::Method::PATCH,
            "DELETE" => reqwest::Method::DELETE,
            "HEAD" => reqwest::Method::HEAD,
            "OPTIONS" => reqwest::Method::OPTIONS,
            _ => reqwest::Method::GET,
        };

        let mut req_builder = client.request(method_req, &url);
        for (k, v) in &headers_vec {
            req_builder = req_builder.header(k.as_str(), v.as_str());
        }
        if let Some(ref cookie) = cookie_header {
            if !cookie.is_empty() {
                req_builder = req_builder.header("Cookie", cookie.as_str());
            }
        }
        if let Some(ref auth) = auth_header {
            req_builder = req_builder.header(auth.key.as_str(), auth.value.as_str());
        }
        if let Some(ref body) = body_str {
            req_builder = req_builder.body(body.clone());
        }

        match req_builder.send() {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let status_text = resp.status().canonical_reason().unwrap_or("").to_string();
                let set_cookie_headers: Vec<String> = resp.headers()
                    .get_all("set-cookie")
                    .iter()
                    .filter_map(|v| v.to_str().ok().map(|s| s.to_string()))
                    .collect();
                let resp_headers: HashMap<String, String> = resp.headers().iter()
                    .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                    .collect();
                let body = resp.text().unwrap_or_default();
                if !set_cookie_headers.is_empty() {
                    if let Ok(mut cc) = collected_cookies.lock() {
                        cc.extend(set_cookie_headers.clone());
                    }
                }
                serde_json::json!({
                    "status": status,
                    "statusText": status_text,
                    "headers": resp_headers,
                    "body": body,
                    "setCookieHeaders": set_cookie_headers
                }).to_string()
            }
            Err(e) => {
                serde_json::json!({"status": 0, "error": e.to_string(), "body": "", "headers": {}, "setCookieHeaders": []}).to_string()
            }
        }
    }

    fn extract_logs(ctx: &Ctx) -> Vec<ScriptLog> {
        let mut result = Vec::new();
        let Ok(arr) = ctx.globals().get::<_, rquickjs::Value>("__logs") else { return result };
        let Some(obj) = arr.as_object() else { return result };
        let Ok(len) = obj.get::<_, i32>("length") else { return result };

        for i in 0..len {
            if let Ok(item) = obj.get::<_, Object>(i) {
                let level = item.get::<_, String>("level").unwrap_or_default();
                let message = item.get::<_, String>("message").unwrap_or_default();
                let timestamp = item.get::<_, String>("timestamp").unwrap_or_default();
                result.push(ScriptLog { level, message, timestamp });
            }
        }
        result
    }

    fn extract_tests(ctx: &Ctx) -> Vec<TestResult> {
        let mut result = Vec::new();
        let Ok(arr) = ctx.globals().get::<_, rquickjs::Value>("__tests") else { return result };
        let Some(obj) = arr.as_object() else { return result };
        let Ok(len) = obj.get::<_, i32>("length") else { return result };

        for i in 0..len {
            if let Ok(item) = obj.get::<_, Object>(i) {
                let name = item.get::<_, String>("name").unwrap_or_default();
                let passed = item.get::<_, bool>("passed").unwrap_or(false);
                let error = item.get::<_, Option<String>>("error").ok().flatten();
                let duration_ms = item.get::<_, u64>("duration_ms").unwrap_or(0);
                result.push(TestResult { name, passed, error, duration_ms });
            }
        }
        result
    }

    fn extract_variables(ctx: &Ctx) -> Vec<ScriptVariableChange> {
        let mut result = Vec::new();
        let Ok(arr) = ctx.globals().get::<_, rquickjs::Value>("__vars") else { return result };
        let Some(obj) = arr.as_object() else { return result };
        let Ok(len) = obj.get::<_, i32>("length") else { return result };

        for i in 0..len {
            if let Ok(item) = obj.get::<_, Object>(i) {
                let scope = item.get::<_, String>("scope").unwrap_or_default();
                let key = item.get::<_, String>("key").unwrap_or_default();
                let value = item.get::<_, String>("value").unwrap_or_default();
                result.push(ScriptVariableChange { scope, key, value });
            }
        }
        result
    }

    fn build_pm_js(context: &ScriptContext) -> String {
        let req_method = serde_json::to_string(context.request.as_ref()
            .and_then(|r| r.get("method")).and_then(|v| v.as_str()).unwrap_or("GET"))
            .unwrap_or_else(|_| "\"GET\"".into());
        let req_url = serde_json::to_string(context.request.as_ref()
            .and_then(|r| r.get("url")).and_then(|v| v.as_str()).unwrap_or(""))
            .unwrap_or_else(|_| "\"\"".into());
        let req_headers = context.request.as_ref()
            .and_then(|r| r.get("headers"))
            .map(|h| serde_json::to_string(h).unwrap_or_else(|_| "[]".into()))
            .unwrap_or_else(|| "[]".into());
        let req_body = context.request.as_ref()
            .and_then(|r| r.get("body"))
            .and_then(|v| v.as_str())
            .map(|s| serde_json::to_string(s).unwrap_or_else(|_| "undefined".into()))
            .unwrap_or_else(|| "undefined".into());

        let resp_status = context.response.as_ref()
            .and_then(|r| r.get("status")).and_then(|v| v.as_i64()).unwrap_or(0);
        let resp_status_text = serde_json::to_string(context.response.as_ref()
            .and_then(|r| r.get("statusText")).and_then(|v| v.as_str()).unwrap_or(""))
            .unwrap_or_else(|_| "\"\"".into());
        let resp_headers = context.response.as_ref()
            .and_then(|r| r.get("headers"))
            .map(|h| serde_json::to_string(h).unwrap_or_else(|_| "{}".into()))
            .unwrap_or_else(|| "{}".into());
        let resp_body = serde_json::to_string(context.response.as_ref()
            .and_then(|r| r.get("body")).and_then(|v| v.as_str()).unwrap_or(""))
            .unwrap_or_else(|_| "\"\"".into());
        let resp_time = context.response.as_ref()
            .and_then(|r| r.get("time")).and_then(|v| v.as_u64()).unwrap_or(0);

        let env_obj = context.environment.as_ref()
            .map(|e| serde_json::to_string(e).unwrap_or_else(|_| "{}".into()))
            .unwrap_or_else(|| "{}".into());
        let globals_obj = context.globals.as_ref()
            .map(|g| serde_json::to_string(g).unwrap_or_else(|_| "{}".into()))
            .unwrap_or_else(|| "{}".into());
        let coll_obj = context.collection_variables.as_ref()
            .map(|c| serde_json::to_string(c).unwrap_or_else(|_| "{}".into()))
            .unwrap_or_else(|| "{}".into());

        format!(r#"
var __logs = [];
var __tests = [];
var __vars = [];

var crypto = {{
    randomUUID: function() {{
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {{
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }});
    }}
}};

var console = {{
    log: function() {{ __logs.push({{level: 'log', message: Array.from(arguments).map(function(a) {{ return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }}).join(' '), timestamp: new Date().toISOString()}}); }},
    warn: function() {{ __logs.push({{level: 'warn', message: Array.from(arguments).map(function(a) {{ return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }}).join(' '), timestamp: new Date().toISOString()}}); }},
    error: function() {{ __logs.push({{level: 'error', message: Array.from(arguments).map(function(a) {{ return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }}).join(' '), timestamp: new Date().toISOString()}}); }},
    info: function() {{ __logs.push({{level: 'info', message: Array.from(arguments).map(function(a) {{ return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }}).join(' '), timestamp: new Date().toISOString()}}); }}
}};

var pm = {{}};

pm.request = {{
    method: {req_method},
    url: {req_url},
    headers: {req_headers},
    body: {req_body},
    getHeaders: function() {{ return this.headers; }},
    addHeader: function(key, value) {{
        for (var i = 0; i < this.headers.length; i++) {{
            if (this.headers[i].key === key) {{
                this.headers[i].value = value;
                return;
            }}
        }}
        this.headers.push({{key: key, value: value}});
    }},
    removeHeader: function(key) {{
        this.headers = this.headers.filter(function(h) {{ return h.key !== key; }});
    }}
}};

pm.response = {{
    status: {resp_status},
    statusText: {resp_status_text},
    headers: {resp_headers},
    _body: {resp_body},
    time: {resp_time},
    json: function() {{ try {{ return JSON.parse(this._body); }} catch(e) {{ throw new Error('Response body is not valid JSON: ' + e.message); }} }},
    text: function() {{ return this._body; }},
    size: function() {{ return this._body.length; }}
}};

pm.environment = (function() {{
    var _data = {env_obj};
    return {{
        get: function(key) {{ return _data[key]; }},
        set: function(key, value) {{ _data[key] = String(value); __vars.push({{scope: 'environment', key: key, value: String(value)}}); }},
        unset: function(key) {{ delete _data[key]; }},
        has: function(key) {{ return _data.hasOwnProperty(key); }}
    }};
}})();

pm.globals = (function() {{
    var _data = {globals_obj};
    return {{
        get: function(key) {{ return _data[key]; }},
        set: function(key, value) {{ _data[key] = String(value); __vars.push({{scope: 'globals', key: key, value: String(value)}}); }},
        unset: function(key) {{ delete _data[key]; }}
    }};
}})();

pm.collectionVariables = (function() {{
    var _data = {coll_obj};
    return {{
        get: function(key) {{ return _data[key]; }},
        set: function(key, value) {{ _data[key] = String(value); __vars.push({{scope: 'collection', key: key, value: String(value)}}); }}
    }};
}})();

pm.variables = {{
    get: function(key) {{
        var v = pm.environment.get(key);
        if (v !== undefined) return v;
        v = pm.collectionVariables.get(key);
        if (v !== undefined) return v;
        v = pm.globals.get(key);
        return v;
    }},
    set: function(key, value) {{ pm.environment.set(key, value); }}
}};

pm.test = function(name, fn) {{
    var start = Date.now();
    var passed = true;
    var error = null;
    try {{
        fn();
    }} catch(e) {{
        passed = false;
        error = e.message || String(e);
    }}
    var duration = Date.now() - start;
    __tests.push({{name: name, passed: passed, error: error, duration_ms: duration}});
}};

pm.expect = function(actual) {{
    var negated = false;
    var api = {{
        to: {{
            eql: function(expected) {{
                if (negated ? JSON.stringify(actual) === JSON.stringify(expected) : JSON.stringify(actual) !== JSON.stringify(expected))
                    throw new Error(negated ? 'Expected values not to be equal' : 'Expected ' + JSON.stringify(actual) + ' to eql ' + JSON.stringify(expected));
                negated = false;
            }},
            equal: function(expected) {{
                if (negated ? actual === expected : actual !== expected)
                    throw new Error(negated ? 'Expected values not to be equal' : 'Expected ' + actual + ' to equal ' + expected);
                negated = false;
            }},
            have: {{
                property: function(prop) {{
                    var has = actual !== null && actual !== undefined && actual.hasOwnProperty(prop);
                    if (negated ? has : !has)
                        throw new Error(negated ? 'Expected not to have property ' + prop : 'Expected to have property ' + prop);
                    negated = false;
                }}
            }},
            be: {{
                a: function(type) {{
                    if (negated ? typeof actual === type : typeof actual !== type)
                        throw new Error('Expected ' + typeof actual + ' to be ' + type);
                    negated = false;
                }},
                above: function(n) {{
                    if (negated ? actual > n : actual <= n)
                        throw new Error('Expected ' + actual + ' to be above ' + n);
                    negated = false;
                }},
                below: function(n) {{
                    if (negated ? actual < n : actual >= n)
                        throw new Error('Expected ' + actual + ' to be below ' + n);
                    negated = false;
                }},
                true: function() {{
                    if (negated ? actual === true : actual !== true) throw new Error('Expected true');
                    negated = false;
                }},
                false: function() {{
                    if (negated ? actual === false : actual !== false) throw new Error('Expected false');
                    negated = false;
                }}
            }},
            include: function(val) {{
                var has = actual && (Array.isArray(actual) ? actual.indexOf(val) >= 0 : String(actual).indexOf(val) >= 0);
                if (negated ? has : !has) throw new Error('Expected to include ' + val);
                negated = false;
            }}
        }},
        not: {{
            get to() {{ negated = true; return api.to; }}
        }}
    }};
    return api;
}};

pm.sendRequest = function(configOrUrl, callback) {{
    var config;
    if (typeof configOrUrl === 'string') {{
        config = {{ url: configOrUrl, method: 'GET' }};
    }} else {{
        config = configOrUrl;
    }}
    try {{
        var result = JSON.parse(__sendRequest(config));
        var response = {{
            status: result.status,
            statusText: result.statusText || '',
            headers: result.headers || {{}},
            body: result.body || '',
            setCookieHeaders: result.setCookieHeaders || [],
            json: function() {{ try {{ return JSON.parse(this.body); }} catch(e) {{ throw new Error('Response is not valid JSON: ' + e.message); }} }},
            text: function() {{ return this.body; }},
            time: 0,
            size: function() {{ return this.body.length; }}
        }};
        if (result.error) {{
            var err = new Error(result.error);
            if (callback) {{ callback(err, null); return; }}
            throw err;
        }}
        if (callback) {{ callback(null, response); }}
        return response;
    }} catch(e) {{
        if (callback) {{ callback(e, null); return; }}
        throw e;
    }}
}};
"#)
    }
}
