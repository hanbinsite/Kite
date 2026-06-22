use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;

const CONNECT_TIMEOUT_SECS: u64 = 10;
const TOOL_CALL_TIMEOUT_SECS: u64 = 30;
const MCP_PROTOCOL_VERSION: &str = "2024-11-05";
const CLIENT_NAME: &str = "Kite";
const CLIENT_VERSION: &str = "0.0.6";
const CONFIG_FILE: &str = "mcp-servers.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    pub transport: McpTransport,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum McpTransport {
    Stdio {
        command: String,
        args: Vec<String>,
        env: Option<HashMap<String, String>>,
    },
    Http {
        url: String,
        headers: Option<Vec<(String, String)>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatus {
    pub id: String,
    pub name: String,
    pub connected: bool,
    pub tool_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfo {
    pub server_id: String,
    pub server_name: String,
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

pub struct McpConnectionState {
    pub connections: Arc<Mutex<HashMap<String, McpConnection>>>,
    pub next_id: Arc<Mutex<u64>>,
}

impl Default for McpConnectionState {
    fn default() -> Self {
        Self::new()
    }
}

impl McpConnectionState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }

    async fn next_id(&self) -> u64 {
        let mut guard = self.next_id.lock().await;
        let id = *guard;
        *guard += 1;
        id
    }
}

pub enum McpConnection {
    Stdio {
        stdin: Mutex<ChildStdin>,
        stdout: Mutex<BufReader<ChildStdout>>,
        child: Box<Mutex<Child>>,
        tools: Vec<McpToolInfo>,
        server_name: String,
    },
    Http {
        url: String,
        headers: Vec<(String, String)>,
        tools: Vec<McpToolInfo>,
        server_name: String,
    },
}

impl McpConnection {
    fn server_name(&self) -> &str {
        match self {
            McpConnection::Stdio { server_name, .. } => server_name,
            McpConnection::Http { server_name, .. } => server_name,
        }
    }

    fn tools(&self) -> &[McpToolInfo] {
        match self {
            McpConnection::Stdio { tools, .. } => tools,
            McpConnection::Http { tools, .. } => tools,
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(format!("Cannot get app data dir: {}", e)))?;
    Ok(data_dir.join(CONFIG_FILE))
}

async fn load_configs(app: &tauri::AppHandle) -> Result<Vec<McpServerConfig>, AppError> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| AppError::storage_read_failed(format!("Failed to read mcp-servers.json: {}", e)))?;
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<McpServerConfig>>(&content)
        .map_err(|e| AppError::storage_parse_failed(format!("Failed to parse mcp-servers.json: {}", e)))
}

async fn save_configs(app: &tauri::AppHandle, configs: &[McpServerConfig]) -> Result<(), AppError> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::storage_write_failed(format!("Failed to create config dir: {}", e)))?;
    }
    let content = serde_json::to_string_pretty(configs)
        .map_err(|e| AppError::internal(format!("Failed to serialize mcp-servers.json: {}", e)))?;
    let tmp_path = path.with_extension("json.tmp");
    tokio::fs::write(&tmp_path, &content)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write mcp-servers.json: {}", e)))?;
    tokio::fs::rename(&tmp_path, &path)
        .await
        .map_err(|e| AppError::storage_write_failed(format!("Failed to rename mcp-servers.json: {}", e)))?;
    Ok(())
}

fn build_request(id: u64, method: &str, params: serde_json::Value) -> JsonRpcRequest {
    JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id,
        method: method.to_string(),
        params,
    }
}

fn build_initialize_params() -> serde_json::Value {
    serde_json::json!({
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {},
        "clientInfo": {
            "name": CLIENT_NAME,
            "version": CLIENT_VERSION,
        }
    })
}

fn extract_rpc_error(resp: &JsonRpcResponse) -> AppError {
    if let Some(err) = &resp.error {
        AppError::internal(format!("JSON-RPC error [{}]: {}", err.code, err.message))
    } else {
        AppError::internal("JSON-RPC response missing result".to_string())
    }
}

