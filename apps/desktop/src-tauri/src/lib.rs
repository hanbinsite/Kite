pub mod commands;
pub mod error;
pub mod storage;
pub mod script;
pub mod ai;
mod ts_export;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Runtime};

pub struct AppState {
    pub storage: Arc<Mutex<Option<storage::Storage>>>,
}

pub fn emit_warn<R: Runtime>(app: &impl Emitter<R>, event: &str, payload: impl Clone + serde::Serialize) {
    if let Err(e) = app.emit(event, payload) {
        tracing::warn!("Failed to emit {}: {}", event, e);
    }
}
