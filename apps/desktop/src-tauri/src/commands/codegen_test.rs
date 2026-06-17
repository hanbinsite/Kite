use crate::commands::codegen::{generate_code, CodeLanguage};
use crate::commands::http::{
    HttpRequestConfig, RequestSettings, Header, BodyConfig,
};

fn test_config() -> HttpRequestConfig {
    HttpRequestConfig {
        id: "test-1".into(),
        method: "GET".into(),
        url: "https://api.example.com/users".into(),
        headers: vec![
            Header { key: "Content-Type".into(), value: "application/json".into(), disabled: false },
            Header { key: "Authorization".into(), value: "Bearer token123".into(), disabled: false },
        ],
        params: vec![],
        body: None,
        auth: None,
        settings: RequestSettings::default(),
    }
}

#[tokio::test]
async fn test_generate_curl_basic() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::Curl).await.unwrap();
    assert!(result.code.contains("curl -X GET"));
    assert!(result.code.contains("https://api.example.com/users"));
    assert!(result.code.contains("Content-Type"));
}

#[tokio::test]
async fn test_generate_curl_with_body() {
    let mut config = test_config();
    config.method = "POST".into();
    config.body = Some(BodyConfig {
        mode: "raw".into(),
        content: Some(r#"{"key":"value"}"#.into()),
        content_type: None,
        formdata: vec![],
        urlencoded: vec![],
        graphql_query: None,
        graphql_variables: None,
    });
    let result = generate_code(config, CodeLanguage::Curl).await.unwrap();
    assert!(result.code.contains("curl -X POST"));
    assert!(result.code.contains("-d '{\"key\":\"value\"}'"));
}

#[tokio::test]
async fn test_generate_python_requests() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::PythonRequests).await.unwrap();
    assert!(result.code.contains("import requests"));
    assert!(result.code.contains("requests.get"));
    assert!(result.code.contains("https://api.example.com/users"));
}

#[tokio::test]
async fn test_generate_javascript_fetch() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::JavascriptFetch).await.unwrap();
    assert!(result.code.contains("fetch("));
    assert!(result.code.contains(".then(response => response.json())"));
}

#[tokio::test]
async fn test_generate_javascript_axios() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::JavascriptAxios).await.unwrap();
    assert!(result.code.contains("axios("));
    assert!(result.code.contains(".then(response => response.data)"));
}

#[tokio::test]
async fn test_generate_typescript_fetch() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::TypescriptFetch).await.unwrap();
    assert!(result.code.contains("fetch("));
}

#[tokio::test]
async fn test_generate_go() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::GoNetHttp).await.unwrap();
    assert!(result.code.contains("package main"));
    assert!(result.code.contains("net/http"));
    assert!(result.code.contains("http.NewRequest"));
}

#[tokio::test]
async fn test_generate_java() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::JavaHttpurlconnection).await.unwrap();
    assert!(result.code.contains("HttpClient"));
    assert!(result.code.contains("HttpRequest.newBuilder"));
    assert!(result.code.contains("api.example.com"));
}

#[tokio::test]
async fn test_generate_csharp() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::CsharpHttpclient).await.unwrap();
    assert!(result.code.contains("using System.Net.Http"));
    assert!(result.code.contains("HttpClient"));
}

#[tokio::test]
async fn test_generate_php_curl() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::PhpCurl).await.unwrap();
    assert!(result.code.contains("<?php"));
    assert!(result.code.contains("curl_init"));
}

#[tokio::test]
async fn test_generate_ruby() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::RubyNetHttp).await.unwrap();
    assert!(result.code.contains("require 'net/http'"));
    assert!(result.code.contains("Net::HTTP"));
}

#[tokio::test]
async fn test_generate_kotlin() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::KotlinOkhttp).await.unwrap();
    assert!(result.code.contains("OkHttpClient"));
    assert!(result.code.contains("api.example.com"));
}

#[tokio::test]
async fn test_generate_swift() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::SwiftUrlsession).await.unwrap();
    assert!(result.code.contains("URLSession"));
    assert!(result.code.contains("URLRequest"));
}

#[tokio::test]
async fn test_generate_dart() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::DartHttp).await.unwrap();
    assert!(result.code.contains("package:http"));
    assert!(result.code.contains("http.get"));
}

#[tokio::test]
async fn test_generate_node_undici() {
    let config = test_config();
    let result = generate_code(config, CodeLanguage::NodeUndici).await.unwrap();
    assert!(result.code.contains("require('undici')"));
    assert!(result.code.contains("api.example.com"));
}

#[tokio::test]
async fn test_language_string_in_result() {
    let config = test_config();
    let result = generate_code(config.clone(), CodeLanguage::Curl).await.unwrap();
    assert_eq!(result.language, "curl");
    let result2 = generate_code(config, CodeLanguage::PythonRequests).await.unwrap();
    assert_eq!(result2.language, "python-requests");
}

#[tokio::test]
async fn test_disabled_headers_excluded() {
    let config = HttpRequestConfig {
        id: "test-1".into(),
        method: "GET".into(),
        url: "https://api.example.com/users".into(),
        headers: vec![
            Header { key: "X-Enabled".into(), value: "yes".into(), disabled: false },
            Header { key: "X-Disabled".into(), value: "no".into(), disabled: true },
        ],
        params: vec![],
        body: None,
        auth: None,
        settings: RequestSettings::default(),
    };
    let result = generate_code(config, CodeLanguage::Curl).await.unwrap();
    assert!(result.code.contains("X-Enabled"));
    assert!(!result.code.contains("X-Disabled"));
}

#[tokio::test]
async fn test_all_methods_generate() {
    for method in &["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] {
        let config = HttpRequestConfig {
            id: "test".into(),
            method: method.to_string(),
            url: "https://api.example.com".into(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let result = generate_code(config, CodeLanguage::Curl).await;
        assert!(result.is_ok(), "Curl generation failed for {}", method);
    }
}