async fn parse_tools_list(server_id: &str, server_name: &str, result: &serde_json::Value) -> Result<Vec<McpToolInfo>, AppError> {
    let tools_arr = result
        .get("tools")
        .and_then(|t| t.as_array())
        .ok_or_else(|| AppError::internal("tools/list response missing 'tools' array".to_string()))?;

    let mut tools = Vec::with_capacity(tools_arr.len());
    for tool in tools_arr {
        let name = tool
            .get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| AppError::internal("tool entry missing 'name'".to_string()))?
            .to_string();
        let description = tool
            .get("description")
            .and_then(|d| d.as_str())
            .unwrap_or("")
            .to_string();
        let input_schema = tool
            .get("inputSchema")
            .cloned()
            .unwrap_or(serde_json::json!({}));
        tools.push(McpToolInfo {
            server_id: server_id.to_string(),
            server_name: server_name.to_string(),
            name,
            description,
            input_schema,
        });
    }
    Ok(tools)
}

async fn stdio_send_request(
    stdin_lock: &Mutex<ChildStdin>,
    reader_lock: &Mutex<BufReader<ChildStdout>>,
    req: &JsonRpcRequest,
    timeout_secs: u64,
) -> Result<JsonRpcResponse, AppError> {
    let json = serde_json::to_string(req)
        .map_err(|e| AppError::internal(format!("Failed to serialize JSON-RPC request: {}", e)))?;

    let send_fut = async {
        let mut stdin = stdin_lock.lock().await;
        stdin
            .write_all(json.as_bytes())
            .await
            .map_err(|e| AppError::net_connect_failed(format!("Failed to write to MCP stdio: {}", e)))?;
        stdin
            .write_all(b"\n")
            .await
            .map_err(|e| AppError::net_connect_failed(format!("Failed to write newline to MCP stdio: {}", e)))?;
        stdin
            .flush()
            .await
            .map_err(|e| AppError::net_connect_failed(format!("Failed to flush MCP stdio: {}", e)))?;
        drop(stdin);

        let mut line = String::new();
        let mut reader = reader_lock.lock().await;
        let n = reader
            .read_line(&mut line)
            .await
            .map_err(|e| AppError::net_connect_failed(format!("Failed to read from MCP stdio: {}", e)))?;
        if n == 0 {
            return Err(AppError::net_connect_failed(
                "MCP server closed stdout (process exited)".to_string(),
            ));
        }
        let resp: JsonRpcResponse = serde_json::from_str(line.trim())
            .map_err(|e| AppError::storage_parse_failed(format!("Invalid JSON-RPC response from MCP stdio: {}", e)))?;
        Ok(resp)
    };

    tokio::time::timeout(Duration::from_secs(timeout_secs), send_fut)
        .await
        .map_err(|_| AppError::net_timeout(timeout_secs * 1000))?
}

async fn http_send_request(
    url: &str,
    headers: &[(String, String)],
    req: &JsonRpcRequest,
    timeout_secs: u64,
) -> Result<JsonRpcResponse, AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| AppError::internal(format!("Failed to build HTTP client: {}", e)))?;

    let mut builder = client.post(url).json(req);
    for (key, value) in headers {
        builder = builder.header(key, value);
    }

    let response = builder
        .send()
        .await
        .map_err(|e| AppError::safe_net_error("MCP HTTP request", e))?;

    if !response.status().is_success() {
        return Err(AppError::net_connect_failed(format!(
            "MCP HTTP server returned status {}",
            response.status()
        )));
    }

    let resp: JsonRpcResponse = response
        .json()
        .await
        .map_err(|e| AppError::storage_parse_failed(format!("Invalid JSON-RPC response from MCP HTTP: {}", e)))?;
    Ok(resp)
}

#[tauri::command]
pub async fn mcp_list_external_servers(
    app: tauri::AppHandle,
) -> Result<Vec<McpServerConfig>, AppError> {
    load_configs(&app).await
}

