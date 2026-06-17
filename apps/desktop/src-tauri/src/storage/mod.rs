use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;

pub struct Storage {
    pub conn: Mutex<Connection>,
}

impl Storage {
    #[cfg(test)]
    pub fn in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
        Self::init_tables(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn new(data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
        let db_path = data_dir.join("api_client.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        Self::init_tables(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    fn init_tables(conn: &Connection) -> Result<(), String> {
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
  path TEXT DEFAULT '/',
  expires TEXT,
  secure INTEGER DEFAULT 0,
  http_only INTEGER DEFAULT 0,
  same_site TEXT DEFAULT 'Lax',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(domain, name, path)
);
            CREATE INDEX IF NOT EXISTS idx_cookie_domain ON cookie_jar(domain);
            CREATE INDEX IF NOT EXISTS idx_cookie_name ON cookie_jar(name);

            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            "
        ).map_err(|e| e.to_string())?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    // --- History ---

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

        let entries: Vec<HistoryEntry> = stmt
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
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(entries)
    }

    pub fn search_history(&self, query: &str, limit: i32) -> Result<Vec<HistoryEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let pattern = format!("%{}%", query);
        let mut stmt = conn
            .prepare("SELECT id, method, url, status, duration, created_at FROM history WHERE url LIKE ?1 OR method LIKE ?1 ORDER BY created_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;

        let entries: Vec<HistoryEntry> = stmt
            .query_map(params![pattern, limit], |row| {
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
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(entries)
    }

    pub fn delete_history(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM history WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear_history(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM history", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // --- Settings ---

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

    pub fn delete_setting(&self, key: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM settings WHERE key = ?1", params![key])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // --- Cookie Jar ---

    pub fn insert_cookie(&self, cookie: &CookieEntry) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO cookie_jar (domain, name, value, path, expires, secure, http_only, same_site) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![cookie.domain, cookie.name, cookie.value, cookie.path, cookie.expires, cookie.secure, cookie.http_only, cookie.same_site],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn query_cookies(&self, domain: Option<&str>) -> Result<Vec<CookieEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        if let Some(d) = domain {
            let param = format!("%{}%", d);
            let mut stmt = conn
                .prepare("SELECT id, domain, name, value, path, expires, secure, http_only, same_site FROM cookie_jar WHERE domain LIKE ?1 ORDER BY domain, name")
                .map_err(|e| e.to_string())?;

            let rows: Vec<CookieEntry> = stmt
                .query_map(params![param], |row| {
                    Ok(CookieEntry {
                        id: row.get(0)?,
                        domain: row.get(1)?,
                        name: row.get(2)?,
                        value: row.get(3)?,
                        path: row.get(4)?,
                        expires: row.get(5)?,
                        secure: row.get(6)?,
                        http_only: row.get(7)?,
                        same_site: row.get(8)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(rows)
        } else {
            let mut stmt = conn
                .prepare("SELECT id, domain, name, value, path, expires, secure, http_only, same_site FROM cookie_jar ORDER BY domain, name")
                .map_err(|e| e.to_string())?;
            let rows: Vec<CookieEntry> = stmt
                .query_map([], |row| {
                    Ok(CookieEntry {
                        id: row.get(0)?,
                        domain: row.get(1)?,
                        name: row.get(2)?,
                        value: row.get(3)?,
                        path: row.get(4)?,
                        expires: row.get(5)?,
                        secure: row.get(6)?,
                        http_only: row.get(7)?,
                        same_site: row.get(8)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(rows)
        }
    }

    pub fn delete_cookie(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM cookie_jar WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear_cookies(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM cookie_jar", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn upsert_cookie(&self, cookie: &CookieEntry) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO cookie_jar (domain, name, value, path, expires, secure, http_only, same_site)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(domain, name, path) DO UPDATE SET
             value = excluded.value,
             expires = excluded.expires,
             secure = excluded.secure,
             http_only = excluded.http_only,
             same_site = excluded.same_site",
            params![cookie.domain, cookie.name, cookie.value, cookie.path, cookie.expires, cookie.secure, cookie.http_only, cookie.same_site],
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CookieEntry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub domain: String,
    pub name: String,
    pub value: String,
    #[serde(default = "default_cookie_path")]
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    #[serde(default)]
    pub secure: bool,
    #[serde(default)]
    pub http_only: bool,
    #[serde(default = "default_same_site")]
    pub same_site: String,
}

fn default_cookie_path() -> String {
    "/".into()
}

fn default_same_site() -> String {
    "Lax".into()
}

#[cfg(test)]
mod tests {
    use super::Storage;

    fn setup() -> Storage {
        Storage::in_memory().unwrap()
    }

    #[test]
    fn test_storage_init() {
        let storage = setup();
        assert!(storage.conn.lock().is_ok());
    }

    #[test]
    fn test_insert_and_query_history() {
        let storage = setup();

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
        let storage = setup();
        for i in 0..20 {
            storage.insert_history("GET", &format!("https://api.example.com/item/{}", i), 200, 100).unwrap();
        }
        let entries = storage.query_history(5).unwrap();
        assert_eq!(entries.len(), 5);
    }

    #[test]
    fn test_history_search() {
        let storage = setup();
        storage.insert_history("GET", "https://api.example.com/users", 200, 150).unwrap();
        storage.insert_history("POST", "https://api.example.com/orders", 201, 300).unwrap();
        let entries = storage.search_history("users", 10).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].url.contains("users"));
    }

    #[test]
    fn test_history_delete_and_clear() {
        let storage = setup();
        let id = storage.insert_history("GET", "https://example.com", 200, 100).unwrap();
        storage.delete_history(id).unwrap();
        assert_eq!(storage.query_history(10).unwrap().len(), 0);

        storage.insert_history("GET", "https://a.com", 200, 100).unwrap();
        storage.insert_history("POST", "https://b.com", 201, 200).unwrap();
        storage.clear_history().unwrap();
        assert_eq!(storage.query_history(10).unwrap().len(), 0);
    }

    #[test]
    fn test_settings_crud() {
        let storage = setup();

        assert!(storage.get_setting("theme").unwrap().is_none());

        storage.set_setting("theme", "dark").unwrap();
        assert_eq!(storage.get_setting("theme").unwrap(), Some("dark".to_string()));

        storage.set_setting("theme", "light").unwrap();
        assert_eq!(storage.get_setting("theme").unwrap(), Some("light".to_string()));

        storage.delete_setting("theme").unwrap();
        assert!(storage.get_setting("theme").unwrap().is_none());
    }

    #[test]
    fn test_cookie_crud() {
        let storage = setup();

        let cookie = super::CookieEntry {
            id: None,
            domain: ".example.com".into(),
            name: "session".into(),
            value: "abc123".into(),
            path: "/".into(),
            expires: Some("2026-12-31T23:59:59Z".into()),
            secure: true,
            http_only: true,
            same_site: "Strict".into(),
        };

        storage.insert_cookie(&cookie).unwrap();
        let cookies = storage.query_cookies(None).unwrap();
        assert_eq!(cookies.len(), 1);
        assert_eq!(cookies[0].name, "session");
        assert_eq!(cookies[0].domain, ".example.com");

        let filtered = storage.query_cookies(Some("example.com")).unwrap();
        assert_eq!(filtered.len(), 1);

        storage.clear_cookies().unwrap();
        assert_eq!(storage.query_cookies(None).unwrap().len(), 0);
    }

    #[test]
    fn test_concurrent_access() {
        let storage = Storage::in_memory().unwrap();

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
