use crate::commands::collection;
use crate::commands::environment;
use crate::commands::http;
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolCallRequest {
    pub tool_name: String,
    pub args: serde_json::Value,
}

pub fn get_mcp_tools() -> Vec<McpTool> {
    vec![
        McpTool {
            name: "create_request".into(),
            description: "Create an HTTP request with specified method, URL, headers, query parameters, and body. Returns the serialized request config as JSON.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Unique identifier for this request"},
                    "method": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], "description": "HTTP method"},
                    "url": {"type": "string", "description": "Full URL including protocol"},
                    "headers": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "value": {"type": "string"},
                                "disabled": {"type": "boolean", "default": false}
                            },
                            "required": ["key", "value"]
                        },
                        "description": "HTTP headers"
                    },
                    "params": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "value": {"type": "string"},
                                "disabled": {"type": "boolean", "default": false}
                            },
                            "required": ["key", "value"]
                        },
                        "description": "Query parameters"
                    },
                    "body": {
                        "type": "object",
                        "properties": {
                            "mode": {"type": "string", "enum": ["raw", "urlencoded", "json", "graphql", "xml"]},
                            "content": {"type": "string", "description": "Body content for raw/json/xml/graphql modes"},
                            "content_type": {"type": "string", "description": "Content-Type header value"}
                        }
                    }
                },
                "required": ["method", "url"]
            }),
        },
        McpTool {
            name: "send_request".into(),
            description: "Send an HTTP request using a request configuration and return the response with status, headers, body, timing, and size.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "method": {"type": "string", "description": "HTTP method"},
                    "url": {"type": "string", "description": "Full URL"},
                    "headers": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "value": {"type": "string"}
                            }
                        }
                    },
                    "params": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "value": {"type": "string"}
                            }
                        }
                    },
                    "body": {
                        "type": "object",
                        "properties": {
                            "mode": {"type": "string"},
                            "content": {"type": "string"},
                            "content_type": {"type": "string"}
                        }
                    }
                },
                "required": ["method", "url"]
            }),
        },
        McpTool {
            name: "list_collections".into(),
            description: "List all saved API collections in the workspace with their names, IDs, description, and request counts.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        },
        McpTool {
            name: "get_environment".into(),
            description: "Get environment variables for a specific environment by ID. Returns the environment name and all key-value variables.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "environment_id": {"type": "string", "description": "The ID of the environment to retrieve"}
                },
                "required": ["environment_id"]
            }),
        },
        McpTool {
            name: "execute_script".into(),
            description: "Execute a JavaScript pre-request or post-response script in the built-in QuickJS engine. Returns success status, logs, test results, and modified request data.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "JavaScript code to execute"},
                    "environment": {
                        "type": "object",
                        "description": "Optional environment variables map",
                        "additionalProperties": {"type": "string"}
                    },
                    "request": {
                        "type": "object",
                        "description": "Optional request context JSON (method, url, headers, body)"
                    },
                    "response": {
                        "type": "object",
                        "description": "Optional response context JSON (status, headers, body)"
                    },
                    "timeout_ms": {"type": "number", "description": "Script timeout in milliseconds (default: 5000)"}
                },
                "required": ["code"]
            }),
        },
    ]
}

pub async fn call_mcp_tool(
    app: tauri::AppHandle,
    tool_name: &str,
    args: serde_json::Value,
) -> Result<String, AppError> {
    match tool_name {
        "create_request" => handle_create_request(&args),
        "send_request" => handle_send_request(&args).await,
        "list_collections" => handle_list_collections(app).await,
        "get_environment" => handle_get_environment(app, &args).await,
        "execute_script" => handle_execute_script(&args).await,
        unknown => Err(AppError::not_found(format!("Unknown MCP tool: {}", unknown))),
    }
}

