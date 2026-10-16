//! Immutable resource bodies shared by current records, revisions and proposals.
use crate::*;
use rusqlite::{params, Connection};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub(crate) fn fingerprint(encoding: &str, content: &str) -> String {
    let mut hash = Sha256::new();
    hash.update(encoding.as_bytes());
    hash.update([0]);
    hash.update(content.as_bytes());
    hex(hash.finalize())
}
pub(crate) fn collect_unused(conn: &Connection) -> Result<()> {
    conn.execute_batch("DELETE FROM resources WHERE hash NOT IN (
        SELECT json_extract(a.value,'$.resource_hash') FROM records r,json_each(r.payload,'$.assets') a WHERE json_extract(a.value,'$.resource_hash') IS NOT NULL
        UNION SELECT json_extract(a.value,'$.resource_hash') FROM revisions r,json_each(r.payload,'$.assets') a WHERE json_extract(a.value,'$.resource_hash') IS NOT NULL
        UNION SELECT json_extract(a.value,'$.resource_hash') FROM conflicts r,json_each(r.payload,'$.proposal.assets') a WHERE json_extract(a.value,'$.resource_hash') IS NOT NULL
    );")?;
    Ok(())
}
fn assets_mut(value: &mut Value, mut visit: impl FnMut(&mut Value) -> Result<()>) -> Result<()> {
    // Only domain resource collections; never interpret arbitrary user metadata.
    for pointer in ["/assets", "/proposal/assets"] {
        if let Some(items) = value.pointer_mut(pointer).and_then(Value::as_array_mut) {
            for asset in items {
                visit(asset)?;
            }
        }
    }
    Ok(())
}
pub(crate) fn pack_value(conn: &Connection, mut value: Value) -> Result<Value> {
    assets_mut(&mut value, |a| {
        let encoding = a["encoding"]
            .as_str()
            .ok_or_else(|| invalid("资源编码缺失。"))?
            .to_owned();
        let Some(content) = a["content"].as_str().map(str::to_owned) else {
            let hash = a["resource_hash"]
                .as_str()
                .ok_or_else(|| invalid("资源内容缺失。"))?;
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM resources WHERE hash=? AND encoding=?)",
                params![hash, encoding],
                |r| r.get(0),
            )?;
            if !exists {
                return Err(invalid("备份引用的资源缺失。"));
            }
            return Ok(());
        };
        let hash = fingerprint(&encoding, &content);
        conn.execute(
            "INSERT OR IGNORE INTO resources(hash,encoding,content) VALUES(?,?,?)",
            params![hash, encoding, content],
        )?;
        a.as_object_mut().unwrap().remove("content");
        a["resource_hash"] = json!(hash);
        a["size"] = json!(content.len());
        a["stored_chars"] = json!(content.chars().count());
        Ok(())
    })?;
    Ok(value)
}
pub(crate) fn hydrate_asset(conn: &Connection, mut a: Value) -> Result<Value> {
    if a.get("content").is_none() {
        let hash = a["resource_hash"]
            .as_str()
            .ok_or_else(|| invalid("资源引用缺失。"))?;
        let (encoding, content): (String, String) = conn.query_row(
            "SELECT encoding,content FROM resources WHERE hash=?",
            [hash],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        if a["encoding"] != encoding {
            return Err(invalid("资源编码与内容不一致。"));
        }
        a["content"] = json!(content);
        for key in ["resource_hash", "size", "stored_chars"] {
            a.as_object_mut().unwrap().remove(key);
        }
    }
    Ok(a)
}
pub(crate) fn hydrate_value(conn: &Connection, mut value: Value) -> Result<Value> {
    assets_mut(&mut value, |a| {
        *a = hydrate_asset(conn, std::mem::take(a))?;
        Ok(())
    })?;
    Ok(value)
}
pub(crate) fn encode(conn: &Connection, value: &impl Serialize) -> Result<String> {
    Ok(serde_json::to_string(&pack_value(
        conn,
        serde_json::to_value(value)?,
    )?)?)
}
pub(crate) fn decode<T: DeserializeOwned>(conn: &Connection, raw: &str) -> Result<T> {
    Ok(serde_json::from_value(hydrate_value(
        conn,
        serde_json::from_str(raw)?,
    )?)?)
}
pub(crate) fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch("CREATE TABLE resources(hash TEXT PRIMARY KEY, encoding TEXT NOT NULL, content TEXT NOT NULL);")?;
    for table in ["records", "revisions", "conflicts"] {
        let mut stmt =
            conn.prepare(&format!("SELECT rowid,payload FROM {table} ORDER BY rowid"))?;
        for row in stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))? {
            let (rowid, raw) = row?;
            let packed = pack_value(conn, serde_json::from_str(&raw)?)?;
            conn.execute(
                &format!("UPDATE {table} SET payload=? WHERE rowid=?"),
                params![serde_json::to_string(&packed)?, rowid],
            )?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resources_share_bytes_across_history_and_restore_legacy_backups() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let mut q:SaveRequest=serde_json::from_value(json!({"kind":"skill","title":"resource-example","summary":"参考资料","body":"步骤一","assets":[{"path":"说明.md","encoding":"utf8","content":"中文附件\n逐字保留"},{"path":"binary.bin","encoding":"base64","content":"AAECA/8="}]})).unwrap();
        let first = s.save(q.clone()).unwrap();
        q.id = Some(first.id.clone());
        q.expected_revision = Some(1);
        q.fields.body = "步骤二".into();
        let second = s.save(q).unwrap();
        assert_eq!(
            s.conn
                .query_row("SELECT COUNT(*) FROM resources", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            2
        );
        let raw: String = s
            .conn
            .query_row("SELECT payload FROM records", [], |r| r.get(0))
            .unwrap();
        assert!(!raw.contains("逐字保留"));
        assert!(!raw.contains("AAECA/8="));
        assert_eq!(
            s.asset(AssetRequest {
                id: first.id.clone(),
                path: "binary.bin".into(),
                revision: Some(1)
            })
            .unwrap()
            .content,
            "AAECA/8="
        );
        let restored = s
            .restore(RestoreRequest {
                id: first.id.clone(),
                revision: 1,
                expected_revision: second.revision,
            })
            .unwrap();
        assert_eq!(
            serde_json::to_value(&restored.fields).unwrap(),
            serde_json::to_value(&first.fields).unwrap()
        );
        let backup = s.backup().unwrap();
        let target = tempfile::tempdir().unwrap();
        let mut t = Store::open(target.path()).unwrap();
        t.import(backup).unwrap();
        assert_eq!(
            t.get(&first.id).unwrap().fields.assets[0].content,
            "中文附件\n逐字保留"
        );
        assert_eq!(
            t.conn
                .query_row("SELECT COUNT(*) FROM resources", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            2
        );
    }
    #[test]
    fn version_four_upgrade_snapshots_and_deduplicates_existing_payloads() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let r=s.save(serde_json::from_value(json!({"kind":"skill","title":"old-resource","summary":"旧附件","body":"正文","assets":[{"path":"a.txt","encoding":"utf8","content":"原字节"}]})).unwrap()).unwrap();
        let raw = serde_json::to_string(&r).unwrap();
        s.conn
            .execute("UPDATE records SET payload=?", [&raw])
            .unwrap();
        s.conn
            .execute("UPDATE revisions SET payload=?", [&raw])
            .unwrap();
        s.conn
            .execute_batch("DROP TABLE resources; PRAGMA user_version=4;")
            .unwrap();
        drop(s);
        let s = Store::open(dir.path()).unwrap();
        assert_eq!(s.get(&r.id).unwrap().fields.assets[0].content, "原字节");
        assert_eq!(
            s.conn
                .query_row("SELECT COUNT(*) FROM resources", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
        let old = std::fs::read_dir(dir.path().join("snapshots"))
            .unwrap()
            .map(|e| e.unwrap().path())
            .find(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("upgrade-")
            })
            .unwrap();
        let backup = Connection::open(old).unwrap();
        assert_eq!(
            backup
                .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            4
        );
    }
}
