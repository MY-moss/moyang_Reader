use crate::*;
use rusqlite::{Connection, TransactionBehavior};
use std::path::Path;

pub(crate) fn upgrade(conn: &mut Connection, directory: &Path, existing: bool) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version > 5 {
        return Err(invalid("数据库版本更新，请使用新版程序。"));
    }
    if version < 5 {
        if existing {
            snapshot(conn, directory, "upgrade")?;
        }
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let version: i64 = tx.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version < 2 {
            tx.execute_batch("ALTER TABLE records ADD COLUMN sharing TEXT NOT NULL DEFAULT 'legacy';
                CREATE INDEX records_sharing ON records(sharing,project,state);
                CREATE TABLE checkpoints(id TEXT PRIMARY KEY, client TEXT NOT NULL, session TEXT NOT NULL, turn TEXT NOT NULL, status TEXT NOT NULL, updated INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(client,session,turn));
                CREATE TABLE conflicts(id TEXT PRIMARY KEY, status TEXT NOT NULL, updated INTEGER NOT NULL, payload TEXT NOT NULL);
                CREATE TABLE activities(id TEXT PRIMARY KEY, updated INTEGER NOT NULL, payload TEXT NOT NULL);
                PRAGMA user_version=2;")?;
        }
        if version < 3 {
            tx.execute_batch("CREATE TABLE derived_context(id TEXT PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE, input_fingerprint TEXT NOT NULL, overview TEXT NOT NULL, purpose TEXT NOT NULL, generated INTEGER NOT NULL); PRAGMA user_version=3;")?;
        }
        if version < 4 {
            tx.execute_batch("CREATE TABLE organization_queue(id TEXT PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE, fingerprint TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL, priority INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '');
                CREATE TABLE organization_usage(id TEXT PRIMARY KEY, job TEXT NOT NULL, day INTEGER NOT NULL, reserved INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, estimated INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL, created INTEGER NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL);
                CREATE INDEX organization_usage_day ON organization_usage(day,state);
                CREATE TABLE memory_merges(id TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL, payload TEXT NOT NULL);
                PRAGMA user_version=4;")?;
        }
        if version < 5 {
            crate::resources::migrate(&tx)?;
            tx.execute_batch("PRAGMA user_version=5;")?;
        }
        tx.commit()?;
    }
    // SQLite snapshots include committed WAL pages, unlike copying just the database file.
    let has_records: bool =
        conn.query_row("SELECT EXISTS(SELECT 1 FROM records)", [], |r| r.get(0))?;
    if has_records {
        rotate_snapshots(conn, directory)?;
    }
    Ok(())
}
fn snapshot(conn: &Connection, directory: &Path, label: &str) -> Result<std::path::PathBuf> {
    let folder = directory.join("snapshots");
    std::fs::create_dir_all(&folder)?;
    let path = folder.join(format!(
        "{label}-{}-{}.sqlite3",
        now(),
        uuid::Uuid::new_v4()
    ));
    let pending = folder.join(format!(
        ".pending-{}",
        path.file_name().unwrap().to_string_lossy()
    ));
    let result = (|| -> Result<()> {
        conn.execute("VACUUM INTO ?", [pending.to_string_lossy().as_ref()])?;
        std::fs::OpenOptions::new()
            .write(true)
            .open(&pending)?
            .sync_all()?;
        match std::fs::rename(&pending, &path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::CrossesDevices => {
                // Some Windows encrypted/projected folders reject even a same-folder
                // rename. Keep the pending file as a completion marker during copying.
                // Readers ignore the destination until the complete copy is synced.
                copy_snapshot(&pending, &path)?;
            }
            Err(error) => return Err(error.into()),
        }
        Ok(())
    })();
    if result.is_err() {
        // A failed copy must never appear complete after its marker is removed.
        if !path.exists() || std::fs::remove_file(&path).is_ok() {
            let _ = std::fs::remove_file(&pending);
        }
    }
    result?;
    Ok(path)
}
fn copy_snapshot(pending: &Path, path: &Path) -> Result<()> {
    let mut source = std::fs::File::open(pending)?;
    let mut target = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    std::io::copy(&mut source, &mut target)?;
    target.sync_all()?;
    drop(target);
    drop(source);
    std::fs::remove_file(pending)?;
    Ok(())
}
fn snapshot_complete(path: &Path) -> bool {
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    !name.starts_with('.')
        && path
            .extension()
            .is_some_and(|extension| extension == "sqlite3")
        && !path.with_file_name(format!(".pending-{name}")).exists()
}
fn rotate_snapshots(conn: &Connection, directory: &Path) -> Result<()> {
    let folder = directory.join("snapshots");
    std::fs::create_dir_all(&folder)?;
    // Desktop and MCP readers may open the same store concurrently. Only one
    // process creates/prunes snapshots; others can continue reading the store.
    // Keep the lock file stable so every process locks the same OS object.
    let rotation = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(folder.join(".rotation.lock"))?;
    match rotation.try_lock() {
        Ok(()) => {}
        Err(std::fs::TryLockError::WouldBlock) => return Ok(()),
        Err(std::fs::TryLockError::Error(error)) => return Err(error.into()),
    }
    let mut files: Vec<_> = std::fs::read_dir(&folder)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|path| snapshot_complete(path))
        .collect();
    for (kind, bucket, retain) in [
        ("day", now() / 86_400_000, 7),
        ("week", now() / 604_800_000, 4),
    ] {
        let prefix = format!("{kind}-{bucket}-");
        if !files.iter().any(|p| {
            p.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .starts_with(&prefix)
        }) {
            files.push(snapshot(conn, directory, &format!("{kind}-{bucket}"))?);
        }
        let mut series: Vec<_> = files
            .iter()
            .filter_map(|p| {
                let name = p.file_name()?.to_string_lossy();
                let bucket = name
                    .strip_prefix(&format!("{kind}-"))?
                    .split('-')
                    .next()?
                    .parse::<i64>()
                    .ok()?;
                Some((bucket, p))
            })
            .collect();
        series.sort_by(|a, b| {
            b.0.cmp(&a.0)
                .then_with(|| b.1.file_name().cmp(&a.1.file_name()))
        });
        let mut retained = std::collections::HashSet::new();
        for (bucket, path) in series {
            // Multiple processes may finish snapshots of the same period together.
            // Such copies must not evict snapshots from distinct days or weeks.
            if retained.len() < retain && retained.insert(bucket) {
                continue;
            }
            match std::fs::remove_file(path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(
                        std::io::Error::new(error.kind(), format!("清理过期备份：{error}")).into(),
                    )
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copied_snapshot_is_published_only_after_completion() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("day-1-test.sqlite3");
        let pending = directory.path().join(".pending-day-1-test.sqlite3");
        let source = Connection::open(&pending).unwrap();
        source
            .execute_batch(
                "CREATE TABLE evidence(value TEXT); INSERT INTO evidence VALUES ('保存正文');",
            )
            .unwrap();
        drop(source);
        std::fs::write(&path, "interrupted copy").unwrap();
        assert!(!snapshot_complete(&path));
        assert!(copy_snapshot(&pending, &path).is_err());
        assert!(pending.exists());
        std::fs::remove_file(&path).unwrap();
        copy_snapshot(&pending, &path).unwrap();
        assert!(snapshot_complete(&path));
        assert!(!pending.exists());
        let copy = Connection::open(path).unwrap();
        let text: String = copy
            .query_row("SELECT value FROM evidence", [], |row| row.get(0))
            .unwrap();
        assert_eq!(text, "保存正文");
        let integrity: String = copy
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .unwrap();
        assert_eq!(integrity, "ok");
    }

    #[test]
    fn simultaneous_readers_can_create_initial_snapshots() {
        for _ in 0..10 {
            let directory = tempfile::tempdir().unwrap();
            let mut store = Store::open(directory.path()).unwrap();
            let record = store
                .save(
                    serde_json::from_value(serde_json::json!({
                        "kind":"memory", "title":"并发读取", "body":"保存正文"
                    }))
                    .unwrap(),
                )
                .unwrap();
            drop(store);
            let barrier = std::sync::Barrier::new(8);
            std::thread::scope(|scope| {
                let jobs: Vec<_> = (0..8)
                    .map(|_| {
                        scope.spawn(|| {
                            barrier.wait();
                            let store = Store::open(directory.path())?;
                            assert_eq!(store.get(&record.id)?.fields.body, "保存正文");
                            Ok::<_, Error>(())
                        })
                    })
                    .collect();
                for job in jobs {
                    job.join().unwrap().unwrap();
                }
            });
            let backups: Vec<_> = std::fs::read_dir(directory.path().join("snapshots"))
                .unwrap()
                .map(|entry| entry.unwrap().path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "sqlite3"))
                .collect();
            assert_eq!(backups.len(), 2);
            for backup in backups {
                let backup = Connection::open(backup).unwrap();
                let count: i64 = backup
                    .query_row(
                        "SELECT COUNT(*) FROM records WHERE id=?",
                        [&record.id],
                        |row| row.get(0),
                    )
                    .unwrap();
                assert_eq!(count, 1);
            }
        }
    }

    #[test]
    fn retention_counts_distinct_periods_instead_of_concurrent_copies() {
        let directory = tempfile::tempdir().unwrap();
        let folder = directory.path().join("snapshots");
        std::fs::create_dir_all(&folder).unwrap();
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE fixture (value TEXT);")
            .unwrap();
        for (kind, period, retain) in [("day", 86_400_000, 7), ("week", 604_800_000, 4)] {
            let bucket = now() / period;
            for age in 1..=retain {
                for copy in 0..3 {
                    std::fs::write(
                        folder.join(format!("{kind}-{}-1-{copy}.sqlite3", bucket - age)),
                        "fixture",
                    )
                    .unwrap();
                }
            }
        }
        rotate_snapshots(&conn, directory.path()).unwrap();
        for (kind, period, retain) in [("day", 86_400_000, 7), ("week", 604_800_000, 4)] {
            let mut buckets = Vec::new();
            for entry in std::fs::read_dir(&folder).unwrap() {
                let name = entry.unwrap().file_name().to_string_lossy().into_owned();
                if let Some(suffix) = name.strip_prefix(&format!("{kind}-")) {
                    buckets.push(suffix.split('-').next().unwrap().parse::<i64>().unwrap());
                }
            }
            buckets.sort_unstable_by(|a, b| b.cmp(a));
            let current = now() / period;
            assert_eq!(
                buckets,
                (0..retain).map(|age| current - age).collect::<Vec<_>>()
            );
        }
    }
}