fn handle_create_request(args: &serde_json::Value) -> Result<String, AppError> {
    let id = get_str(args, "id").map(|s| s.to_string()).unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let method = get_str(args, "method")
        .ok_or_else(|| AppError::validation_failed("Missing 'method' field".into()))?
        .to_string();
    let url = get_str(args, "url")
        .ok_or_else(|| AppError::validation_failed("Missing 'url' field".into()))?
        .to_string();

    let headers: Vec<http::Header> = args.get("headers")
        .and_then(|h| h.as_array())
        .map(|arr| {
            arr.iter().map(|item| http::Header {
                key: item["key"].as_str().unwrap_or("").to_string(),
                value: item["value"].as_str().unwrap_or("").to_string(),
                disabled: item["disabled"].as_bool().unwrap_or(false),
            }).collect()
        })
        .unwrap_or_default();

    let params: Vec<http::QueryParam> = args.get("params")
        .and_then(|p| p.as_array())
        .map(|arr| {
            arr.iter().map(|item| http::QueryParam {
                key: item["key"].as_str().unwrap_or("").to_string(),
                value: item["value"].as_str().unwrap_or("").to_string(),
                disabled: item["disabled"].as_bool().unwrap_or(false),
            }).collect()
        })
        .unwrap_or_default();

    let body = if let Some(b) = args.get("body") {
        Some(http::BodyConfig {
            mode: b["mode"].as_str().unwrap_or("raw").to_string(),
            content: b["content"].as_str().map(|s| s.to_string()),
            content_type: b["content_type"].as_str().map(|s| s.to_string()),
            formdata: Vec::new(),
            urlencoded: Vec::new(),
            graphql_query: None,
            graphql_variables: None,
        })
    } else {
        None
    };

    let config = http::HttpRequestConfig {
        id,
        method,
        url,
        headers,
        params,
        body,
        auth: None,
        settings: http::RequestSettings::default(),
    };

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| AppError::internal(format!("Failed to serialize request: {}", e)))?;
    Ok(json)
}

async fn handle_send_request(args: &serde_json::Value) -> Result<String, AppError> {
    let method = get_str(args, "method")
        .ok_or_else(|| AppError::validation_failed("Missing 'method' field".into()))?
        .to_string();
    let url_str = get_str(args, "url")
        .ok_or_else(|| AppError::validation_failed("Missing 'url' field".into()))?
        .to_string();

    let start = std::time::Instant::now();

    let settings = http::RequestSettings {
        timeout_ms: 30000,
        follow_redirects: true,
        max_redirects: 10,
        verify_ssl: false,
        ..Default::default()
    };
    let client = http::build_client(&settings)?;

    let parsed_url = reqwest::Url::parse(&url_str)
        .map_err(|e| AppError::net_invalid_url(format!("Invalid URL: {}", e)))?;

    let http_method = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|_| AppError::internal(format!("Invalid HTTP method: {}", method)))?;

    let mut request_builder = client.request(http_method, parsed_url);

    if let Some(headers) = args.get("headers").and_then(|h| h.as_array()) {
        for h in headers {
            let key = h["key"].as_str().unwrap_or("");
            let value = h["value"].as_str().unwrap_or("");
            if !key.is_empty() {
                request_builder = request_builder.header(key, value);
            }
        }
    }

    if let Some(params) = args.get("params").and_then(|p| p.as_array()) {
        let query_pairs: Vec<(String, String)> = params.iter()
            .filter_map(|p| {
                let key = p["key"].as_str().unwrap_or("");
                let value = p["value"].as_str().unwrap_or("");
                if key.is_empty() { None } else { Some((key.to_string(), value.to_string())) }
            })
            .collect();
        request_builder = request_builder.query(&query_pairs.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect::<Vec<_>>());
    }

    if let Some(body) = args.get("body") {
        let mode = body["mode"].as_str().unwrap_or("raw");
        let content = body["content"].as_str().unwrap_or("");
        let content_type = body["content_type"].as_str();

        match mode {
            "raw" | "json" | "xml" => {
                if let Some(ct) = content_type {
                    request_builder = request_builder.header("Content-Type", ct);
                } else if mode == "json" {
                    request_builder = request_builder.header("Content-Type", "application/json");
                }
                if !content.is_empty() {
                    request_builder = request_builder.body(content.to_string());
                }
            }
            "urlencoded" => {
                let pairs: Vec<(&str, &str)> = content.split('&')
                    .filter_map(|pair| {
                        let mut parts = pair.splitn(2, '=');
                        Some((parts.next()?, parts.next().unwrap_or("")))
                    })
                    .collect();
                request_builder = request_builder.form(&pairs);
            }
            "graphql" => {
                request_builder = request_builder
                    .header("Content-Type", "application/json")
                    .body(content.to_string());
            }
            _ => {
                if !content.is_empty() {
                    request_builder = request_builder.body(content.to_string());
                }
            }
        }
    }

    let response = request_builder.send().await
        .map_err(|e| AppError::safe_net_error("MCP send_request", e))?;

    let elapsed = start.elapsed().as_millis() as u64;
    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("Unknown").to_string();
    let content_type = response.headers().get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let response_headers: Vec<http::ResponseHeader> = response.headers().iter()
        .map(|(k, v)| http::ResponseHeader {
            key: k.to_string(),
            value: v.to_str().unwrap_or("").to_string(),
        })
        .collect();

    let body_bytes = response.bytes().await
        .map_err(|e| AppError::internal(format!("Failed to read response body: {}", e)))?;
    let body_size = body_bytes.len() as u64;

    if body_size > 10 * 1024 * 1024 {
        return Err(AppError::net_body_too_large(body_size, 10 * 1024 * 1024));
    }

    let body_text = String::from_utf8(body_bytes.to_vec())
        .unwrap_or_else(|_| "[binary data]".to_string());

    let result = serde_json::json!({
        "status": status,
        "status_text": status_text,
        "headers": response_headers.iter().map(|h| serde_json::json!({"key": h.key, "value": h.value})).collect::<Vec<_>>(),
        "body": body_text,
        "time_ms": elapsed,
        "content_type": content_type,
        "body_size": body_size,
    });

    let json = serde_json::to_string_pretty(&result)
        .map_err(|e| AppError::internal(format!("Failed to serialize response: {}", e)))?;
    Ok(json)
}

