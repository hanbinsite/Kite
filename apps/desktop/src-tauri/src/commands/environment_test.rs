use crate::commands::environment::{EnvironmentFile, EnvironmentVariable, EnvironmentSummary};

#[test]
fn test_environment_file_serde() {
    let env = EnvironmentFile {
        id: "env-1".into(),
        name: "Development".into(),
        variables: vec![
            EnvironmentVariable { key: "HOST".into(), value: "localhost".into(), enabled: true },
            EnvironmentVariable { key: "PORT".into(), value: "3000".into(), enabled: true },
        ],
        env_type: Some("development".into()),
        created_at: "2025-01-01T00:00:00Z".into(),
        updated_at: "2025-01-02T00:00:00Z".into(),
    };
    let json = serde_json::to_string(&env).unwrap();
    let parsed: EnvironmentFile = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, "env-1");
    assert_eq!(parsed.name, "Development");
    assert_eq!(parsed.variables.len(), 2);
    assert_eq!(parsed.variables[0].key, "HOST");
    assert_eq!(parsed.variables[0].value, "localhost");
    assert!(parsed.variables[0].enabled);
    assert_eq!(parsed.env_type.unwrap(), "development");
}

#[test]
fn test_environment_variable_default_enabled() {
    // default_true() is used in serde(default = "default_true")
    let json = r#"{"key":"KEY","value":"val"}"#;
    let parsed: EnvironmentVariable = serde_json::from_str(json).unwrap();
    assert_eq!(parsed.key, "KEY");
    assert_eq!(parsed.value, "val");
    assert!(parsed.enabled);
}

#[test]
fn test_environment_variable_explicitly_disabled() {
    let json = r#"{"key":"KEY","value":"val","enabled":false}"#;
    let parsed: EnvironmentVariable = serde_json::from_str(json).unwrap();
    assert!(!parsed.enabled);
}

#[test]
fn test_environment_summary() {
    let summary = EnvironmentSummary {
        id: "env-1".into(),
        name: "Staging".into(),
        variable_count: 5,
        updated_at: "2025-06-01T00:00:00Z".into(),
    };
    let json = serde_json::to_string(&summary).unwrap();
    let parsed: EnvironmentSummary = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, "env-1");
    assert_eq!(parsed.name, "Staging");
    assert_eq!(parsed.variable_count, 5);
}

#[test]
fn test_environment_file_with_empty_variables() {
    let env = EnvironmentFile {
        id: "empty".into(),
        name: "Empty Env".into(),
        variables: vec![],
        env_type: None,
        created_at: "2025-01-01T00:00:00Z".into(),
        updated_at: "2025-01-01T00:00:00Z".into(),
    };
    let json = serde_json::to_string(&env).unwrap();
    assert!(json.contains("empty"));
    assert!(json.contains("Empty Env"));
}

#[test]
fn test_environment_variable_disabled_serialization() {
    let var = EnvironmentVariable {
        key: "API_KEY".into(),
        value: "secret".into(),
        enabled: false,
    };
    let json = serde_json::to_string(&var).unwrap();
    assert!(json.contains(r#""enabled":false"#));
}