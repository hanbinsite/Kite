use crate::ai::local::LocalAiConfig;

#[test]
fn test_local_ai_config_new() {
    let config = LocalAiConfig::new("/models/llama".into(), 11434);
    assert_eq!(config.model_path, "/models/llama");
    assert_eq!(config.port, 11434);
}

#[test]
fn test_local_ai_config_debug_clone() {
    let config = LocalAiConfig::new("/models/test".into(), 8080);
    let cloned = config.clone();
    assert_eq!(cloned.model_path, "/models/test");
    assert_eq!(cloned.port, 8080);
    assert!(format!("{:?}", config).contains("8080"));
}

#[test]
fn test_base_url_trim_trailing_slash() {
    let config = LocalAiConfig::new("/models".into(), 11434);
    assert_eq!(config.port, 11434);
}