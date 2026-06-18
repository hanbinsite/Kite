pub mod commands;
pub mod error;
pub mod storage;
pub mod script;
pub mod ai;
pub mod proxy;
mod ts_export;
#[cfg(test)]
pub mod test_utils;
#[cfg(test)]
mod crypto_integration_test;

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
