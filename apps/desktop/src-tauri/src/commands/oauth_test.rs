use super::oauth::*;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OAuth2FlowConfig {
    authorization_url: String,
    token_url: String,
    client_id: String,
    client_secret: Option<String>,
    scope: Option<String>,
    redirect_uri: String,
}

#[test]
fn oauth2_flow_config_serde_roundtrip() {
    let config = OAuth2FlowConfig {
        authorization_url: "https://auth.example.com/authorize".into(),
        token_url: "https://auth.example.com/token".into(),
        client_id: "my_client_id".into(),
        client_secret: Some("my_secret".into()),
        scope: Some("read write".into()),
        redirect_uri: "http://localhost:16111/callback".into(),
    };

    let json = serde_json::to_string(&config).unwrap();
    let parsed: OAuth2FlowConfig = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.authorization_url, config.authorization_url);
    assert_eq!(parsed.token_url, config.token_url);
    assert_eq!(parsed.client_id, config.client_id);
    assert_eq!(parsed.client_secret, config.client_secret);
    assert_eq!(parsed.scope, config.scope);
    assert_eq!(parsed.redirect_uri, config.redirect_uri);
}

#[test]
fn oauth2_flow_config_optional_fields_none() {
    let config = OAuth2FlowConfig {
        authorization_url: "https://auth.example.com/authorize".into(),
        token_url: "https://auth.example.com/token".into(),
        client_id: "my_client_id".into(),
        client_secret: None,
        scope: None,
        redirect_uri: "http://localhost:16111/callback".into(),
    };

    let json = serde_json::to_string(&config).unwrap();
    let parsed: OAuth2FlowConfig = serde_json::from_str(&json).unwrap();

    assert!(parsed.client_secret.is_none());
    assert!(parsed.scope.is_none());
}

#[test]
fn generate_code_verifier_length_and_chars() {
    let verifier = generate_pkce_verifier();
    assert_eq!(verifier.len(), 86);
    assert!(verifier
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
}

#[test]
fn generate_code_verifier_randomness() {
    let v1 = generate_pkce_verifier();
    let v2 = generate_pkce_verifier();
    assert_ne!(v1, v2, "Two generated verifiers should not be equal");
}

#[test]
fn compute_code_challenge_known_output() {
    let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    let challenge = compute_code_challenge(verifier);

    let expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    assert_eq!(challenge, expected);

    let expected_digest =
        URL_SAFE_NO_PAD.encode(Sha256::digest(b"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"));
    assert_eq!(challenge, expected_digest);
}

#[test]
fn compute_code_challenge_known_empty() {
    let challenge = compute_code_challenge("");
    let expected =
        URL_SAFE_NO_PAD.encode(Sha256::digest(b""));
    assert_eq!(challenge, expected);
}

#[test]
fn generate_state_length() {
    let state = generate_state();
    assert!(!state.is_empty());
    let decoded = URL_SAFE_NO_PAD.decode(&state).unwrap();
    assert_eq!(decoded.len(), 32);
}

#[test]
fn generate_state_randomness() {
    let s1 = generate_state();
    let s2 = generate_state();
    assert_ne!(s1, s2, "Two generated states should not be equal");
}

#[test]
fn build_authorization_url_params() {
    let verifier = generate_pkce_verifier();
    let challenge = compute_code_challenge(&verifier);
    let state = generate_state();

    let args = StartOAuth2Args {
        authorization_url: "https://auth.example.com/authorize".into(),
        token_url: "https://auth.example.com/token".into(),
        client_id: "my_client_id".into(),
        client_secret: None,
        scope: Some("read write".into()),
        redirect_uri: "http://localhost:16111/callback".into(),
    };

    let encoded_scope = urlencoding("read write");
    let url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&state={}&code_challenge={}&code_challenge_method=S256&scope={}",
        args.authorization_url,
        urlencoding(&args.client_id),
        urlencoding(&args.redirect_uri),
        urlencoding(&state),
        urlencoding(&challenge),
        encoded_scope,
    );

    assert!(url.starts_with("https://auth.example.com/authorize?"));
    assert!(url.contains("response_type=code"));
    assert!(url.contains("client_id=my_client_id"));
    assert!(url.contains("redirect_uri=http%3A%2F%2Flocalhost%3A16111%2Fcallback"));
    assert!(url.contains("scope=read+write"));
    assert!(url.contains("code_challenge_method=S256"));
    assert!(url.contains(&format!("state={}", urlencoding(&state))));
    assert!(url.contains(&format!("code_challenge={}", urlencoding(&challenge))));
}

