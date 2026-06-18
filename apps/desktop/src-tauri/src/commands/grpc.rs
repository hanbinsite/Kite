use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use prost_reflect::{DynamicMessage, DescriptorPool};
use prost::Message;
use tonic::transport::{Endpoint, Channel};
use tonic::client::GrpcService;
use bytes::Buf;

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
pub struct GrpcServiceInfo {
    pub service_name: String,
    pub methods: Vec<GrpcMethodInfo>,
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

pub fn encode_grpc_message(msg: &DynamicMessage) -> Vec<u8> {
    let mut buf = Vec::with_capacity(msg.encoded_len() + 5);
    buf.push(0);
    let len = msg.encoded_len() as u32;
    buf.extend_from_slice(&len.to_be_bytes());
    let _ = msg.encode(&mut buf);
    buf
}

pub fn decode_grpc_frame(data: &[u8]) -> Result<Vec<u8>, crate::error::AppError> {
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

async fn create_grpc_channel(url: &str) -> Result<Channel, crate::error::AppError> {
    let endpoint = Endpoint::from_shared(url.to_string())
        .map_err(|e| crate::error::AppError::net_invalid_url(format!("Invalid gRPC URL: {}", e)))?;
    endpoint.connect()
        .await
        .map_err(|e| crate::error::AppError::safe_net_error("gRPC channel connect", e))
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
    let grpc_path = format!("/{}/{}", config.service_name, config.method_name);
    let grpc_body = encode_grpc_message(&dynamic_msg);

    // Use tonic Channel for HTTP/2 transport
    let mut channel = create_grpc_channel(&config.url).await?;

    let mut request_builder = http::Request::builder()
        .method(http::Method::POST)
        .uri(grpc_path)
        .header("content-type", "application/grpc")
        .header("te", "trailers")
        .header("grpc-encoding", "identity")
        .header("grpc-accept-encoding", "identity");

    if let Some(ref metadata) = config.metadata {
        for (key, value) in metadata {
            request_builder = request_builder.header(key.as_str(), value.as_str());
        }
    }

    let body = tonic::body::boxed(http_body_util::Full::new(bytes::Bytes::from(grpc_body)));
    let request = request_builder
        .body(body)
        .map_err(|e| crate::error::AppError::safe_net_error("gRPC request build", e))?;

    let response = channel.call(request).await
        .map_err(|e| crate::error::AppError::safe_net_error("gRPC request send", e))?;

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
            use http_body_util::BodyExt;

            let mut stream = response.into_body().into_data_stream();
            let mut buffer = bytes::BytesMut::new();

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
                            buffer.advance(5 + len);

                            let _ = compressed;

                            match DynamicMessage::decode(output_desc.clone(), frame_data.as_slice()) {
                                Ok(msg) => {
                                    let body = dynamic_msg_to_json(&msg);
                                    let stream_msg = GrpcStreamMessage { request_id: conn_id.clone(), body, stream_type: "data".to_string() };
                                    if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                        tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                    }
                                }
                                Err(e) => {
                                    let stream_msg = GrpcStreamMessage { request_id: conn_id.clone(), body: format!("Decode error: {}", e), stream_type: "error".to_string() };
                                    if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                                        tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                                    }
                                }
                            }
                    }
                    }
                    Some(Err(e)) => {
                        let stream_msg = GrpcStreamMessage { request_id: conn_id.clone(), body: format!("Stream error: {}", e), stream_type: "error".to_string() };
                        if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                            tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                        }
                        break;
                    }
                    None => {
                        let stream_msg = GrpcStreamMessage { request_id: conn_id.clone(), body: "Stream complete".to_string(), stream_type: "end".to_string() };
                        if let Err(e) = app_handle.emit("grpc-stream-message", &stream_msg) {
                            tracing::warn!("Failed to emit grpc-stream-message: {}", e);
                        }
                        break;
                    }
                }
            }
        });

        return Ok(GrpcResponse { request_id: config.request_id, status: "streaming".to_string(), headers: response_headers, body: "Streaming started".to_string(), time_ms: start.elapsed().as_millis() as u64 });
    }

    use http_body_util::BodyExt;
    let response_bytes = response.into_body().collect().await
        .map_err(|e| crate::error::AppError::safe_net_error("Read response body", e))?
        .to_bytes();

    let body = if response_bytes.is_empty() {
        "{}".to_string()
    } else {
        match decode_grpc_frame(&response_bytes) {
            Ok(frame_data) => {
                match DynamicMessage::decode(method.output().clone(), frame_data.as_slice()) {
                    Ok(msg) => dynamic_msg_to_json(&msg),
                    Err(_) => String::from_utf8_lossy(&response_bytes).to_string(),
                }
            }
            Err(_) => String::from_utf8_lossy(&response_bytes).to_string(),
        }
    };

    let status = if grpc_status == "0" { "ok".to_string() } else { format!("error (grpc-status: {})", grpc_status) };

    Ok(GrpcResponse { request_id: config.request_id, status, headers: response_headers, body, time_ms: start.elapsed().as_millis() as u64 })
}

