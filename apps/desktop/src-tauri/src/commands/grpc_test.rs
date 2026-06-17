use crate::commands::grpc::{
    GrpcMethodInfo, GrpcResponse, GrpcStreamMessage, GrpcRequestConfig,
    decode_grpc_frame,
};

#[test]
fn test_grpc_method_info_serde() {
    let info = GrpcMethodInfo {
        service_name: "test.v1.UserService".into(),
        method_name: "GetUser".into(),
        input_type: "test.v1.GetUserRequest".into(),
        output_type: "test.v1.GetUserResponse".into(),
        client_streaming: false,
        server_streaming: false,
    };
    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("serviceName"));
    assert!(json.contains("methodName"));
    let parsed: GrpcMethodInfo = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.service_name, "test.v1.UserService");
    assert_eq!(parsed.method_name, "GetUser");
}

#[test]
fn test_grpc_response_serde() {
    let resp = GrpcResponse {
        request_id: "req-1".into(),
        status: "ok".into(),
        headers: vec![("content-type".into(), "application/grpc".into())],
        body: r#"{"id":1}"#.to_string(),
        time_ms: 42,
    };
    let json = serde_json::to_string(&resp).unwrap();
    assert!(json.contains("requestId"));
    assert!(json.contains("timeMs"));
    let parsed: GrpcResponse = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.request_id, "req-1");
    assert_eq!(parsed.time_ms, 42);
}

#[test]
fn test_grpc_stream_message_serde() {
    let msg = GrpcStreamMessage {
        request_id: "stream-1".into(),
        body: r#"{"chunk":1}"#.to_string(),
        stream_type: "data".into(),
    };
    let json = serde_json::to_string(&msg).unwrap();
    assert!(json.contains("streamType"));
    let parsed: GrpcStreamMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.stream_type, "data");
    assert_eq!(parsed.body, r#"{"chunk":1}"#);
}

#[test]
fn test_grpc_request_config_deser() {
    let json = r#"{
        "requestId": "r1",
        "url": "http://localhost:50051",
        "serviceName": "test.Service",
        "methodName": "Call",
        "requestJson": "{}",
        "metadata": [["authorization", "Bearer x"]],
        "timeoutMs": 5000,
        "protoFileId": "proto-1"
    }"#;
    let config: GrpcRequestConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.request_id, "r1");
    assert_eq!(config.service_name, "test.Service");
    assert_eq!(config.method_name, "Call");
    assert_eq!(config.timeout_ms, Some(5000));
    assert_eq!(config.proto_file_id.as_deref(), Some("proto-1"));
    let meta = config.metadata.unwrap();
    assert_eq!(meta[0].0, "authorization");
    assert_eq!(meta[0].1, "Bearer x");
}

#[test]
fn test_encode_decode_grpc_frame_roundtrip() {
    let body = b"hello protobuf";
    let mut frame = Vec::with_capacity(body.len() + 5);
    frame.push(0);
    let len = body.len() as u32;
    frame.extend_from_slice(&len.to_be_bytes());
    frame.extend_from_slice(body);

    let decoded = decode_grpc_frame(&frame).unwrap();
    assert_eq!(decoded, body);
}

#[test]
fn test_decode_grpc_frame_too_short() {
    let result = decode_grpc_frame(&[0, 0, 0, 0]);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("too short"));
}

#[test]
fn test_decode_grpc_frame_truncated() {
    let data = vec![0u8, 0, 0, 0, 10, 1, 2, 3];
    let result = decode_grpc_frame(&data);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("truncated"));
}

#[test]
fn test_empty_request_json_defaults() {
    let json = r#"{
        "requestId": "r1",
        "url": "http://localhost:50051",
        "serviceName": "test.Service",
        "methodName": "Call",
        "requestJson": "{}"
    }"#;
    let config: GrpcRequestConfig = serde_json::from_str(json).unwrap();
    assert!(config.metadata.is_none());
    assert!(config.timeout_ms.is_none());
    assert!(config.proto_file_id.is_none());
}

#[test]
fn test_grpc_stream_message_error() {
    let msg = GrpcStreamMessage {
        request_id: "err-1".into(),
        body: "something broke".into(),
        stream_type: "error".into(),
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: GrpcStreamMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.stream_type, "error");
}

#[test]
fn test_grpc_stream_message_end() {
    let msg = GrpcStreamMessage {
        request_id: "end-1".into(),
        body: "Stream complete".into(),
        stream_type: "end".into(),
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: GrpcStreamMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.stream_type, "end");
}