use std::path::Path;

use crate::error::AppError;

/// Write a file atomically by writing to a `.tmp` sibling file and renaming.
/// The rename is atomic on the same filesystem. Returns `STORAGE_WRITE_FAILED`
/// if either the temp write or the rename fails.
pub fn atomic_write(path: &Path, content: &str) -> Result<(), AppError> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to write temp file: {}", e)))?;
    std::fs::rename(&tmp, path)
        .map_err(|e| AppError::storage_write_failed(format!("Failed to rename: {}", e)))?;
    Ok(())
}

/// Create a `.bak` backup of `path` next to it, preserving the original file.
/// No-op if the path does not exist.
pub fn create_backup(path: &Path) -> Result<(), AppError> {
    if path.exists() {
        let bak = path.with_extension("bak");
        std::fs::copy(path, &bak)
            .map_err(|e| AppError::storage_write_failed(format!("Backup failed: {}", e)))?;
    }
    Ok(())
}

/// Read a file, falling back to its `.bak` sibling if the primary read fails.
/// Returns `STORAGE_READ_FAILED` if both reads fail.
pub fn read_with_backup(path: &Path) -> Result<String, AppError> {
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(_) => {
            let bak = path.with_extension("bak");
            std::fs::read_to_string(&bak).map_err(|e| {
                AppError::storage_read_failed(format!("Read failed and no backup: {}", e))
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_atomic_write_creates_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("data.json");
        atomic_write(&path, "{\"a\":1}").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{\"a\":1}");
        assert!(!path.with_extension("tmp").exists());
    }

    #[test]
    fn test_atomic_write_overwrites() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("data.json");
        atomic_write(&path, "v1").unwrap();
        atomic_write(&path, "v2").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "v2");
    }

    #[test]
    fn test_create_backup_preserves_original() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("env.json");
        std::fs::write(&path, "original").unwrap();
        create_backup(&path).unwrap();
        let bak = path.with_extension("bak");
        assert_eq!(std::fs::read_to_string(&bak).unwrap(), "original");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "original");
    }

    #[test]
    fn test_create_backup_noop_when_missing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("missing.json");
        assert!(create_backup(&path).is_ok());
        assert!(!path.with_extension("bak").exists());
    }

    #[test]
    fn test_read_with_backup_prefers_primary() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("data.json");
        std::fs::write(&path, "fresh").unwrap();
        std::fs::write(path.with_extension("bak"), "stale").unwrap();
        assert_eq!(read_with_backup(&path).unwrap(), "fresh");
    }

    #[test]
    fn test_read_with_backup_falls_back() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("corrupt.json");
        std::fs::write(path.with_extension("bak"), "recovered").unwrap();
        assert_eq!(read_with_backup(&path).unwrap(), "recovered");
    }

    #[test]
    fn test_read_with_backup_no_files_errors() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("none.json");
        let result = read_with_backup(&path);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "STORAGE_READ_FAILED");
    }
}