#[tauri::command]
pub async fn reflect_grpc_services(
    url: String,
) -> Result<Vec<GrpcServiceInfo>, crate::error::AppError> {
    let channel = create_grpc_channel(&url).await?;

    let services = list_reflection_services(&channel).await?;

    let mut results = Vec::new();
    for service_name in services {
        let methods = resolve_service_methods(&channel, &service_name).await?;
        results.push(GrpcServiceInfo {
            service_name,
            methods,
        });
    }

    Ok(results)
}

const REFLECTION_PATH: &str = "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo";

fn build_grpc_http_request(
    proto_body: Vec<u8>,
) -> Result<http::Request<tonic::body::BoxBody>, crate::error::AppError> {
    let grpc_body = encode_grpc_body(&proto_body);
    http::Request::builder()
        .method(http::Method::POST)
        .uri(REFLECTION_PATH)
        .header("content-type", "application/grpc")
        .header("te", "trailers")
        .header("grpc-encoding", "identity")
        .header("grpc-accept-encoding", "identity")
        .body(tonic::body::boxed(http_body_util::Full::new(bytes::Bytes::from(grpc_body))))
        .map_err(|e| crate::error::AppError::safe_net_error("reflection request build", e))
}

pub fn encode_grpc_body(data: &[u8]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(data.len() + 5);
    buf.push(0);
    let len = data.len() as u32;
    buf.extend_from_slice(&len.to_be_bytes());
    buf.extend_from_slice(data);
    buf
}

async fn grpc_call_unary(
    channel: &mut Channel,
    proto_body: Vec<u8>,
) -> Result<Vec<u8>, crate::error::AppError> {
    use http_body_util::BodyExt;
    let request = build_grpc_http_request(proto_body)?;
    let response = channel.call(request).await
        .map_err(|e| crate::error::AppError::safe_net_error("gRPC call", e))?;
    let response_bytes = response.into_body().collect().await
        .map_err(|e| crate::error::AppError::safe_net_error("gRPC read body", e))?
        .to_bytes();
    decode_grpc_frame(&response_bytes)
}

pub fn encode_reflection_list_services() -> Vec<u8> {
    let mut buf = Vec::new();
    prost::encoding::encode_varint((1 << 3) | 2, &mut buf);
    prost::encoding::encode_varint("".len() as u64, &mut buf);
    buf.extend_from_slice(b"");
    buf
}

pub fn encode_file_descriptor_containing_symbol(symbol: &str) -> Vec<u8> {
    let mut buf = Vec::new();
    let sym_bytes = symbol.as_bytes();

    let inner_len = {
        1 + prost::encoding::encoded_len_varint(sym_bytes.len() as u64) + sym_bytes.len()
    };

    let total_len = {
        1 + prost::encoding::encoded_len_varint(inner_len as u64) + inner_len
    };

    let tag1 = (1 << 3) | 2;
    prost::encoding::encode_varint(tag1 as u64, &mut buf);
    prost::encoding::encode_varint(total_len as u64, &mut buf);

    let tag3 = (3 << 3) | 2;
    prost::encoding::encode_varint(tag3 as u64, &mut buf);
    prost::encoding::encode_varint(sym_bytes.len() as u64, &mut buf);
    buf.extend_from_slice(sym_bytes);

    buf
}

pub fn decode_varint(buf: &mut bytes::Bytes) -> Result<u64, crate::error::AppError> {
    prost::encoding::decode_varint(buf)
        .map_err(|e| crate::error::AppError::storage_parse_failed(format!("varint decode: {}", e)))
}

