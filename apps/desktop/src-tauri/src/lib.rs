pub mod commands;
pub mod error;
pub mod storage;
pub mod script;
pub mod ai;

use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub storage: Arc<RwLock<Option<storage::Storage>>>,
}