async fn handle_list_collections(app: tauri::AppHandle) -> Result<String, AppError> {
    let summaries = collection::list_collections(app).await?;
    let json = serde_json::to_string_pretty(&summaries)
        .map_err(|e| AppError::internal(format!("Failed to serialize collections: {}", e)))?;
    Ok(json)
}

async fn handle_get_environment(app: tauri::AppHandle, args: &serde_json::Value) -> Result<String, AppError> {
    let env_id = get_str(args, "environment_id")
        .ok_or_else(|| AppError::validation_failed("Missing 'environment_id' field".into()))?
        .to_string();
    let env = environment::get_environment(app, env_id).await?;
    let json = serde_json::to_string_pretty(&env)
        .map_err(|e| AppError::internal(format!("Failed to serialize environment: {}", e)))?;
    Ok(json)
}

async fn handle_execute_script(args: &serde_json::Value) -> Result<String, AppError> {
    let code = get_str(args, "code")
        .ok_or_else(|| AppError::validation_failed("Missing 'code' field".into()))?
        .to_string();

    let timeout_ms = args.get("timeout_ms")
        .and_then(|v| v.as_u64());

    let env_vars: Option<HashMap<String, String>> = args.get("environment")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    let request_ctx: Option<serde_json::Value> = args.get("request").cloned();
    let response_ctx: Option<serde_json::Value> = args.get("response").cloned();

    let context = crate::script::engine::ScriptContext {
        request: request_ctx,
        response: response_ctx,
        environment: env_vars,
        collection_variables: None,
        globals: None,
    };

    let params = crate::script::engine::ExecuteScriptParams {
        code,
        context,
        timeout_ms,
    };

    let result = crate::commands::script::execute_script(params).await?;
    let json = serde_json::to_string_pretty(&result)
        .map_err(|e| AppError::internal(format!("Failed to serialize script result: {}", e)))?;
    Ok(json)
}

fn get_str<'a>(args: &'a serde_json::Value, field: &str) -> Option<&'a str> {
    args.get(field).and_then(|v| v.as_str())
}

#[tauri::command]
pub async fn list_mcp_tools() -> Result<Vec<McpTool>, AppError> {
    Ok(get_mcp_tools())
}

#[tauri::command]
pub async fn call_mcp_tool_command(
    app: tauri::AppHandle,
    tool_name: String,
    args: serde_json::Value,
) -> Result<String, AppError> {
    call_mcp_tool(app, &tool_name, args).await
}