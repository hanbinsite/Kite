use crate::ai::provider::{
    AiProviderConfig, AiChatMessage, AiChatRequest, AiChatWithToolsRequest,
    AiChatResponse, AiChatWithToolsResponse,
    AiUsage, AiStreamChunk, AiApiKeyStatus, AiToolCallResponse,
};

#[test]
fn test_provider_config_serde() {
    let provider = AiProviderConfig {
        id: "openai".into(),
        name: "OpenAI".into(),
        provider_type: "openai".into(),
        base_url: "https://api.openai.com/v1".into(),
        model: "gpt-4".into(),
        temperature: Some(0.7),
        max_tokens: Some(4096),
        is_default: true,
    };
    let json = serde_json::to_string(&provider).unwrap();
    let parsed: AiProviderConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, "openai");
    assert_eq!(parsed.name, "OpenAI");
    assert_eq!(parsed.model, "gpt-4");
    assert_eq!(parsed.temperature, Some(0.7));
    assert!(parsed.is_default);
}

#[test]
fn test_provider_config_serde_skips_optionals() {
    let provider = AiProviderConfig {
        id: "minimal".into(),
        name: "Minimal".into(),
        provider_type: "custom".into(),
        base_url: "http://localhost:8080".into(),
        model: "llama".into(),
        temperature: None,
        max_tokens: None,
        is_default: false,
    };
    let json = serde_json::to_string(&provider).unwrap();
    assert!(!json.contains("temperature"));
    assert!(!json.contains("maxTokens"));
}

#[test]
fn test_chat_message_serde() {
    let msg = AiChatMessage {
        role: "user".into(),
        content: "Hello, how are you?".into(),
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: AiChatMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.role, "user");
    assert_eq!(parsed.content, "Hello, how are you?");
}

#[test]
fn test_chat_request_serde() {
    let req = AiChatRequest {
        provider_id: "openai".into(),
        messages: vec![
            AiChatMessage { role: "system".into(), content: "You are helpful.".into() },
            AiChatMessage { role: "user".into(), content: "Hi".into() },
        ],
        temperature: Some(0.5),
        max_tokens: None,
        session_id: Some("session-123".into()),
    };
    let json = serde_json::to_string(&req).unwrap();
    let parsed: AiChatRequest = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.messages.len(), 2);
    assert_eq!(parsed.temperature, Some(0.5));
    assert!(parsed.max_tokens.is_none());
    assert_eq!(parsed.session_id.unwrap(), "session-123");
}

#[test]
fn test_chat_request_without_optionals() {
    let req = AiChatRequest {
        provider_id: "ollama".into(),
        messages: vec![AiChatMessage { role: "user".into(), content: "ping".into() }],
        temperature: None,
        max_tokens: None,
        session_id: None,
    };
    let json = serde_json::to_string(&req).unwrap();
    assert!(!json.contains("temperature"));
    assert!(!json.contains("maxTokens"));
    assert!(!json.contains("sessionId"));
}

#[test]
fn test_chat_response_serde() {
    let resp = AiChatResponse {
        id: "chatcmpl-123".into(),
        content: "I'm doing well, thank you!".into(),
        model: "gpt-4".into(),
        usage: AiUsage { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    };
    let json = serde_json::to_string(&resp).unwrap();
    let parsed: AiChatResponse = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, "chatcmpl-123");
    assert_eq!(parsed.usage.total_tokens, 18);
}

#[test]
fn test_chat_with_tools_request_serde() {
    let req = AiChatWithToolsRequest {
        provider_id: "openai".into(),
        messages: vec![AiChatMessage { role: "user".into(), content: "Create a GET request to /users".into() }],
        tools: vec![serde_json::json!({
            "type": "function",
            "function": {
                "name": "create_request",
                "parameters": { "type": "object", "properties": {} }
            }
        })],
        temperature: None,
        max_tokens: None,
        session_id: None,
    };
    let json = serde_json::to_string(&req).unwrap();
    let parsed: AiChatWithToolsRequest = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.tools.len(), 1);
    assert_eq!(parsed.messages[0].content, "Create a GET request to /users");
}

#[test]
fn test_stream_chunk_serde() {
    let chunk = AiStreamChunk {
        session_id: "sess-1".into(),
        delta: "Hello".into(),
        done: false,
    };
    let json = serde_json::to_string(&chunk).unwrap();
    assert!(json.contains("sessionId"));
    assert!(json.contains("\"delta\":\"Hello\""));
    let parsed: AiStreamChunk = serde_json::from_str(&json).unwrap();
    assert!(!parsed.done);
}

#[test]
fn test_stream_chunk_done() {
    let chunk = AiStreamChunk {
        session_id: "sess-done".into(),
        delta: "".into(),
        done: true,
    };
    let json = serde_json::to_string(&chunk).unwrap();
    let parsed: AiStreamChunk = serde_json::from_str(&json).unwrap();
    assert!(parsed.done);
}

#[test]
fn test_usage_default() {
    let usage = AiUsage::default();
    assert_eq!(usage.prompt_tokens, 0);
    assert_eq!(usage.completion_tokens, 0);
    assert_eq!(usage.total_tokens, 0);
}

#[test]
fn test_api_key_status() {
    let status = AiApiKeyStatus { has_key: true };
    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"hasKey\":true"));
    let parsed: AiApiKeyStatus = serde_json::from_str(&json).unwrap();
    assert!(parsed.has_key);

    let status_no_key = AiApiKeyStatus { has_key: false };
    let json2 = serde_json::to_string(&status_no_key).unwrap();
    let parsed2: AiApiKeyStatus = serde_json::from_str(&json2).unwrap();
    assert!(!parsed2.has_key);
}

#[test]
fn test_tool_call_response_serde() {
    let resp = AiChatWithToolsResponse {
        id: "resp-1".into(),
        content: None,
        model: "gpt-4".into(),
        tool_calls: vec![AiToolCallResponse {
            id: "call-1".into(),
            call_type: "function".into(),
            function: crate::ai::provider::AiToolCallFunction {
                name: "create_request".into(),
                arguments: r#"{"name":"Get Users","method":"GET","url":"https://api.example.com/users"}"#.into(),
            },
        }],
        usage: AiUsage { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
    };
    let json = serde_json::to_string(&resp).unwrap();
    let parsed: AiChatWithToolsResponse = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.tool_calls.len(), 1);
    assert_eq!(parsed.tool_calls[0].function.name, "create_request");
    assert!(parsed.content.is_none());
}