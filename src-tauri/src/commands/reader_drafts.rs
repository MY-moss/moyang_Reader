//! Recovery snapshots are independent of ordinary files and never write through a stored path.
use super::bookroom::{error, field};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

pub(super) fn request(db: &mut Connection, request: &Value) -> Result<Value, String> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS reader_drafts (key TEXT PRIMARY KEY,path TEXT NOT NULL,draft TEXT NOT NULL,base TEXT NOT NULL,saved INTEGER NOT NULL,bytes INTEGER NOT NULL)").map_err(error)?;
    match field(request, "action")? {
        "draft.list" => {
            let mut s = db
                .prepare(
                    "SELECT path,substr(draft,1,160),saved FROM reader_drafts ORDER BY saved DESC",
                )
                .map_err(error)?;
            let rows=s.query_map([],|r|Ok(json!({"path":r.get::<_,String>(0)?,"preview":r.get::<_,String>(1)?,"savedAt":r.get::<_,i64>(2)?}))).map_err(error)?;
            Ok(json!(rows.collect::<Result<Vec<_>, _>>().map_err(error)?))
        }
        "draft.get" => {
            let result=db.query_row("SELECT path,draft,base,saved FROM reader_drafts WHERE key=?1",[field(request,"key")?],|r|Ok(json!({"path":r.get::<_,String>(0)?,"draft":r.get::<_,String>(1)?,"baseSource":r.get::<_,String>(2)?,"savedAt":r.get::<_,i64>(3)?}))).optional().map_err(error)?;
            Ok(result.unwrap_or(Value::Null))
        }
        "draft.put" | "draft.import" => {
            let item = &request["snapshot"];
            let path = field(item, "path")?;
            let draft = field(item, "draft")?;
            let base = field(item, "baseSource")?;
            let saved = item["savedAt"]
                .as_i64()
                .filter(|n| *n > 0)
                .ok_or("无效草稿时间")?;
            let key = field(request, "key")?;
            let draft_len = draft.encode_utf16().count();
            let base_len = base.encode_utf16().count();
            if path.trim().is_empty() || draft_len > 8_000_000 || base_len > 8_000_000 {
                return Err("草稿超过单篇容量（800 万字符）".into());
            }
            let bytes = ((draft_len + base_len) * 2) as i64;
            let tx = db
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .map_err(error)?;
            let exists: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM reader_drafts WHERE key=?1)",
                    [&key],
                    |r| r.get(0),
                )
                .map_err(error)?;
            if request["action"] == "draft.import" && exists {
                return Ok(Value::Null);
            }
            let total: i64 = tx
                .query_row(
                    "SELECT COALESCE(SUM(bytes),0) FROM reader_drafts WHERE key<>?1",
                    [&key],
                    |r| r.get(0),
                )
                .map_err(error)?;
            if total + bytes > 256 * 1024 * 1024 {
                return Err("草稿空间已达 256 MiB，请先保存或处理已有草稿".into());
            }
            tx.execute("INSERT OR REPLACE INTO reader_drafts(key,path,draft,base,saved,bytes) VALUES(?1,?2,?3,?4,?5,?6)",params![key,path,draft,base,saved,bytes]).map_err(error)?;
            tx.commit().map_err(error)?;
            Ok(Value::Null)
        }
        "draft.delete" => {
            let key = field(request, "key")?;
            if let Some(expected) = request["expectedDraft"].as_str() {
                db.execute(
                    "DELETE FROM reader_drafts WHERE key=?1 AND draft=?2",
                    params![key, expected],
                )
                .map_err(error)?;
            } else {
                db.execute("DELETE FROM reader_drafts WHERE key=?1", [key])
                    .map_err(error)?;
            }
            Ok(Value::Null)
        }
        "draft.clear" => {
            db.execute("DELETE FROM reader_drafts", []).map_err(error)?;
            Ok(Value::Null)
        }
        _ => Err("未知草稿操作".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restores_independent_drafts_after_reopening() {
        let dir = std::env::temp_dir().join(format!(
            "moyang-drafts-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("reader.sqlite");
        let mut db = Connection::open(&path).unwrap();
        for i in 0..3 {
            request(&mut db,&json!({"action":"draft.put","key":format!("draft-{i}"),"snapshot":{"path":format!("C:/notes/{i}.txt"),"draft":"稿".repeat(200),"baseSource":"文".repeat(200),"savedAt":i+1}})).unwrap();
        }
        drop(db);
        let mut db = Connection::open(path).unwrap();
        let list = request(&mut db, &json!({"action":"draft.list"})).unwrap();
        assert_eq!(list.as_array().unwrap().len(), 3);
        assert!(list.to_string().len() < 15_000);
        let key = "draft-0";
        let item = request(&mut db, &json!({"action":"draft.get","key":key})).unwrap();
        assert_eq!(item["draft"].as_str().unwrap().chars().count(), 200);
        assert_eq!(item["baseSource"].as_str().unwrap().chars().count(), 200);
        request(
            &mut db,
            &json!({"action":"draft.delete","key":key,"expectedDraft":"stale"}),
        )
        .unwrap();
        assert_eq!(
            request(&mut db, &json!({"action":"draft.get","key":key})).unwrap(),
            item
        );
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