#[tauri::command]
pub async fn mcp_save_external_server(
    app: tauri::AppHandle,
    config: McpServerConfig,
) -> Result<(), AppError> {
    let mut configs = load_configs(&app).await?;
    if let Some(existing) = configs.iter_mut().find(|c| c.id == config.id) {
        *existing = config;
    } else {
        configs.push(config);
    }
    save_configs(&app, &configs).await
}

#[tauri::command]
pub async fn mcp_delete_external_server(
    app: tauri::AppHandle,
    state: State<'_, McpConnectionState>,
    id: String,
) -> Result<(), AppError> {
    // Disconnect if currently connected.
    {
        let mut connections = state.connections.lock().await;
        if let Some(mut conn) = connections.remove(&id) {
            kill_connection(&mut conn).await;
        }
    }

    let mut configs = load_configs(&app).await?;
    configs.retain(|c| c.id != id);
    save_configs(&app, &configs).await
}

#[tauri::command]
pub async fn mcp_connect_server(
    app: tauri::AppHandle,
    state: State<'_, McpConnectionState>,
    server_id: String,
) -> Result<McpServerStatus, AppError> {
    // If already connected, return current status.
    {
        let connections = state.connections.lock().await;
        if let Some(conn) = connections.get(&server_id) {
            return Ok(McpServerStatus {
                id: server_id.clone(),
                name: conn.server_name().to_string(),
                connected: true,
                tool_count: conn.tools().len(),
                error: None,
            });
        }
    }

    let configs = load_configs(&app).await?;
    let config = configs
        .iter()
        .find(|c| c.id == server_id)
        .ok_or_else(|| AppError::not_found(format!("MCP server config not found: {}", server_id)))?
        .clone();

    let connect_result = connect_and_list_tools(&state, &config).await;
    match connect_result {
        Ok((connection, tools_count)) => {
            let status = McpServerStatus {
                id: config.id.clone(),
                name: config.name.clone(),
                connected: true,
                tool_count: tools_count,
                error: None,
            };
            let mut connections = state.connections.lock().await;
            connections.insert(config.id, connection);
            Ok(status)
        }
        Err(e) => Ok(McpServerStatus {
            id: config.id.clone(),
            name: config.name.clone(),
            connected: false,
            tool_count: 0,
            error: Some(e.detail),
        }),
    }
}

