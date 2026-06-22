use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: Option<String>,
    pub entry: String,
    pub permissions: Vec<String>,
    pub hooks: Vec<String>,
    pub commands: Vec<PluginCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginCommand {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub enabled: bool,
    pub has_error: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginHookContext {
    pub event: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginHookResult {
    pub plugin_id: String,
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub logs: Vec<String>,
    pub ui_inject: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_manifest_full() {
        let json = r#"{
            "id": "jwt-inspector",
            "name": "JWT Inspector",
            "version": "1.0.0",
            "description": "Detects JWT tokens in responses",
            "author": "Kite",
            "entry": "index.js",
            "permissions": ["request:read", "response:read", "ui:inject"],
            "hooks": ["onRequestSend", "onResponseReceived"],
            "commands": [
                {"id": "decode", "title": "Decode JWT", "description": "Decode the current JWT"}
            ]
        }"#;
        let m: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(m.id, "jwt-inspector");
        assert_eq!(m.name, "JWT Inspector");
        assert_eq!(m.version, "1.0.0");
        assert_eq!(m.author.as_deref(), Some("Kite"));
        assert_eq!(m.entry, "index.js");
        assert_eq!(m.permissions.len(), 3);
        assert_eq!(m.hooks.len(), 2);
        assert_eq!(m.commands.len(), 1);
        assert_eq!(m.commands[0].id, "decode");
        assert_eq!(m.commands[0].title, "Decode JWT");
        assert_eq!(
            m.commands[0].description.as_deref(),
            Some("Decode the current JWT")
        );
    }

    #[test]
    fn test_parse_manifest_minimal() {
        let json = r#"{
            "id": "bare",
            "name": "Bare",
            "version": "0.1.0",
            "description": "",
            "entry": "main.js",
            "permissions": [],
            "hooks": [],
            "commands": []
        }"#;
        let m: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(m.id, "bare");
        assert!(m.author.is_none());
        assert!(m.commands.is_empty());
    }

    #[test]
    fn test_parse_manifest_rejects_missing_id() {
        let json = r#"{
            "name": "NoId",
            "version": "1.0.0",
            "description": "",
            "entry": "index.js",
            "permissions": [],
            "hooks": [],
            "commands": []
        }"#;
        assert!(serde_json::from_str::<PluginManifest>(json).is_err());
    }

    #[test]
    fn test_parse_manifest_camel_case_fields() {
        let json = r#"{
            "id": "x",
            "name": "X",
            "version": "1",
            "description": "",
            "entry": "i.js",
            "permissions": [],
            "hooks": [],
            "commands": []
        }"#;
        let m: PluginManifest = serde_json::from_str(json).unwrap();
        let info = PluginInfo {
            manifest: m,
            enabled: true,
            has_error: false,
            error: None,
        };
        let serialized = serde_json::to_string(&info).unwrap();
        assert!(serialized.contains("\"pluginId\"") || serialized.contains("\"hasError\""));
        assert!(serialized.contains("\"enabled\""));
    }

    #[test]
    fn test_plugin_hook_context_roundtrip() {
        let ctx = PluginHookContext {
            event: "onResponseReceived".to_string(),
            data: serde_json::json!({"status": 200}),
        };
        let s = serde_json::to_string(&ctx).unwrap();
        let back: PluginHookContext = serde_json::from_str(&s).unwrap();
        assert_eq!(back.event, "onResponseReceived");
        assert_eq!(back.data["status"], 200);
    }

    #[test]
    fn test_plugin_hook_result_serialization() {
        let r = PluginHookResult {
            plugin_id: "p".into(),
            success: true,
            result: Some(serde_json::json!({"modified": false})),
            error: None,
            logs: vec!["hi".into()],
            ui_inject: Some("target::html".into()),
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"pluginId\":\"p\""));
        assert!(s.contains("\"uiInject\""));
        assert!(s.contains("\"success\":true"));
    }
}
