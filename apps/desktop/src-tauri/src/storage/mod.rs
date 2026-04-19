

use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;

pub struct Storage {
    pub conn: Mutex<Connection>,
}

impl Storage {
    pub fn new(data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
        
        let db_path = data_dir.join("api_client.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                status INTEGER,
                duration INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);
            CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cookie_jar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL,
                name TEXT NOT NULL,
                value TEXT NOT NULL,
                path TEXT,
                expires TEXT,
                secure INTEGER,
                http_only INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_cookie_domain ON cookie_jar(domain);

            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            "
        ).map_err(|e| e.to_string())?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn insert_history(&self, method: &str, url: &str, status: i32, duration: i32) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO history (method, url, status, duration) VALUES (?1, ?2, ?3, ?4)",
            params![method, url, status, duration],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn query_history(&self, limit: i32) -> Result<Vec<HistoryEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, method, url, status, duration, created_at FROM history ORDER BY created_at DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;
        
        let entries = stmt
            .query_map([limit], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    method: row.get(1)?,
                    url: row.get(2)?,
                    status: row.get(3)?,
                    duration: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        
        Ok(entries)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        
        let result = stmt
            .query_row([key], |row| row.get(0))
            .ok();
        
        Ok(result)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub method: String,
    pub url: String,
    pub status: i32,
    pub duration: i32,
    pub created_at: String,
}

#[cfg(test)]
mod tests {
    use super::Storage;
    use tempfile::TempDir;

    fn setup() -> (TempDir, Storage) {
        let dir = TempDir::new().unwrap();
        let storage = Storage::new(dir.path()).unwrap();
        (dir, storage)
    }

    #[test]
    fn test_storage_init() {
        let (dir, _) = setup();
        assert!(dir.path().join("api_client.db").exists());
    }

    #[test]
    fn test_insert_and_query_history() {
        let (_, storage) = setup();

        let id1 = storage.insert_history("GET", "https://api.example.com/users", 200, 150).unwrap();
        let id2 = storage.insert_history("POST", "https://api.example.com/users", 201, 300).unwrap();
        assert!(id1 > 0);
        assert!(id2 > id1);

        let entries = storage.query_history(10).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].method, "POST");
        assert_eq!(entries[0].status, 201);
        assert_eq!(entries[1].method, "GET");
    }

    #[test]
    fn test_history_limit() {
        let (_, storage) = setup();
        for i in 0..20 {
            storage.insert_history("GET", &format!("https://api.example.com/item/{}", i), 200, 100).unwrap();
        }
        let entries = storage.query_history(5).unwrap();
        assert_eq!(entries.len(), 5);
    }

    #[test]
    fn test_settings_crud() {
        let (_, storage) = setup();

        assert!(storage.get_setting("theme").unwrap().is_none());

        storage.set_setting("theme", "dark").unwrap();
        assert_eq!(storage.get_setting("theme").unwrap(), Some("dark".to_string()));

        storage.set_setting("theme", "light").unwrap();
        assert_eq!(storage.get_setting("theme").unwrap(), Some("light".to_string()));
    }

    #[test]
    fn test_concurrent_access() {
        let dir = TempDir::new().unwrap();
        let storage = Storage::new(dir.path()).unwrap();

        let results: Vec<_> = (0..10)
            .map(|i| {
                let s = &storage;
                s.insert_history("GET", &format!("url{}", i), 200, i * 10)
            })
            .collect();

        for r in results {
            assert!(r.is_ok());
        }

        let entries = storage.query_history(100).unwrap();
        assert_eq!(entries.len(), 10);
    }
}