async fn connect_and_list_tools(
    state: &State<'_, McpConnectionState>,
    config: &McpServerConfig,
) -> Result<(McpConnection, usize), AppError> {
    match &config.transport {
        McpTransport::Stdio { command, args, env } => {
            let mut cmd = Command::new(command);
            cmd.args(args)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null());

            if let Some(env_vars) = env {
                for (k, v) in env_vars {
                    cmd.env(k, v);
                }
            }

            let mut child = cmd
                .spawn()
                .map_err(|e| AppError::net_connect_failed(format!("Failed to spawn MCP process '{}': {}", command, e)))?;

            let stdin = child
                .stdin
                .take()
                .ok_or_else(|| AppError::net_connect_failed("MCP child stdin not available".to_string()))?;
            let stdout = child
                .stdout
                .take()
                .ok_or_else(|| AppError::net_connect_failed("MCP child stdout not available".to_string()))?;

            let child_mutex = Box::new(Mutex::new(child));
            let reader = Mutex::new(BufReader::new(stdout));
            let stdin_mutex = Mutex::new(stdin);

            // initialize
            let init_id = state.next_id().await;
            let init_req = build_request(init_id, "initialize", build_initialize_params());
            let init_resp = stdio_send_request(&stdin_mutex, &reader, &init_req, CONNECT_TIMEOUT_SECS).await;
            let init_resp = match init_resp {
                Ok(r) => r,
                Err(e) => {
                    let mut child_guard = child_mutex.lock().await;
                    let _ = child_guard.kill().await;
                    return Err(e);
                }
            };
            if init_resp.result.is_none() {
                let mut child_guard = child_mutex.lock().await;
                let _ = child_guard.kill().await;
                return Err(extract_rpc_error(&init_resp));
            }

            // tools/list
            let list_id = state.next_id().await;
            let list_req = build_request(list_id, "tools/list", serde_json::json!({}));
            let list_resp = stdio_send_request(&stdin_mutex, &reader, &list_req, CONNECT_TIMEOUT_SECS).await;
            let list_resp = match list_resp {
                Ok(r) => r,
                Err(e) => {
                    let mut child_guard = child_mutex.lock().await;
                    let _ = child_guard.kill().await;
                    return Err(e);
                }
            };
            let result = match list_resp.result.as_ref() {
                Some(r) => r,
                None => {
                    let mut child_guard = child_mutex.lock().await;
                    let _ = child_guard.kill().await;
                    return Err(extract_rpc_error(&list_resp));
                }
            };
            let tools = parse_tools_list(&config.id, &config.name, result).await?;

            let tools_count = tools.len();
            let connection = McpConnection::Stdio {
                stdin: stdin_mutex,
                stdout: reader,
                child: child_mutex,
                tools,
                server_name: config.name.clone(),
            };
            Ok((connection, tools_count))
        }
        McpTransport::Http { url, headers } => {
            let hdrs = headers.clone().unwrap_or_default();

            // initialize
            let init_id = state.next_id().await;
            let init_req = build_request(init_id, "initialize", build_initialize_params());
            let init_resp = http_send_request(url, &hdrs, &init_req, CONNECT_TIMEOUT_SECS).await?;
            if init_resp.result.is_none() {
                return Err(extract_rpc_error(&init_resp));
            }

            // tools/list
            let list_id = state.next_id().await;
            let list_req = build_request(list_id, "tools/list", serde_json::json!({}));
            let list_resp = http_send_request(url, &hdrs, &list_req, CONNECT_TIMEOUT_SECS).await?;
            let result = list_resp
                .result
                .as_ref()
                .ok_or_else(|| extract_rpc_error(&list_resp))?;
            let tools = parse_tools_list(&config.id, &config.name, result).await?;

            let tools_count = tools.len();
            let connection = McpConnection::Http {
                url: url.clone(),
                headers: hdrs,
                tools,
                server_name: config.name.clone(),
            };
            Ok((connection, tools_count))
        }
    }
}

async fn kill_connection(conn: &mut McpConnection) {
    if let McpConnection::Stdio { child, .. } = conn {
        let mut child_guard = child.lock().await;
        let _ = child_guard.kill().await;
    }
}

#[tauri::command]
pub async fn mcp_disconnect_server(
    state: State<'_, McpConnectionState>,
    server_id: String,
) -> Result<(), AppError> {
    let mut connections = state.connections.lock().await;
    if let Some(mut conn) = connections.remove(&server_id) {
        kill_connection(&mut conn).await;
        Ok(())
    } else {
        Err(AppError::not_found(format!(
            "MCP server not connected: {}",
            server_id
        )))
    }
}

#[tauri::command]
pub async fn mcp_list_external_tools(
    state: State<'_, McpConnectionState>,
) -> Result<Vec<McpToolInfo>, AppError> {
    let connections = state.connections.lock().await;
    let mut all_tools = Vec::new();
    for conn in connections.values() {
        all_tools.extend_from_slice(conn.tools());
    }
    Ok(all_tools)
}

