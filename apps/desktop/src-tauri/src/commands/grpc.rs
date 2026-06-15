use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use prost_reflect::{DynamicMessage, DescriptorPool};
use prost::Message;

pub struct GrpcState {
    pub file_descriptors: Arc<RwLock<HashMap<String, DescriptorPool>>>,
}

impl Default for GrpcState {
    fn default() -> Self {
        Self::new()
    }
}

impl GrpcState {
    pub fn new() -> Self {
        Self {
            file_descriptors: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMethodInfo {
    pub service_name: String,
    pub method_name: String,
    pub input_type: String,
    pub output_type: String,
    pub client_streaming: bool,
    pub server_streaming: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcResponse {
    pub request_id: String,
    pub status: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcStreamMessage {
    pub request_id: String,
    pub body: String,
    pub stream_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcRequestConfig {
    pub request_id: String,
    pub url: String,
    pub service_name: String,
    pub method_name: String,
    pub request_json: String,
    pub metadata: Option<Vec<(String, String)>>,
    pub timeout_ms: Option<u64>,
    pub proto_file_id: Option<String>,
}

#[tauri::command]
pub async fn parse_proto_file(
    state: State<'_, GrpcState>,
    proto_file_id: String,
    file_path: String,
) -> Result<Vec<GrpcMethodInfo>, crate::error::AppError> {
    let _ = std::fs::read_to_string(&file_path)
        .map_err(|e| crate::error::AppError::storage_read_failed(format!("Cannot read proto file: {}", e)))?;

    let path_ref: &std::path::Path = std::path::Path::new(&file_path);
    let compiled = protox::compile([path_ref], std::iter::empty::<std::path::PathBuf>())
        .map_err(|e| crate::error::AppError::storage_parse_failed(format!("Proto compilation failed: {}", e)))?;

    let pool = DescriptorPool::from_file_descriptor_set(compiled)
        .map_err(|e| crate::error::AppError::storage_parse_failed(format!("Descriptor pool error: {}", e)))?;

    let mut methods = Vec::new();

    for service in pool.services() {
        for method in service.methods() {
            methods.push(GrpcMethodInfo {
                service_name: service.full_name().to_string(),
                method_name: method.name().to_string(),
                input_type: method.input().full_name().to_string(),
                output_type: method.output().full_name().to_string(),
                client_streaming: method.is_client_streaming(),
                server_streaming: method.is_server_streaming(),
            });
        }
    }

    state.file_descriptors.write().await.insert(proto_file_id, pool);

    Ok(methods)
}

fn encode_grpc_message(msg: &DynamicMessage) -> Vec<u8> {
    let mut buf = Vec::with_capacity(msg.encoded_len() + 5);
    buf.push(0);
    let len = msg.encoded_len() as u32;
    buf.extend_from_slice(&len.to_be_bytes());
    let _ = msg.encode(&mut buf);
    buf
}

fn decode_grpc_frame(data: &[u8]) -> Result<Vec<u8>, crate::error::AppError> {
    if data.len() < 5 {
        return Err(crate::error::AppError::net_connect_failed("Invalid gRPC frame: too short".to_string()));
    }
    let _compressed = data[0];
    let len = u32::from_be_bytes([data[1], data[2], data[3], data[4]]) as usize;
    if data.len() < 5 + len {
        return Err(crate::error::AppError::net_connect_failed("Invalid gRPC frame: truncated".to_string()));
    }
    Ok(data[5..5 + len].to_vec())
}

fn dynamic_msg_to_json(msg: &DynamicMessage) -> String {
    serde_json::to_string(msg).unwrap_or_else(|_| "{}".to_string())
}

fn json_to_dynamic_msg(msg_desc: &prost_reflect::MessageDescriptor, json_str: &str) -> Result<DynamicMessage, crate::error::AppError> {
    let mut deserializer = serde_json::Deserializer::from_str(json_str);
    let msg = DynamicMessage::deserialize_with_options(msg_desc.clone(), &mut deserializer, &Default::default())
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("JSON to protobuf: {}", e)))?;
    Ok(msg)
}

#[tauri::command]
pub async fn send_grpc_request(
    app: tauri::AppHandle,
    state: State<'_, GrpcState>,
    config: GrpcRequestConfig,
) -> Result<GrpcResponse, crate::error::AppError> {
    let start = std::time::Instant::now();

    let descriptors = state.file_descriptors.read().await;
    let pool = if let Some(ref pid) = config.proto_file_id {
        descriptors.get(pid)
            .ok_or_else(|| crate::error::AppError::net_connect_failed(format!("Proto file '{}' not found", pid)))?
    } else {
        descriptors.values().next()
            .ok_or_else(|| crate::error::AppError::net_connect_failed("No proto file parsed. Use parse_proto_file first.".to_string()))?
    };

    let service = pool.services().find(|s| s.full_name() == config.service_name)
        .ok_or_else(|| crate::error::AppError::net_connect_failed(format!("Service '{}' not found", config.service_name)))?;

    let method = service.methods().find(|m| m.name() == config.method_name)
        .ok_or_else(|| crate::error::AppError::net_connect_failed(format!("Method '{}' not found", config.method_name)))?;

    let dynamic_msg = json_to_dynamic_msg(&method.input(), &config.request_json)?;

    let _grpc_path = format!("/{}/{}", config.service_name, config.method_name);
    let grpc_body = encode_grpc_message(&dynamic_msg);

    // NOTE: This uses reqwest (HTTP/1.1) instead of tonic/h2 (HTTP/2).
    // Real gRPC requires HTTP/2 with custom framing and trailers.
    // This will work with gRPC-Web proxies and some gRPC servers that accept HTTP/1.1,
    // but will fail against standard gRPC servers.
    // TODO: Replace with tonic-based HTTP/2 implementation for full gRPC support.
    let mut request_builder = reqwest::Client::new()
        .post(&config.url)
        .header("content-type", "application/grpc")
        .header("te", "trailers")
        .header("grpc-encoding", "identity")
        .header("grpc-accept-encoding", "identity");

    if let Some(metadata) = &config.metadata {
        for (key, value) in metadata {
            request_builder = request_builder.header(key.as_str(), value.as_str());
        }
    }

    if let Some(timeout) = config.timeout_ms {
        request_builder = request_builder.timeout(std::time::Duration::from_millis(timeout));
    }

    let response = request_builder
        .body(grpc_body)
        .send()
        .await
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("gRPC request failed: {}", e)))?;

    let grpc_status = response.headers()
        .get("grpc-status")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("0")
        .to_string();

    let response_headers: Vec<(String, String)> = response.headers().iter()
        .filter_map(|(k, v)| Some((k.to_string(), v.to_str().ok()?.to_string())))
        .collect();

    if method.is_server_streaming() {
        let conn_id = config.request_id.clone();
        let app_handle = app.clone();
        let output_desc = method.output().clone();

        const MAX_GRPC_FRAME_SIZE: usize = 64 * 1024 * 1024;

        tokio::spawn(async move {
            use futures_util::StreamExt;
            let mut stream = response.bytes_stream();
            let mut buffer = Vec::new();

            loop {
                match stream.next().await {
                    Some(Ok(chunk)) => {
                        buffer.extend_from_slice(&chunk);
                        while buffer.len() >= 5 {
                            let compressed = buffer[0] != 0;
                            let len = u32::from_be_bytes([buffer[1], buffer[2], buffer[3], buffer[4]]) as usize;
                            if len > MAX_GRPC_FRAME_SIZE {
                                let stream_msg = GrpcStreamMessage {
                                    request_id: conn_id.clone(),
                                    body: format!("Frame size {} exceeds maximum {}", len, MAX_GRPC_FRAME_SIZE),
                                    stream_type: "error".to_string(),
                                };
                                if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                    tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                }
                                buffer.clear();
                                break;
                            }
                            if buffer.len() < 5 + len { break; }
                            let frame_data = buffer[5..5 + len].to_vec();
                            buffer.drain(..5 + len);

                            let _ = compressed;

                            match DynamicMessage::decode(output_desc.clone(), frame_data.as_slice()) {
                                Ok(msg) => {
                                    let body = dynamic_msg_to_json(&msg);
                                    let stream_msg = GrpcStreamMessage {
                                        request_id: conn_id.clone(),
                                        body,
                                        stream_type: "data".to_string(),
                                    };
                                    if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                    tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                }
                                }
                                Err(e) => {
                                    let stream_msg = GrpcStreamMessage {
                                        request_id: conn_id.clone(),
                                        body: format!("Decode error: {}", e),
                                        stream_type: "error".to_string(),
                                    };
                                    if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                    tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        let stream_msg = GrpcStreamMessage {
                            request_id: conn_id.clone(),
                            body: format!("Stream error: {}", e),
                            stream_type: "error".to_string(),
                        };
                        if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                    tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                }
                        break;
                    }
                    None => {
                        let stream_msg = GrpcStreamMessage {
                            request_id: conn_id.clone(),
                            body: "Stream complete".to_string(),
                            stream_type: "end".to_string(),
                        };
                        if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                    tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                }
                        break;
                    }
                }
            }
        });

        return Ok(GrpcResponse {
            request_id: config.request_id,
            status: "streaming".to_string(),
            headers: response_headers,
            body: "Streaming started".to_string(),
            time_ms: start.elapsed().as_millis() as u64,
        });
    }

    let response_bytes = response.bytes().await
        .map_err(|e| crate::error::AppError::net_connect_failed(format!("Read response body failed: {}", e)))?;

    let output_desc = method.output();
    let body = if response_bytes.is_empty() {
        "{}".to_string()
    } else {
        match decode_grpc_frame(&response_bytes) {
            Ok(frame_data) => {
                match DynamicMessage::decode(output_desc.clone(), frame_data.as_slice()) {
                    Ok(msg) => dynamic_msg_to_json(&msg),
                    Err(_) => String::from_utf8_lossy(&response_bytes).to_string(),
                }
            }
            Err(_) => String::from_utf8_lossy(&response_bytes).to_string(),
        }
    };

    let status = if grpc_status == "0" { "ok".to_string() } else { format!("error (grpc-status: {})", grpc_status) };

    Ok(GrpcResponse {
        request_id: config.request_id,
        status,
        headers: response_headers,
        body,
        time_ms: start.elapsed().as_millis() as u64,
    })
}
