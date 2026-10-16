//! Versioned portable archive. SQLite keeps records separate and resources deduplicated;
//! the native layer streams the snapshot, never a whole-library JSON or base64 string.
use crate::*;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::File,
    io::{Read, Write},
    path::Path,
};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

fn zip_error(e: zip::result::ZipError) -> Error {
    invalid(&format!("备份归档：{e}"))
}
fn checksum(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    Ok(hex(hash.finalize()))
}
pub(crate) fn portable_setting(key: &str) -> bool {
    ![
        "client-install:",
        "connection:",
        "connection-source:",
        "connection-service:",
        "hook-session:",
    ]
    .iter()
    .any(|prefix| key.starts_with(prefix))
        && !["organization", "local_model", "semantic_background"].contains(&key)
}
impl Store {
    pub fn export_archive(&self, destination: &Path) -> Result<Value> {
        let parent = destination
            .parent()
            .ok_or_else(|| invalid("请选择备份文件位置。"))?;
        let work = tempfile::tempdir_in(parent)?;
        let database = work.path().join("library.sqlite3");
        self.conn
            .execute("VACUUM INTO ?", [database.to_string_lossy().as_ref()])?;
        let mut copy = Connection::open(&database)?;
        {
            let tx = copy.transaction()?;
            let keys = tx
                .prepare("SELECT key FROM settings")?
                .query_map([], |r| r.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            for key in keys {
                if !portable_setting(&key) {
                    tx.execute("DELETE FROM settings WHERE key=?", [key])?;
                }
            }
            // No machine liveness, running locks, reserved quota or model vectors travel with a backup.
            tx.execute_batch("DELETE FROM organization_queue; DELETE FROM organization_usage; DELETE FROM embeddings;")?;
            tx.commit()?;
        }
        copy.execute_batch("PRAGMA journal_mode=DELETE; VACUUM;")?;
        drop(copy);
        let manifest = json!({"format":"moyang-ai-archive","version":1,"schema":5,"exported_at":now(),"data":"library.sqlite3","sha256":checksum(&database)?,"bytes":std::fs::metadata(&database)?.len()});
        let mut output = tempfile::NamedTempFile::new_in(parent)?;
        {
            let mut zip = ZipWriter::new(output.as_file_mut());
            let options = SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .large_file(true);
            zip.start_file("manifest.json", options)
                .map_err(zip_error)?;
            zip.write_all(&serde_json::to_vec(&manifest)?)?;
            zip.start_file("library.sqlite3", options)
                .map_err(zip_error)?;
            std::io::copy(&mut File::open(&database)?, &mut zip)?;
            zip.finish().map_err(zip_error)?;
        }
        output.as_file().sync_all()?;
        // Read back the actual compressed bytes before replacing the requested file.
        let verify = tempfile::tempdir_in(parent)?;
        unpack(output.path(), verify.path())?;
        output.persist(destination).map_err(|e| e.error)?;
        Ok(
            json!({"path":destination,"bytes":std::fs::metadata(destination)?.len(),"format":"moyang-ai-archive","version":1}),
        )
    }
    pub fn import_archive(&mut self, source: &Path) -> Result<Value> {
        // Work files stay beside the selected AI store, rather than defaulting to C:.
        let work = tempfile::tempdir_in(self.path.parent().unwrap())?;
        let database = unpack(source, work.path())?;
        let incoming =
            Connection::open_with_flags(database, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        incoming.execute_batch("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;")?;
        if incoming.query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))? != "ok"
            || incoming.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))? != 5
        {
            return Err(invalid("备份数据库损坏或版本不支持，当前库未改变。"));
        }
        // All imported resource contents are verified, including those used only by history.
        {
            let mut stmt = incoming.prepare("SELECT hash,encoding,content FROM resources")?;
            for row in stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })? {
                let (hash, encoding, content) = row?;
                if !["utf8", "base64"].contains(&encoding.as_str())
                    || crate::resources::fingerprint(&encoding, &content) != hash
                {
                    return Err(invalid("备份资源校验失败。"));
                }
            }
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut inserted = HashSet::new();
        let mut matching = HashSet::new();
        let mut skipped = 0;
        {
            let mut stmt = incoming.prepare("SELECT id,payload FROM records ORDER BY id")?;
            for row in
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            {
                let (id, raw) = row?;
                let mut r: Record = crate::resources::decode(&incoming, &raw)?;
                crate::store::validate(&mut r.fields)?;
                if id != r.id || id.is_empty() || r.revision < 1 {
                    return Err(invalid("备份记录身份无效。"));
                }
                let exists: bool = tx.query_row(
                    "SELECT EXISTS(SELECT 1 FROM records WHERE id=?)",
                    [&id],
                    |r| r.get(0),
                )?;
                if exists {
                    skipped += 1;
                    if serde_json::to_value(crate::store::read_record(&tx, &id)?)?
                        == serde_json::to_value(&r)?
                    {
                        matching.insert(id.clone());
                    }
                } else {
                    crate::store::persist(&tx, &r, "从便携备份导入")?;
                    matching.insert(id.clone());
                    inserted.insert(id);
                }
            }
        }
        {
            let mut stmt = incoming.prepare(
                "SELECT id,revision,payload,reason,recorded FROM revisions ORDER BY id,revision",
            )?;
            for row in stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            })? {
                let (id, revision, raw, reason, recorded) = row?;
                let mut r: Record = crate::resources::decode(&incoming, &raw)?;
                crate::store::validate(&mut r.fields)?;
                let latest = crate::store::read_record(&incoming, &id)?;
                if r.id != id
                    || r.revision != revision
                    || revision < 1
                    || revision > latest.revision
                    || r.fields.kind != latest.fields.kind
                    || (revision == latest.revision
                        && serde_json::to_value(&r)? != serde_json::to_value(&latest)?)
                {
                    return Err(invalid("备份历史与当前版本不一致。"));
                }
                if inserted.contains(&id) {
                    tx.execute("INSERT OR REPLACE INTO revisions(id,revision,payload,reason,recorded) VALUES(?,?,?,?,?)",params![id,revision,crate::resources::encode(&tx,&r)?,reason,recorded])?;
                } else if !revision_matches(&tx, &r)? {
                    matching.remove(&id);
                }
            }
        }
        {
            let mut stmt = incoming.prepare("SELECT id,score,uses FROM feedback")?;
            for row in stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            })? {
                let (id, score, uses) = row?;
                if !(-10..=10).contains(&score) || uses < 1 {
                    return Err(invalid("备份反馈无效。"));
                }
                if inserted.contains(&id) {
                    tx.execute(
                        "INSERT INTO feedback VALUES(?,?,?)",
                        params![id, score, uses],
                    )?;
                }
            }
        }
        // Copy activities only when every referenced version matches this database.
        // A colliding ID with different content must never give an imported undo access to local edits.
        let mut lifecycle_skipped = 0;
        for table in ["checkpoints", "conflicts", "activities", "memory_merges"] {
            let mut stmt = incoming.prepare(&format!(
                "SELECT id,payload FROM {table} ORDER BY updated,id"
            ))?;
            for row in
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            {
                let (id, raw) = row?;
                let v: Value = crate::resources::decode(&incoming, &raw)?;
                validate_event(table, &id, &v)?;
                if event_records(table, &v)
                    .iter()
                    .any(|id| !matching.contains(*id))
                {
                    lifecycle_skipped += 1;
                    continue;
                }
                let updated = v["updated_at"].as_i64().unwrap_or(now());
                match table {
                    "checkpoints" => {
                        tx.execute(
                            "INSERT OR IGNORE INTO checkpoints VALUES(?,?,?,?,?,?,?)",
                            params![
                                id,
                                v["client"].as_str(),
                                v["session"].as_str(),
                                v["turn"].as_str(),
                                v["status"].as_str(),
                                updated,
                                raw
                            ],
                        )?;
                    }
                    "conflicts" => {
                        tx.execute(
                            "INSERT OR IGNORE INTO conflicts VALUES(?,?,?,?)",
                            params![
                                id,
                                v["status"].as_str(),
                                updated,
                                crate::resources::encode(&tx, &v)?
                            ],
                        )?;
                    }
                    "activities" => {
                        tx.execute(
                            "INSERT OR IGNORE INTO activities VALUES(?,?,?)",
                            params![id, updated, raw],
                        )?;
                    }
                    _ => {
                        let (state, updated): (String, i64) = incoming.query_row(
                            "SELECT state,updated FROM memory_merges WHERE id=?",
                            [&id],
                            |r| Ok((r.get(0)?, r.get(1)?)),
                        )?;
                        tx.execute(
                            "INSERT OR IGNORE INTO memory_merges VALUES(?,?,?,?)",
                            params![id, state, updated, raw],
                        )?;
                    }
                }
            }
        }
        {
            let mut stmt = incoming.prepare("SELECT key,value FROM settings")?;
            for row in
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            {
                let (key, value) = row?;
                if portable_setting(&key) {
                    tx.execute(
                        "INSERT OR IGNORE INTO settings VALUES(?,?)",
                        params![key, value],
                    )?;
                }
            }
        }
        tx.commit()?;
        Ok(
            json!({"imported":inserted.len(),"skipped":skipped,"skipped_activity":lifecycle_skipped}),
        )
    }
}
fn unpack(source: &Path, target: &Path) -> Result<std::path::PathBuf> {
    let mut archive = ZipArchive::new(File::open(source)?).map_err(zip_error)?;
    if archive.len() != 2 {
        return Err(invalid("备份清单不完整。"));
    }
    let manifest: Value = serde_json::from_reader(
        archive
            .by_name("manifest.json")
            .map_err(zip_error)?
            .take(65536),
    )?;
    if manifest["format"] != "moyang-ai-archive"
        || manifest["version"] != 1
        || manifest["schema"] != 5
        || manifest["data"] != "library.sqlite3"
    {
        return Err(invalid("不支持的备份格式。"));
    }
    let database = target.join("library.sqlite3");
    let mut output = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&database)?;
    let mut entry = archive.by_name("library.sqlite3").map_err(zip_error)?;
    if Some(entry.size()) != manifest["bytes"].as_u64() {
        return Err(invalid("备份文件大小与清单不符。"));
    }
    std::io::copy(&mut entry, &mut output)?;
    output.sync_all()?;
    drop(output);
    if manifest["sha256"] != checksum(&database)? {
        return Err(invalid("备份校验失败，原数据未改变。"));
    }
    Ok(database)
}
pub(crate) fn validate_event(table: &str, id: &str, v: &Value) -> Result<()> {
    if id.is_empty() {
        return Err(invalid("备份活动编号无效。"));
    }
    match table {
        "checkpoints" => {
            let c: Checkpoint = serde_json::from_value(v.clone())?;
            if c.id != id
                || !["pending", "completed", "no_new_information"].contains(&c.status.as_str())
            {
                return Err(invalid("备份任务状态无效。"));
            }
        }
        "conflicts" => {
            let mut c: MemoryConflict = serde_json::from_value(v.clone())?;
            crate::store::validate(&mut c.proposal.fields)?;
            if c.id != id
                || !["pending", "accept", "keep_existing", "save_copy"].contains(&c.status.as_str())
            {
                return Err(invalid("备份冲突无效。"));
            }
        }
        "activities" => {
            let a: Activity = serde_json::from_value(v.clone())?;
            if a.id != id || a.after_revision < 1 || a.before_revision.is_some_and(|r| r < 1) {
                return Err(invalid("备份活动无效。"));
            }
        }
        _ => {
            let records: Vec<Record> = serde_json::from_value(v["originals"].clone())?;
            if records.len() != 2 || records.iter().any(|r| r.fields.kind != Kind::Memory) {
                return Err(invalid("备份合并组无效。"));
            }
        }
    }
    Ok(())
}
pub(crate) fn event_records<'a>(table: &str, v: &'a Value) -> Vec<&'a str> {
    let mut ids = Vec::new();
    match table {
        "checkpoints" => {
            if let Some(a) = v["record_ids"].as_array() {
                ids.extend(a.iter().filter_map(Value::as_str));
            }
        }
        "conflicts" => {
            if let Some(id) = v["proposal"]["id"].as_str() {
                ids.push(id);
            }
        }
        "activities" => {
            if let Some(id) = v["record_id"].as_str() {
                ids.push(id);
            }
        }
        _ => {
            if let Some(a) = v["originals"].as_array() {
                ids.extend(a.iter().filter_map(|r| r["id"].as_str()));
            }
            if let Some(id) = v["result"]["id"].as_str() {
                ids.push(id);
            }
        }
    }
    ids
}
pub(crate) fn revision_matches(target: &Connection, record: &Record) -> Result<bool> {
    let raw: Option<String> = target
        .query_row(
            "SELECT payload FROM revisions WHERE id=? AND revision=?",
            params![record.id, record.revision],
            |r| r.get(0),
        )
        .optional()?;
    match raw {
        Some(raw) => {
            Ok(crate::resources::decode::<Value>(target, &raw)? == serde_json::to_value(record)?)
        }
        None => Ok(false),
    }
}