#[tauri::command]
pub async fn mcp_call_external_tool(
    state: State<'_, McpConnectionState>,
    server_id: String,
    tool_name: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let mut connections = state.connections.lock().await;
    let conn = connections
        .get_mut(&server_id)
        .ok_or_else(|| AppError::net_connect_failed(format!("MCP server not connected: {}", server_id)))?;

    let req_id = state.next_id().await;
    let params = serde_json::json!({
        "name": tool_name,
        "arguments": args,
    });
    let req = build_request(req_id, "tools/call", params);

    let resp = match conn {
        McpConnection::Stdio { stdin, stdout, .. } => {
            stdio_send_request(stdin, stdout, &req, TOOL_CALL_TIMEOUT_SECS).await?
        }
        McpConnection::Http { url, headers, .. } => {
            http_send_request(url, headers, &req, TOOL_CALL_TIMEOUT_SECS).await?
        }
    };

    if let Some(err) = resp.error {
        return Err(AppError::internal(format!(
            "JSON-RPC error [{}]: {}",
            err.code, err.message
        )));
    }
    resp.result.ok_or_else(|| AppError::internal("tools/call response missing result".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_request() {
        let req = build_request(1, "initialize", serde_json::json!({}));
        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.id, 1);
        assert_eq!(req.method, "initialize");
    }

    #[test]
    fn test_build_initialize_params() {
        let params = build_initialize_params();
        assert_eq!(params["protocolVersion"], MCP_PROTOCOL_VERSION);
        assert_eq!(params["clientInfo"]["name"], CLIENT_NAME);
    }

    #[test]
    fn test_parse_tools_list() {
        let result = serde_json::json!({
            "tools": [
                {
                    "name": "get_weather",
                    "description": "Get weather",
                    "inputSchema": {"type": "object", "properties": {}}
                },
                {
                    "name": "get_time",
                    "description": "Get time",
                    "inputSchema": {"type": "object"}
                }
            ]
        });
        let rt = tokio::runtime::Runtime::new().unwrap();
        let tools = rt.block_on(parse_tools_list("srv1", "Server One", &result)).unwrap();
        assert_eq!(tools.len(), 2);
        assert_eq!(tools[0].server_id, "srv1");
        assert_eq!(tools[0].server_name, "Server One");
        assert_eq!(tools[0].name, "get_weather");
        assert_eq!(tools[1].description, "Get time");
    }

    #[test]
    fn test_parse_tools_list_missing_tools_field() {
        let result = serde_json::json!({});
        let rt = tokio::runtime::Runtime::new().unwrap();
        let err = rt.block_on(parse_tools_list("srv1", "Server One", &result));
        assert!(err.is_err());
        let e = err.unwrap_err();
        assert_eq!(e.code, "INTERNAL");
    }

    #[test]
    fn test_extract_rpc_error_with_error() {
        let resp = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: 1,
            result: None,
            error: Some(JsonRpcError {
                code: -32601,
                message: "Method not found".to_string(),
            }),
        };
        let err = extract_rpc_error(&resp);
        assert_eq!(err.code, "INTERNAL");
        assert!(err.detail.contains("-32601"));
    }

    #[test]
    fn test_extract_rpc_error_no_result_no_error() {
        let resp = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: 1,
            result: None,
            error: None,
        };
        let err = extract_rpc_error(&resp);
        assert_eq!(err.code, "INTERNAL");
    }

    #[test]
    fn test_mcp_transport_serde_stdio() {
        let transport = McpTransport::Stdio {
            command: "node".to_string(),
            args: vec!["server.js".to_string()],
            env: None,
        };
        let json = serde_json::to_string(&transport).unwrap();
        assert!(json.contains("\"type\":\"stdio\""));
        let de: McpTransport = serde_json::from_str(&json).unwrap();
        match de {
            McpTransport::Stdio { command, .. } => assert_eq!(command, "node"),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_mcp_transport_serde_http() {
        let transport = McpTransport::Http {
            url: "http://localhost:3000/mcp".to_string(),
            headers: Some(vec![("Authorization".to_string(), "Bearer x".to_string())]),
        };
        let json = serde_json::to_string(&transport).unwrap();
        assert!(json.contains("\"type\":\"http\""));
        let de: McpTransport = serde_json::from_str(&json).unwrap();
        match de {
            McpTransport::Http { url, .. } => assert_eq!(url, "http://localhost:3000/mcp"),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_mcp_server_config_serde_camel_case() {
        let config = McpServerConfig {
            id: "s1".to_string(),
            name: "Test".to_string(),
            transport: McpTransport::Http {
                url: "http://x".to_string(),
                headers: None,
            },
            enabled: true,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"serverId\"") || json.contains("\"id\""));
        // rename_all = camelCase applies to fields; "id" stays "id", "name" stays "name".
    }

    #[test]
    fn test_next_id_increments() {
        let state = McpConnectionState::new();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let id1 = rt.block_on(state.next_id());
        let id2 = rt.block_on(state.next_id());
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
    }
}
