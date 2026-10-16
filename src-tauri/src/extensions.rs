//! Local extension state and downloads; no access to the reader's document roots.
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{io::Read, path::Path, time::Duration};

fn database(path: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    let db = Connection::open(path.join("extensions.sqlite")).map_err(|e| e.to_string())?;
    db.busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS extension_state(id INTEGER PRIMARY KEY, contents TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS extension_connections(id TEXT NOT NULL, client TEXT NOT NULL, config TEXT NOT NULL, PRIMARY KEY(id,client));").map_err(|e| e.to_string())?;
    Ok(db)
}
fn load(db: &Connection) -> Result<Value, String> {
    let content: Option<String> = db
        .query_row("SELECT contents FROM extension_state WHERE id=1", [], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    content
        .map(|c| serde_json::from_str(&c).map_err(|e| format!("扩展状态无法读取：{e}")))
        .unwrap_or_else(|| Ok(json!({"revision":0,"installed":[],"catalogs":[]})))
}
fn save(db: &mut Connection, mut state: Value) -> Result<Value, String> {
    let revision = state["revision"].as_u64().ok_or("扩展状态缺少版本。")?;
    if !state["installed"].is_array()
        || !state["catalogs"].is_array()
        || state.to_string().len() > 64 * 1024 * 1024
    {
        return Err("扩展状态格式或大小无效。".into());
    }
    let tx = db
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let before = load(&tx)?;
    if before["revision"].as_u64() != Some(revision) {
        return Err("扩展状态已在其他窗口更新，请重新加载后重试。".into());
    }
    state["revision"] = json!(revision + 1);
    tx.execute("INSERT INTO extension_state(id,contents) VALUES(2,?1) ON CONFLICT(id) DO UPDATE SET contents=excluded.contents", [before.to_string()]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO extension_state(id,contents) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET contents=excluded.contents", [state.to_string()]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(state)
}
fn download(url: &str) -> Result<Value, String> {
    let url = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    if !["http", "https"].contains(&url.scheme()) {
        return Err("目录地址必须是 HTTP 或 HTTPS。".into());
    }
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?
        .get(url)
        .header(
            "User-Agent",
            concat!("Moyang-Reader/", env!("CARGO_PKG_VERSION"), " extensions"),
        )
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("目录下载失败：{e}"))?;
    let mut contents = Vec::new();
    response
        .take(16 * 1024 * 1024 + 1)
        .read_to_end(&mut contents)
        .map_err(|e| e.to_string())?;
    if contents.len() > 16 * 1024 * 1024 {
        return Err("目录超过 16 MB。".into());
    }
    serde_json::from_slice(&contents).map_err(|e| format!("地址没有返回有效 JSON：{e}"))
}
#[tauri::command]
pub async fn extension_request(
    app: tauri::AppHandle,
    operation: String,
    payload: Value,
) -> Result<Value, String> {
    let directory = crate::data_paths::config_directory(&app)?.join("extensions");
    tauri::async_runtime::spawn_blocking(move || {
        if operation == "fetch" { return download(payload["url"].as_str().unwrap_or("")); }
        let mut db = database(&directory)?;
        match operation.as_str() {
            "load" => load(&db),
            "save" => save(&mut db, payload),
            "mcp" => {
                let id = payload["id"].as_str().ok_or("缺少扩展 ID。")?;
                let client = payload["client"].as_str().ok_or("缺少客户端。")?;
                let action = payload["action"].as_str().unwrap_or("preview");
                let owned: Option<String> = db.query_row("SELECT config FROM extension_connections WHERE id=?1 AND client=?2", params![id,client], |r| r.get(0)).optional().map_err(|e| e.to_string())?;
                let owned = owned.map(|c| serde_json::from_str::<Value>(&c)).transpose().map_err(|e| e.to_string())?;
                let result = moyang_ai_core::configure_external_client(&moyang_ai_core::ClientPaths::user().map_err(|e| e.to_string())?, client, id, &payload["config"], owned.as_ref(), action).map_err(|e| e.to_string())?;
                if action == "install" {
                    db.execute("INSERT INTO extension_connections(id,client,config) VALUES(?1,?2,?3) ON CONFLICT(id,client) DO UPDATE SET config=excluded.config", params![id,client,payload["config"].to_string()]).map_err(|e| e.to_string())?;
                } else if action == "remove" {
                    db.execute("DELETE FROM extension_connections WHERE id=?1 AND client=?2", params![id,client]).map_err(|e| e.to_string())?;
                }
                Ok(result)
            }
            _ => Err("未知扩展操作。".into()),
        }
    }).await.map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn state_persists_and_rejects_stale_updates() {
        let root =
            std::env::temp_dir().join(format!("moyang-extension-test-{}", std::process::id()));
        let mut db = database(&root).unwrap();
        let initial = load(&db).unwrap();
        let saved = save(&mut db, initial.clone()).unwrap();
        assert!(save(&mut db, initial).is_err());
        assert_eq!(load(&db).unwrap(), saved);
        drop(db);
        assert_eq!(load(&database(&root).unwrap()).unwrap(), saved);
        std::fs::remove_dir_all(root).unwrap();
    }
}