pub fn read_field_lengthed(buf: &mut bytes::Bytes) -> Result<bytes::Bytes, crate::error::AppError> {
    let len = decode_varint(buf)? as usize;
    if buf.remaining() < len {
        return Err(crate::error::AppError::storage_parse_failed("truncated length-delimited field".into()));
    }
    Ok(buf.split_to(len))
}

async fn list_reflection_services(
    channel: &Channel,
) -> Result<Vec<String>, crate::error::AppError> {
    let mut channel = channel.clone();
    let proto_body = encode_reflection_list_services();
    let frame_data = grpc_call_unary(&mut channel, proto_body).await?;

    let mut buf = bytes::Bytes::from(frame_data);
    let mut services = Vec::new();

    while buf.has_remaining() {
        let tag_wire = decode_varint(&mut buf)?;
        let tag = tag_wire >> 3;
        let wire_type = tag_wire & 0x07;

        match wire_type {
            0 => { decode_varint(&mut buf)?; }
            1 => { buf.advance(8); }
            2 => {
                let inner = read_field_lengthed(&mut buf)?;
                if tag == 1 {
                    if let Some(name) = parse_service_name_from_list_response(&inner) {
                        services.push(name);
                    }
                }
            }
            5 => { buf.advance(4); }
            _ => { return Err(crate::error::AppError::storage_parse_failed(format!("unknown wire type {}", wire_type))); }
        }
    }

    Ok(services)
}

pub fn parse_service_name_from_list_response(data: &[u8]) -> Option<String> {
    let mut buf = bytes::Bytes::copy_from_slice(data);
    while buf.has_remaining() {
        let tag_wire = decode_varint(&mut buf).ok()?;
        let tag = tag_wire >> 3;
        let wire_type = tag_wire & 0x07;

        match wire_type {
            2 => {
                let inner = read_field_lengthed(&mut buf).ok()?;
                if tag == 1 {
                    return Some(String::from_utf8_lossy(&inner).to_string());
                }
            }
            _ => { return None; }
        }
    }
    None
}

async fn resolve_service_methods(
    channel: &Channel,
    service_name: &str,
) -> Result<Vec<GrpcMethodInfo>, crate::error::AppError> {
    let mut channel = channel.clone();
    let proto_body = encode_file_descriptor_containing_symbol(service_name);
    let frame_data = grpc_call_unary(&mut channel, proto_body).await?;

    let fds_bytes = extract_file_descriptor_set(&frame_data)?;

    let file_descriptor_set = prost_types::FileDescriptorSet::decode(fds_bytes.as_slice())
        .map_err(|e| crate::error::AppError::storage_parse_failed(format!("decode FileDescriptorSet: {}", e)))?;

    let pool = DescriptorPool::from_file_descriptor_set(file_descriptor_set)
        .map_err(|e| crate::error::AppError::storage_parse_failed(format!("descriptor pool: {}", e)))?;

    let mut methods = Vec::new();
    for service in pool.services() {
        if service.full_name() != service_name { continue; }
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

    Ok(methods)
}

pub fn extract_file_descriptor_set(data: &[u8]) -> Result<Vec<u8>, crate::error::AppError> {
    let mut buf = bytes::Bytes::copy_from_slice(data);

    while buf.has_remaining() {
        let tag_wire = decode_varint(&mut buf)?;
        let tag = tag_wire >> 3;
        let wire_type = tag_wire & 0x07;

        match wire_type {
            2 => {
                let inner = read_field_lengthed(&mut buf)?;
                if tag == 1 {
                    let mut inner_buf = inner;
                    while inner_buf.has_remaining() {
                        let itag_wire = decode_varint(&mut inner_buf)?;
                        let itag = itag_wire >> 3;
                        let iwire = itag_wire & 0x07;
                        if iwire == 2 {
                            let iinner = read_field_lengthed(&mut inner_buf)?;
                            if itag == 2 {
                                return Ok(iinner.to_vec());
                            }
                        } else {
                            break;
                        }
                    }
                }
            }
            _ => { return Err(crate::error::AppError::storage_parse_failed("unexpected wire type in fd response".into())); }
        }
    }

    Err(crate::error::AppError::storage_parse_failed("no file descriptor in response".into()))
}
