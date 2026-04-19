pub mod commands;
pub mod error;
pub mod storage;

use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub storage: Arc<RwLock<Option<storage::Storage>>>,
}
