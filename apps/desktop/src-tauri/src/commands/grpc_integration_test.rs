#[cfg(test)]
mod grpc_integration_tests {
    use crate::commands::grpc::{
        encode_grpc_message, decode_grpc_frame, encode_grpc_body,
        encode_reflection_list_services, encode_file_descriptor_containing_symbol,
        parse_service_name_from_list_response, extract_file_descriptor_set,
        decode_varint, read_field_lengthed, GrpcRequestConfig,
        GrpcResponse, GrpcStreamMessage, GrpcMethodInfo,
    };
    use prost::Message;
    use prost_reflect::{DynamicMessage, DescriptorPool};
    use prost_types::field_descriptor_proto::{Label, Type as FdType};
    use prost_types::FileDescriptorSet;

    fn make_simple_file_descriptor_set() -> FileDescriptorSet {
        FileDescriptorSet {
            file: vec![prost_types::FileDescriptorProto {
                name: Some("test.proto".into()),
                package: Some("test.v1".into()),
                syntax: Some("proto3".into()),
                message_type: vec![
                    prost_types::DescriptorProto {
                        name: Some("HelloRequest".into()),
                        field: vec![prost_types::FieldDescriptorProto {
                            name: Some("name".into()),
                            number: Some(1),
                            r#type: Some(FdType::String as i32),
                            label: Some(Label::Optional as i32),
                            ..Default::default()
                        }],
                        ..Default::default()
                    },
                    prost_types::DescriptorProto {
                        name: Some("HelloReply".into()),
                        field: vec![prost_types::FieldDescriptorProto {
                            name: Some("message".into()),
                            number: Some(1),
                            r#type: Some(FdType::String as i32),
                            label: Some(Label::Optional as i32),
                            ..Default::default()
                        }],
                        ..Default::default()
                    },
                ],
                service: vec![prost_types::ServiceDescriptorProto {
                    name: Some("Greeter".into()),
                    method: vec![prost_types::MethodDescriptorProto {
                        name: Some("SayHello".into()),
                        input_type: Some(".test.v1.HelloRequest".into()),
                        output_type: Some(".test.v1.HelloReply".into()),
                        client_streaming: Some(false),
                        server_streaming: Some(false),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            }],
        }
    }

    #[test]
    fn test_full_encode_decode_roundtrip_with_protobuf() {
        let fds = make_simple_file_descriptor_set();
        let pool = DescriptorPool::from_file_descriptor_set(fds).unwrap();

        let hello_req_desc = pool
            .services()
            .next()
            .unwrap()
            .methods()
            .next()
            .unwrap()
            .input()
            .clone();

        let json_val = serde_json::json!({"name": "world"});
        let json_str = serde_json::to_string(&json_val).unwrap();
        let mut deserializer = serde_json::Deserializer::from_str(&json_str);
        let msg = DynamicMessage::deserialize_with_options(
            hello_req_desc,
            &mut deserializer,
            &Default::default(),
        )
        .unwrap();

        let encoded = encode_grpc_message(&msg);
        assert!(encoded.len() > 5, "Encoded frame too short: {}", encoded.len());

        let decoded = decode_grpc_frame(&encoded).unwrap();

        use prost_reflect::ReflectMessage;
        let decoded_msg = DynamicMessage::decode(msg.descriptor(), decoded.as_slice()).unwrap();

        let json_out = serde_json::to_value(&decoded_msg).unwrap();
        assert_eq!(json_out["name"], "world");
    }

    #[test]
    fn test_reflection_list_services_encoding_deterministic() {
        let a = encode_reflection_list_services();
        let b = encode_reflection_list_services();
        assert_eq!(a, b);
    }

    #[test]
    fn test_encode_file_descriptor_containing_symbol_deterministic() {
        let a = encode_file_descriptor_containing_symbol("my.package.MyService");
        let b = encode_file_descriptor_containing_symbol("my.package.MyService");
        assert_eq!(a, b);
    }

    #[test]
    fn test_encode_file_descriptor_containing_symbol_different_for_different_symbols() {
        let a = encode_file_descriptor_containing_symbol("svc.A");
        let b = encode_file_descriptor_containing_symbol("svc.B");
        assert_ne!(a, b);
    }

    #[test]
    fn test_parse_service_name_from_list_response_valid() {
        let data = encode_grpc_reflection_list_response_service("my.package.MyService");
        let name = parse_service_name_from_list_response(&data);
        assert!(name.is_some());
        let name_str = name.unwrap();
        assert!(name_str.contains("my.package.MyService"));
    }

    #[test]
    fn test_parse_service_name_from_list_response_empty() {
        let name = parse_service_name_from_list_response(&[]);
        assert!(name.is_none());
    }

    #[test]
    fn test_extract_file_descriptor_set_with_real_data() {
        let fds = make_simple_file_descriptor_set();
        let fd_bytes = fds.encode_to_vec();

        let mut inner = Vec::new();
        let tag2 = (2 << 3) | 2;
        prost::encoding::encode_varint(tag2 as u64, &mut inner);
        prost::encoding::encode_varint(fd_bytes.len() as u64, &mut inner);
        inner.extend_from_slice(&fd_bytes);

        let mut payload = Vec::new();
        let tag1 = (1 << 3) | 2;
        prost::encoding::encode_varint(tag1 as u64, &mut payload);
        prost::encoding::encode_varint(inner.len() as u64, &mut payload);
        payload.extend_from_slice(&inner);

        let extracted = extract_file_descriptor_set(&payload).unwrap();
        assert!(!extracted.is_empty());

        let roundtrip = FileDescriptorSet::decode(extracted.as_slice()).unwrap();
        assert_eq!(roundtrip.file.len(), 1);
        assert_eq!(roundtrip.file[0].name.as_deref(), Some("test.proto"));
    }

    #[test]
    fn test_extract_file_descriptor_set_empty_input() {
        let result = extract_file_descriptor_set(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_grpc_frame_with_compression_flag() {
        let body = b"compressed-data";
        let mut frame = Vec::with_capacity(body.len() + 5);
        frame.push(1);
        let len = body.len() as u32;
        frame.extend_from_slice(&len.to_be_bytes());
        frame.extend_from_slice(body);

        let decoded = decode_grpc_frame(&frame).unwrap();
        assert_eq!(decoded, body);
    }

    #[test]
    fn test_encode_grpc_body_empty_data() {
        let data: &[u8] = &[];
        let frame = encode_grpc_body(data);
        assert_eq!(frame.len(), 5);
        assert_eq!(frame[0], 0);
        let len = u32::from_be_bytes([frame[1], frame[2], frame[3], frame[4]]);
        assert_eq!(len, 0);
    }

    #[test]
    fn test_encode_grpc_body_large_data() {
        let data = vec![0xABu8; 1000];
        let frame = encode_grpc_body(&data);
        assert_eq!(frame[0], 0);
        let declared_len = u32::from_be_bytes([frame[1], frame[2], frame[3], frame[4]]);
        assert_eq!(declared_len, 1000);
        assert_eq!(&frame[5..], &data[..]);
    }

    #[test]
    fn test_grpc_request_config_all_fields() {
        let json = serde_json::json!({
            "requestId": "req-abc",
            "url": "http://localhost:50051",
            "serviceName": "test.v1.UserService",
            "methodName": "GetUser",
            "requestJson": r#"{"id":42}"#,
            "metadata": [["authorization", "Bearer token123"]],
            "timeoutMs": 10000,
            "protoFileId": "proto-xyz"
        });
        let json_str = serde_json::to_string(&json).unwrap();
        let config: GrpcRequestConfig = serde_json::from_str(&json_str).unwrap();
        assert_eq!(config.request_id, "req-abc");
        assert_eq!(config.service_name, "test.v1.UserService");
        assert_eq!(config.method_name, "GetUser");
        assert_eq!(config.request_json, r#"{"id":42}"#);
        assert_eq!(config.timeout_ms, Some(10000));
        assert_eq!(config.proto_file_id.as_deref(), Some("proto-xyz"));
        let meta = config.metadata.unwrap();
        assert_eq!(meta[0].0, "authorization");
        assert_eq!(meta[0].1, "Bearer token123");
    }

    #[test]
    fn test_grpc_request_config_minimal_fields() {
        let config: GrpcRequestConfig = serde_json::from_str(
            r#"{"requestId":"r1","url":"http://localhost","serviceName":"s","methodName":"m","requestJson":"{}"}"#
        ).unwrap();
        assert!(config.metadata.is_none());
        assert!(config.timeout_ms.is_none());
        assert!(config.proto_file_id.is_none());
    }

    #[test]
    fn test_decode_varint_single_byte() {
        use bytes::Bytes;
        let mut buf = Bytes::from_static(&[0x7F]);
        assert_eq!(decode_varint(&mut buf).unwrap(), 127);
        assert!(buf.is_empty());
    }

    #[test]
    fn test_decode_varint_multi_byte() {
        use bytes::Bytes;
        let mut buf = Bytes::from_static(&[0x80, 0x01]);
        assert_eq!(decode_varint(&mut buf).unwrap(), 128);
    }

    #[test]
    fn test_decode_varint_max() {
        use bytes::Bytes;
        let mut buf = Bytes::from_static(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]);
        let val = decode_varint(&mut buf).unwrap();
        assert_eq!(val, u64::MAX);
    }

    #[test]
    fn test_read_field_lengthed_various_lengths() {
        use bytes::Bytes;

        let mut buf = Bytes::from_static(&[0x01, 0x41]);
        let inner = read_field_lengthed(&mut buf).unwrap();
        assert_eq!(&inner[..], b"A");

        let mut buf = Bytes::from_static(&[0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
        let inner = read_field_lengthed(&mut buf).unwrap();
        assert_eq!(&inner[..], b"Hello");
    }

    #[test]
    fn test_read_field_lengthed_truncated() {
        use bytes::Bytes;
        let mut buf = Bytes::from_static(&[0x0A, 0x41, 0x42]);
        let result = read_field_lengthed(&mut buf);
        assert!(result.is_err());
    }

    #[test]
    fn test_grpc_response_serde_roundtrip() {
        let resp = GrpcResponse {
            request_id: "req-1".into(),
            status: "ok".into(),
            headers: vec![
                ("grpc-status".into(), "0".into()),
                ("content-type".into(), "application/grpc".into()),
            ],
            body: r#"{"id":1,"name":"test"}"#.to_string(),
            time_ms: 42,
        };
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: GrpcResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.request_id, "req-1");
        assert_eq!(parsed.status, "ok");
        assert_eq!(parsed.body, r#"{"id":1,"name":"test"}"#);
        assert_eq!(parsed.time_ms, 42);
        assert_eq!(parsed.headers.len(), 2);
    }

    #[test]
    fn test_grpc_stream_message_all_types() {
        for (stype, body) in &[
            ("data", r#"{"chunk":1}"#),
            ("error", "something went wrong"),
            ("end", "Stream complete"),
        ] {
            let msg = GrpcStreamMessage {
                request_id: "s1".into(),
                body: body.to_string(),
                stream_type: stype.to_string(),
            };
            let json = serde_json::to_string(&msg).unwrap();
            let parsed: GrpcStreamMessage = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed.stream_type, *stype);
            assert_eq!(parsed.body, *body);
        }
    }

    #[test]
    fn test_grpc_method_info_streaming_flags() {
        let info = GrpcMethodInfo {
            service_name: "s".into(),
            method_name: "m".into(),
            input_type: "req".into(),
            output_type: "resp".into(),
            client_streaming: true,
            server_streaming: true,
        };
        let json = serde_json::to_string(&info).unwrap();
        let parsed: GrpcMethodInfo = serde_json::from_str(&json).unwrap();
        assert!(parsed.client_streaming);
        assert!(parsed.server_streaming);
    }

    fn encode_grpc_reflection_list_response_service(name: &str) -> Vec<u8> {
        let mut buf = Vec::new();
        let srv_name_bytes = name.as_bytes();
        let name_enc_size = 1
            + prost::encoding::encoded_len_varint(srv_name_bytes.len() as u64)
            + srv_name_bytes.len();
        let tag1 = (1 << 3) | 2;
        prost::encoding::encode_varint(tag1 as u64, &mut buf);
        prost::encoding::encode_varint(name_enc_size as u64, &mut buf);
        let tag1_name = (1 << 3) | 2;
        prost::encoding::encode_varint(tag1_name as u64, &mut buf);
        prost::encoding::encode_varint(srv_name_bytes.len() as u64, &mut buf);
        buf.extend_from_slice(srv_name_bytes);
        buf
    }

    fn _encode_grpc_reflection_fd_response(fd_bytes: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        let fd_enc_size = 1
            + prost::encoding::encoded_len_varint(fd_bytes.len() as u64)
            + fd_bytes.len();
        let tag1 = (1 << 3) | 2;
        prost::encoding::encode_varint(tag1 as u64, &mut buf);
        prost::encoding::encode_varint(fd_enc_size as u64, &mut buf);
        let tag2 = (2 << 3) | 2;
        prost::encoding::encode_varint(tag2 as u64, &mut buf);
        prost::encoding::encode_varint(fd_bytes.len() as u64, &mut buf);
        buf.extend_from_slice(fd_bytes);
        buf
    }
}