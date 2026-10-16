//! Reader metadata lives separately from Agent knowledge. Documents remain ordinary files.
use super::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

fn error(e: impl std::fmt::Display) -> String {
    format!("阅读数据操作失败：{e}")
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
fn connection(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(error)?;
    }
    let db = Connection::open(path).map_err(error)?;
    db.busy_timeout(Duration::from_secs(5)).map_err(error)?;
    db.execute_batch("PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS metadata (category TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(category,id));
      CREATE TABLE IF NOT EXISTS versions (id INTEGER PRIMARY KEY,path TEXT NOT NULL,created INTEGER NOT NULL,contents TEXT NOT NULL,initial INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS versions_path ON versions(path,created);
      CREATE TABLE IF NOT EXISTS documents (path TEXT PRIMARY KEY,root TEXT NOT NULL,stamp TEXT NOT NULL,hash TEXT NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY,path TEXT NOT NULL,ordinal INTEGER NOT NULL,body TEXT NOT NULL,location TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS chunks_path ON chunks(path);
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(tokens,content='');").map_err(error)?;
    let has_tags: bool = db
        .prepare("PRAGMA table_info(documents)")
        .map_err(error)?
        .query_map([], |r| r.get::<_, String>(1))
        .map_err(error)?
        .any(|r| r.is_ok_and(|name| name == "tags"));
    if !has_tags {
        db.execute(
            "ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
            [],
        )
        .map_err(error)?;
    }
    Ok(db)
}
pub(super) fn database(app: &AppHandle) -> Result<Connection, String> {
    connection(
        &crate::data_paths::data_directory(app)
            .map_err(error)?
            .join("reader.sqlite"),
    )
}
#[cfg(test)]
fn record_versions_in(
    db: &mut Connection,
    path: &str,
    before: Option<&str>,
    after: &str,
    time: i64,
) -> Result<(), String> {
    let tx = db.transaction().map_err(error)?;
    version_rows(&tx, path, before, after, time)?;
    tx.commit().map_err(error)
}
fn version_rows(
    tx: &Connection,
    path: &str,
    before: Option<&str>,
    after: &str,
    time: i64,
) -> Result<(), String> {
    let last: Option<(i64, i64, String, bool)> = tx.query_row("SELECT id,created,contents,initial FROM versions WHERE path=?1 ORDER BY id DESC LIMIT 1", [path], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))).optional().map_err(error)?;
    if let Some((_, _, ref contents, _)) = last {
        if contents == after {
            return Ok(());
        }
    }
    if last.is_none() {
        if let Some(before) = before {
            tx.execute(
                "INSERT INTO versions(path,created,contents,initial) VALUES(?1,?2,?3,1)",
                params![path, time - 1, before],
            )
            .map_err(error)?;
        }
    }
    if let Some((id, created, _, false)) =
        last.filter(|(_, created, _, initial)| !initial && time - created < 60_000)
    {
        tx.execute(
            "UPDATE versions SET contents=?1 WHERE id=?2",
            params![after, id],
        )
        .map_err(error)?;
        let _ = created;
    } else {
        tx.execute(
            "INSERT INTO versions(path,created,contents) VALUES(?1,?2,?3)",
            params![path, time, after],
        )
        .map_err(error)?;
    }
    tx.execute("DELETE FROM versions WHERE path=?1 AND id NOT IN (SELECT id FROM versions WHERE path=?1 ORDER BY id DESC LIMIT 50)", [path]).map_err(error)?;
    Ok(())
}
pub(super) fn write_with_history(
    app: &AppHandle,
    path: &Path,
    before: Option<&str>,
    after: &str,
) -> Result<Option<String>, String> {
    let mut db = database(app)?;
    write_with_history_in(&mut db, path, before, after)
}
fn write_with_history_in(
    db: &mut Connection,
    path: &Path,
    before: Option<&str>,
    after: &str,
) -> Result<Option<String>, String> {
    let tx = db.transaction().map_err(error)?;
    version_rows(&tx, &display_path(path), before, after, now())?;
    // A failed file write rolls back the pending history rows.
    files::write_text_file_inner(path.to_path_buf(), after.to_owned())?;
    Ok(tx
        .commit()
        .err()
        .map(|e| format!("内容已保存，但历史版本未能写入：{e}")))
}
fn field<'a>(request: &'a Value, key: &str) -> Result<&'a str, String> {
    request[key]
        .as_str()
        .ok_or_else(|| format!("缺少参数：{key}"))
}
fn rows(db: &Connection, sql: &str, args: &[&dyn rusqlite::ToSql]) -> Result<Vec<Value>, String> {
    let mut statement = db.prepare(sql).map_err(error)?;
    let items = statement
        .query_map(args, |row| row.get::<_, String>(0))
        .map_err(error)?;
    items
        .map(|r| serde_json::from_str(&r.map_err(error)?).map_err(error))
        .collect()
}
fn tokens(text: &str) -> String {
    let mut words: Vec<String> = text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(str::to_lowercase)
        .collect();
    let chars: Vec<char> = text.chars().collect();
    for c in &chars {
        if *c >= '\u{2e80}' {
            words.push(c.to_string());
        }
    }
    for pair in chars.windows(2) {
        if pair.iter().all(|c| *c >= '\u{2e80}') {
            words.push(pair.iter().collect());
        }
    }
    words.join(" ")
}
fn query_terms(text: &str) -> String {
    let mut terms = Vec::new();
    for word in text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
    {
        let chars: Vec<char> = word.chars().collect();
        if chars.len() > 1 && chars.iter().all(|c| *c >= '\u{2e80}') {
            terms.extend(chars.windows(2).map(|pair| pair.iter().collect::<String>()));
        } else {
            terms.push(word.to_lowercase());
        }
    }
    terms
        .into_iter()
        .take(64)
        .map(|s| format!("\"{}\"", s.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" AND ")
}

#[tauri::command]
pub fn bookroom_request(
    app: AppHandle,
    access: State<'_, AccessRegistry>,
    request: Value,
) -> Result<Value, String> {
    let action = field(&request, "action")?;
    let mut db = database(&app)?;
    match action {
        "paths.rebase" => {
            let root = field(&request, "root")?;
            let from = field(&request, "from")?;
            let to = field(&request, "to")?;
            if !access.is_write_allowed(Path::new(root))
                || !Path::new(from).starts_with(Path::new(root))
                || !Path::new(to).starts_with(Path::new(root))
            {
                return Err("重命名记录必须位于已授权阅读库内".into());
            }
            let rebase = |value: &str| -> String {
                Path::new(value)
                    .strip_prefix(from)
                    .map(|suffix| display_path(&Path::new(to).join(suffix)))
                    .unwrap_or_else(|_| value.into())
            };
            let tx = db.transaction().map_err(error)?;
            let values: Vec<(String, String, String)> = {
                let mut s = tx
                    .prepare("SELECT category,id,payload FROM metadata")
                    .map_err(error)?;
                let rows = s
                    .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                    .map_err(error)?;
                rows.collect::<Result<_, _>>().map_err(error)?
            };
            for (category, id, payload) in values {
                let mut item: Value = serde_json::from_str(&payload).map_err(error)?;
                if let Some(path) = item["location"]["path"].as_str() {
                    item["location"]["path"] = json!(rebase(path));
                    tx.execute(
                        "UPDATE metadata SET payload=?1 WHERE category=?2 AND id=?3",
                        params![item.to_string(), category, id],
                    )
                    .map_err(error)?;
                }
            }
            let paths: Vec<String> = {
                let mut s = tx
                    .prepare("SELECT DISTINCT path FROM versions")
                    .map_err(error)?;
                let rows = s.query_map([], |r| r.get(0)).map_err(error)?;
                rows.collect::<Result<_, _>>().map_err(error)?
            };
            for path in paths {
                let next = rebase(&path);
                if next != path {
                    tx.execute(
                        "UPDATE versions SET path=?1 WHERE path=?2",
                        params![next, path],
                    )
                    .map_err(error)?;
                }
            }
            tx.commit().map_err(error)?;
            Ok(Value::Null)
        }
        "trash.list" => {
            let root = field(&request, "root")?;
            if !access.is_read_allowed(Path::new(root)) {
                return Err("请先授权阅读库".into());
            }
            Ok(json!(recycle::list(root)?))
        }
        "trash.restore" => {
            let root = field(&request, "root")?;
            if !access.is_write_allowed(Path::new(root)) {
                return Err("请先授权阅读库".into());
            }
            Ok(json!(recycle::restore(root, field(&request, "id")?)?))
        }
        "trash.preview" => {
            let root = field(&request, "root")?;
            if !access.is_read_allowed(Path::new(root)) {
                return Err("请先授权阅读库".into());
            }
            recycle::preview(root, field(&request, "id")?)
        }
        "metadata.list" => Ok(json!(rows(
            &db,
            "SELECT payload FROM metadata WHERE category=?1 ORDER BY updated DESC",
            &[&field(&request, "category")?]
        )?)),
        "metadata.put" => {
            let category = field(&request, "category")?;
            if !["bookmark", "annotation", "view"].contains(&category) {
                return Err("未知阅读数据类型".into());
            }
            let item = &request["item"];
            db.execute("INSERT INTO metadata VALUES(?1,?2,?3,?4) ON CONFLICT(category,id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated", params![category, field(item,"id")?, item.to_string(), now()]).map_err(error)?;
            Ok(item.clone())
        }
        "metadata.delete" => {
            db.execute(
                "DELETE FROM metadata WHERE category=?1 AND id=?2",
                params![field(&request, "category")?, field(&request, "id")?],
            )
            .map_err(error)?;
            Ok(Value::Null)
        }
        "history.list" => {
            let path = field(&request, "path")?;
            if !access.is_read_allowed(Path::new(path)) {
                return Err("请先打开或授权此文档".into());
            }
            let mut statement = db.prepare("SELECT id,created,length(contents),substr(contents,1,180) FROM versions WHERE path=?1 ORDER BY id DESC LIMIT 50").map_err(error)?;
            let items = statement.query_map([path], |r| Ok(json!({"id":r.get::<_,i64>(0)?,"created":r.get::<_,i64>(1)?,"size":r.get::<_,i64>(2)?,"preview":r.get::<_,String>(3)?}))).map_err(error)?;
            Ok(json!(items
                .collect::<Result<Vec<_>, _>>()
                .map_err(error)?))
        }
        "history.get" => {
            let path = field(&request, "path")?;
            if !access.is_read_allowed(Path::new(path)) {
                return Err("请先打开或授权此文档".into());
            }
            let contents: String = db
                .query_row(
                    "SELECT contents FROM versions WHERE path=?1 AND id=?2",
                    params![path, request["id"].as_i64().ok_or("缺少版本 ID")?],
                    |r| r.get(0),
                )
                .map_err(error)?;
            Ok(json!(contents))
        }
        "index.manifest" => {
            let root = field(&request, "root")?;
            if !access.is_read_allowed(Path::new(root)) {
                return Err("请先授权阅读库".into());
            }
            let mut statement = db
                .prepare("SELECT path,stamp,tags FROM documents WHERE root=?1")
                .map_err(error)?;
            let items = statement.query_map([root], |r| Ok(json!({"path":r.get::<_,String>(0)?,"stamp":r.get::<_,String>(1)?,"tags":r.get::<_,String>(2)?}))).map_err(error)?;
            Ok(json!(items
                .collect::<Result<Vec<_>, _>>()
                .map_err(error)?))
        }
        "index.attributes" => {
            let path = field(&request, "path")?;
            if !access.is_read_allowed(Path::new(path)) {
                return Err("请先授权文档".into());
            }
            db.execute(
                "UPDATE documents SET tags=?1 WHERE path=?2",
                params![request["tags"].to_string(), path],
            )
            .map_err(error)?;
            Ok(Value::Null)
        }
        "index.replace" => {
            let path = field(&request, "path")?;
            let root = field(&request, "root")?;
            if !access.is_read_allowed(Path::new(path))
                || !access::access_path_contains(
                    &access::normalize_access_path(Path::new(root))?,
                    &access::normalize_access_path(Path::new(path))?,
                )
            {
                return Err("无法索引未授权的阅读库文档".into());
            }
            let tx = db.transaction().map_err(error)?;
            // Contentless FTS requires the old token stream when deleting.
            let old: Vec<(i64, String)> = {
                let mut s = tx
                    .prepare("SELECT id,body FROM chunks WHERE path=?1")
                    .map_err(error)?;
                let r = s
                    .query_map([path], |r| Ok((r.get(0)?, r.get(1)?)))
                    .map_err(error)?;
                r.collect::<Result<_, _>>().map_err(error)?
            };
            for (id, body) in old {
                tx.execute(
                    "INSERT INTO chunks_fts(chunks_fts,rowid,tokens) VALUES('delete',?1,?2)",
                    params![id, tokens(&body)],
                )
                .map_err(error)?;
            }
            tx.execute("DELETE FROM chunks WHERE path=?1", [path])
                .map_err(error)?;
            tx.execute("INSERT OR REPLACE INTO documents(path,root,stamp,hash,title,kind,tags) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![path,root,field(&request,"stamp")?,field(&request,"hash")?,field(&request,"title")?,field(&request,"kind")?,request["tags"].to_string()]).map_err(error)?;
            for (index, chunk) in request["chunks"]
                .as_array()
                .ok_or("缺少正文片段")?
                .iter()
                .enumerate()
            {
                let body = field(chunk, "text")?;
                tx.execute(
                    "INSERT INTO chunks(path,ordinal,body,location) VALUES(?1,?2,?3,?4)",
                    params![path, index as i64, body, chunk["location"].to_string()],
                )
                .map_err(error)?;
                tx.execute(
                    "INSERT INTO chunks_fts(rowid,tokens) VALUES(?1,?2)",
                    params![tx.last_insert_rowid(), tokens(body)],
                )
                .map_err(error)?;
            }
            tx.commit().map_err(error)?;
            Ok(Value::Null)
        }
        "search" => {
            let root = field(&request, "root")?;
            if !access.is_read_allowed(Path::new(root)) {
                return Err("请先授权阅读库".into());
            }
            let query = field(&request, "query")?.trim();
            let terms = query_terms(query);
            if !query.is_empty() && terms.is_empty() {
                return Ok(json!({"items":[],"total":0}));
            }
            let sql = if query.is_empty() {
                "SELECT d.path,d.title,d.kind,c.body,c.location,d.tags FROM documents d JOIN chunks c ON c.path=d.path WHERE d.root=?2 AND ?1='' AND ?3='' ORDER BY d.title,c.ordinal"
            } else {
                "SELECT d.path,d.title,d.kind,c.body,c.location,d.tags FROM chunks_fts JOIN chunks c ON c.id=chunks_fts.rowid JOIN documents d ON d.path=c.path WHERE chunks_fts MATCH ?1 AND d.root=?2 ORDER BY (instr(lower(c.body),lower(?3))>0) DESC,bm25(chunks_fts)"
            };
            let mut stmt = db.prepare(sql).map_err(error)?;
            let found = stmt
                .query_map(params![terms, root, query], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                        r.get::<_, String>(5)?,
                    ))
                })
                .map_err(error)?;
            let mut hits: Vec<Value> = Vec::new();
            let mut positions: HashMap<String, usize> = HashMap::new();
            for item in found {
                let (path, title, kind, body, location, tags) = item.map_err(error)?;
                if let Some(filter) = request["kind"].as_str().filter(|k| *k != "all") {
                    if filter != kind {
                        continue;
                    }
                }
                if let Some(tag) = request["tag"].as_str() {
                    if !serde_json::from_str::<Vec<String>>(&tags)
                        .unwrap_or_default()
                        .iter()
                        .any(|t| t == tag)
                    {
                        continue;
                    }
                }
                if !Path::new(&path).is_file() || !access.is_read_allowed(Path::new(&path)) {
                    continue;
                }
                let hit = json!({"text":body,"location":serde_json::from_str::<Value>(&location).map_err(error)?});
                if let Some(index) = positions.get(&path) {
                    let fragments = hits[*index]["hits"].as_array_mut().unwrap();
                    if fragments.len() < 4 {
                        fragments.push(hit);
                    }
                } else {
                    positions.insert(path.clone(), hits.len());
                    hits.push(json!({"path":path,"title":title,"kind":kind,"hits":[hit]}));
                }
            }
            if request["sort"].as_str() == Some("name") {
                hits.sort_by(|a, b| a["title"].as_str().cmp(&b["title"].as_str()));
            }
            let total = hits.len();
            let offset = request["offset"].as_u64().unwrap_or(0) as usize;
            Ok(
                json!({"total":total,"items":hits.into_iter().skip(offset).take(20).collect::<Vec<_>>()}),
            )
        }
        _ => Err("未知阅读操作".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn chinese_query_requires_all_terms_instead_of_a_single_shared_character() {
        let db = connection(Path::new(":memory:")).unwrap();
        for body in [
            "森林记录",
            "检索针叶林，第一段是气候资料",
            "检索针叶林，第二段是土壤证据",
        ] {
            db.execute("INSERT INTO chunks_fts(tokens) VALUES(?1)", [tokens(body)])
                .unwrap();
        }
        let count: i64 = db
            .query_row(
                "SELECT count(*) FROM chunks_fts WHERE chunks_fts MATCH ?1",
                [query_terms("检索针叶林")],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }
    #[test]
    fn keeps_initial_and_coalesces_autosaves_without_losing_history() {
        let mut db = connection(Path::new(":memory:")).unwrap();
        record_versions_in(&mut db, "note.md", Some("original"), "first", 100_000).unwrap();
        record_versions_in(&mut db, "note.md", Some("first"), "second", 110_000).unwrap();
        record_versions_in(&mut db, "note.md", Some("second"), "third", 170_001).unwrap();
        let mut stmt = db
            .prepare("SELECT contents FROM versions ORDER BY id")
            .unwrap();
        let values = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(values, vec!["original", "second", "third"]);
    }
    #[test]
    fn failed_file_write_does_not_create_a_phantom_history_version() {
        let mut db = connection(Path::new(":memory:")).unwrap();
        let root = std::env::temp_dir().join(format!(
            "moyang-history-failed-{}-{}",
            std::process::id(),
            now()
        ));
        fs::create_dir_all(&root).unwrap();
        let blocked = root.join("blocked.md");
        fs::create_dir(&blocked).unwrap();
        assert!(write_with_history_in(&mut db, &blocked, Some("before"), "after").is_err());
        let count: i64 = db
            .query_row("SELECT count(*) FROM versions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
        assert!(blocked.is_dir());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn chinese_tokens_support_partial_phrase_recall() {
        let db = connection(Path::new(":memory:")).unwrap();
        db.execute(
            "INSERT INTO chunks_fts(tokens) VALUES(?1)",
            [tokens("我的长期记忆和技能库")],
        )
        .unwrap();
        let count: i64 = db
            .query_row(
                "SELECT count(*) FROM chunks_fts WHERE chunks_fts MATCH '记忆'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
