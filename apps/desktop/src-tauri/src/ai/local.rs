use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct LocalAiConfig {
    pub model_path: String,
    pub port: u16,
}

impl LocalAiConfig {
    pub fn new(model_path: String, port: u16) -> Self {
        Self { model_path, port }
    }
}

pub async fn test_local_connection(_config: &LocalAiConfig) -> Result<(), AppError> {
    Err(AppError::not_implemented("Local AI model support not yet available".into()))
}