pub mod commands;
pub mod error;
pub mod storage;
pub mod script;
pub mod ai;

use std::sync::{Arc, Mutex};

pub struct AppState {
    pub storage: Arc<Mutex<Option<storage::Storage>>>,
}
