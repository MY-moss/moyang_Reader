//! A read-only, persistent connection detects commits from desktop and MCP without opening Store,
//! rotating backups, parsing records or starting semantic maintenance on every idle poll.
use rusqlite::{Connection, OpenFlags};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
struct Monitor {
    path: PathBuf,
    conn: Connection,
    version: i64,
    next_expiry: Option<i64>,
    generation: u64,
}
static MONITOR: Mutex<Option<Monitor>> = Mutex::new(None);

pub fn token(directory: &Path) -> Result<String, String> {
    let path = directory.join("ai-space.sqlite3");
    let mut slot = MONITOR.lock().map_err(|e| e.to_string())?;
    if !path.exists() {
        *slot = None;
        return Ok("missing".into());
    }
    if slot.as_ref().is_none_or(|m| m.path != path) {
        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
        conn.busy_timeout(std::time::Duration::from_secs(2))
            .map_err(|e| e.to_string())?;
        *slot = Some(Monitor {
            path,
            conn,
            version: -1,
            next_expiry: None,
            generation: 0,
        });
    }
    let monitor = slot.as_mut().unwrap();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    monitor.read(now)
}
impl Monitor {
    fn read(&mut self, now: i64) -> Result<String, String> {
        // data_version values are only compared on this same connection.
        let version: i64 = self
            .conn
            .query_row("PRAGMA data_version", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if self.version != version || self.next_expiry.is_some_and(|expiry| expiry <= now) {
            self.next_expiry = self
                .conn
                .query_row(
                    "SELECT MIN(expires) FROM records WHERE state='active' AND expires>?1",
                    [now],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            self.version = version;
            self.generation += 1;
        }
        Ok(format!("{}:{}", self.path.display(), self.generation))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn detects_another_connection_and_expiry_without_writes() {
        let path = std::env::temp_dir().join(format!(
            "moyang-change-{}.sqlite",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let writer = Connection::open(&path).unwrap();
        writer.execute_batch("CREATE TABLE records(state TEXT,expires INTEGER); INSERT INTO records VALUES('active',100)").unwrap();
        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        let mut monitor = Monitor {
            path: path.clone(),
            conn,
            version: -1,
            next_expiry: None,
            generation: 0,
        };
        let first = monitor.read(50).unwrap();
        assert_eq!(first, monitor.read(60).unwrap());
        writer
            .execute("INSERT INTO records VALUES('active',200)", [])
            .unwrap();
        let changed = monitor.read(60).unwrap();
        assert_ne!(first, changed);
        assert_ne!(changed, monitor.read(101).unwrap());
        drop(monitor);
        drop(writer);
        std::fs::remove_file(path).unwrap();
    }
}