#[test]
fn build_authorization_url_no_scope() {
    let verifier = generate_pkce_verifier();
    let challenge = compute_code_challenge(&verifier);
    let state = generate_state();

    let args = StartOAuth2Args {
        authorization_url: "https://auth.example.com/authorize".into(),
        token_url: "https://auth.example.com/token".into(),
        client_id: "my_client_id".into(),
        client_secret: None,
        scope: None,
        redirect_uri: "http://localhost:16111/callback".into(),
    };

    let url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&state={}&code_challenge={}&code_challenge_method=S256",
        args.authorization_url,
        urlencoding(&args.client_id),
        urlencoding(&args.redirect_uri),
        urlencoding(&state),
        urlencoding(&challenge),
    );

    assert!(!url.contains("scope="));
}

#[test]
fn oauth2_token_response_deser() {
    let json = r#"{
        "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
        "tokenType": "Bearer",
        "refreshToken": "def50200...",
        "expiresIn": 3600
    }"#;

    let token: OAuth2TokenResponse = serde_json::from_str(json).unwrap();
    assert_eq!(token.access_token, "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...");
    assert_eq!(token.token_type, Some("Bearer".into()));
    assert_eq!(token.refresh_token, Some("def50200...".into()));
    assert_eq!(token.expires_in, Some(3600));
}

#[test]
fn oauth2_token_response_deser_minimal() {
    let json = r#"{
        "accessToken": "minimal_token"
    }"#;

    let token: OAuth2TokenResponse = serde_json::from_str(json).unwrap();
    assert_eq!(token.access_token, "minimal_token");
    assert_eq!(token.token_type, None);
    assert_eq!(token.refresh_token, None);
    assert_eq!(token.expires_in, None);
}

#[test]
fn oauth_start_result_roundtrip() {
    let result = StartOAuth2Result {
        state: "some_state_value".into(),
        code_verifier: "some_code_verifier".into(),
    };

    let json = serde_json::to_string(&result).unwrap();
    let parsed: StartOAuth2Result = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.state, result.state);
    assert_eq!(parsed.code_verifier, result.code_verifier);
}

#[test]
fn exchange_oauth2_args_roundtrip() {
    let args = ExchangeOAuth2Args {
        token_url: "https://auth.example.com/token".into(),
        client_id: "my_client_id".into(),
        client_secret: Some("my_secret".into()),
        code: "auth_code_123".into(),
        code_verifier: "verifier_string".into(),
        redirect_uri: "http://localhost:16111/callback".into(),
    };

    let json = serde_json::to_string(&args).unwrap();
    let parsed: ExchangeOAuth2Args = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.token_url, args.token_url);
    assert_eq!(parsed.client_id, args.client_id);
    assert_eq!(parsed.client_secret, args.client_secret);
    assert_eq!(parsed.code, args.code);
    assert_eq!(parsed.code_verifier, args.code_verifier);
    assert_eq!(parsed.redirect_uri, args.redirect_uri);
}

#[test]
fn url_encoding_special_chars() {
    let input = "hello world!@#$%^&*()";
    let encoded = urlencoding(input);
    assert!(!encoded.contains(' '));
    assert!(encoded.contains("hello"));
    assert!(encoded.contains("world"));
}

fn urlencoding(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect::<String>()
}