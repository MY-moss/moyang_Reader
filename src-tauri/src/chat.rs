//! Optional chat extension. Shared API credentials and chat history remain outside the memory database.
use rusqlite::{params, OptionalExtension};
use moyang_ai_core::services::{Provider, database, endpoint, load_provider};
use serde_json::{json, Value};
use std::{collections::HashMap, path::Path, sync::Mutex, time::Duration};
use tauri::{ipc::Channel, State};

#[derive(Default)]
pub struct ChatRequests(Mutex<HashMap<String, Option<tokio::sync::oneshot::Sender<()>>>>);
impl ChatRequests {
    fn register(&self, id: &str) -> Result<tokio::sync::oneshot::Receiver<()>, String> {
        let mut requests = self.0.lock().map_err(|_| "聊天请求状态不可用。")?;
        if let Some(previous) = requests.get(id) {
            if previous.is_some() {
                return Err("该请求仍在进行。".into());
            }
            requests.remove(id);
            return Err("已停止生成。".into());
        }
        let (send, receive) = tokio::sync::oneshot::channel();
        requests.insert(id.to_string(), Some(send));
        Ok(receive)
    }
    fn cancel(&self, id: String) -> Result<(), String> {
        let mut requests = self.0.lock().map_err(|_| "聊天请求状态不可用。")?;
        if let Some(Some(cancel)) = requests.remove(&id) {
            let _ = cancel.send(());
        } else {
            if requests.len() > 128 {
                requests.retain(|_, value| value.is_some());
            }
            requests.insert(id, None);
        }
        Ok(())
    }
}

fn store_request(path: &Path, operation: &str, payload: Value) -> Result<Value, String> {
    if matches!(operation, "providers" | "save_provider" | "delete_provider") { return moyang_ai_core::services::provider_request(path,operation,payload); }
    let mut db = database(path)?;
    let id = payload["id"].as_str().unwrap_or("");
    match operation {
        "threads" => {
            let mut stmt = db
                .prepare("SELECT json_remove(data,'$.messages') FROM threads ORDER BY updated DESC")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(|e| e.to_string())?;
            rows.map(|r| {
                serde_json::from_str(&r.map_err(|e| e.to_string())?).map_err(|e| e.to_string())
            })
            .collect::<Result<Vec<Value>, String>>()
            .map(Value::Array)
        }
        "thread" => {
            let raw: Option<String> = db
                .query_row("SELECT data FROM threads WHERE id=?", [id], |r| r.get(0))
                .optional()
                .map_err(|e| e.to_string())?;
            raw.map(|r| serde_json::from_str(&r).map_err(|e| e.to_string()))
                .unwrap_or(Ok(Value::Null))
        }
        "save_thread" => {
            if id.is_empty() || !payload["messages"].is_array() {
                return Err("会话内容无效。".into());
            }
            let expected = payload["revision"].as_i64().unwrap_or(0);
            let tx = db.transaction().map_err(|e| e.to_string())?;
            let old: Option<i64> = tx
                .query_row("SELECT revision FROM threads WHERE id=?", [id], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(|e| e.to_string())?;
            if old.unwrap_or(0) != expected {
                return Err("此会话已被另一窗口修改，请导出当前内容后重新打开。".into());
            }
            let mut next = payload.clone();
            next["revision"] = json!(expected + 1);
            let raw = serde_json::to_string(&next).map_err(|e| e.to_string())?;
            tx.execute("INSERT INTO threads(id,data,revision,updated) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated=excluded.updated", params![id,raw,expected+1,payload["updatedAt"].as_i64().unwrap_or(0)]).map_err(|e| e.to_string())?;
            tx.commit().map_err(|e| e.to_string())?;
            Ok(next)
        }
        "delete_thread" => {
            db.execute("DELETE FROM threads WHERE id=?", [id])
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        _ => Err("未知聊天操作。".into()),
    }
}

#[tauri::command]
pub async fn chat_request(
    app: tauri::AppHandle,
    operation: String,
    payload: Value,
) -> Result<Value, String> {
    let path = crate::data_paths::config_directory(&app)?.join("chat");
    tauri::async_runtime::spawn_blocking(move || store_request(&path, &operation, payload))
        .await
        .map_err(|e| e.to_string())?
}

fn authenticated(
    client: &reqwest::Client,
    provider: &Provider,
    key: &str,
    models: bool,
) -> Result<reqwest::RequestBuilder, String> {
    let url = endpoint(provider, models)?;
    let mut request = if models {
        client.get(url)
    } else {
        client.post(url)
    };
    if provider.protocol == "anthropic" {
        request = request.header("anthropic-version", "2023-06-01");
        if !key.is_empty() {
            request = request.header("x-api-key", key);
        }
    } else if !key.is_empty() {
        request = request.bearer_auth(key);
    }
    Ok(request)
}

async fn response_error(response: reqwest::Response, key: &str) -> String {
    let status = response.status();
    let explanation = match status.as_u16() {
        401 | 403 => "请检查密钥和服务权限",
        404 => "请检查 API 基础地址和模型名称",
        429 => "请求过多或额度不足，请稍后重试",
        _ => "服务未能完成请求",
    };
    let mut detail = response
        .text()
        .await
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v["error"]["message"].as_str().map(str::to_string))
        .unwrap_or_default();
    if !key.is_empty() {
        detail = detail.replace(key, "[已隐藏密钥]");
    }
    format!(
        "{explanation}（{}）。{}",
        status.as_u16(),
        detail.chars().take(240).collect::<String>()
    )
}

#[tauri::command]
pub async fn chat_models(
    app: tauri::AppHandle,
    provider_id: String,
) -> Result<Vec<String>, String> {
    let db = database(&crate::data_paths::config_directory(&app)?.join("chat"))?;
    let (provider, key) = load_provider(&db, &provider_id)?;
    drop(db);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let response = authenticated(&client, &provider, &key, true)?
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if !response.status().is_success() {
        return Err(response_error(response, &key).await);
    }
    let value: Value = response
        .json()
        .await
        .map_err(|_| "服务没有返回有效模型列表。")?;
    Ok(value["data"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|v| v["id"].as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default())
}

#[tauri::command]
pub async fn chat_stream(
    app: tauri::AppHandle,
    state: State<'_, ChatRequests>,
    request_id: String,
    provider_id: String,
    body: Value,
    channel: Channel<Vec<u8>>,
) -> Result<(), String> {
    let (provider, key) = load_provider(
        &database(&crate::data_paths::config_directory(&app)?.join("chat"))?,
        &provider_id,
    )?;
    if body["model"].as_str().unwrap_or("").is_empty() || !body["messages"].is_array() {
        return Err("请选择模型并填写消息。".into());
    }
    let mut cancelled = state.register(&request_id)?;
    let task = async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|e| e.to_string())?;
        let mut response = authenticated(&client, &provider, &key, false)?
            .json(&body)
            .send()
            .await
            .map_err(|e| e.without_url().to_string())?;
        if !response.status().is_success() {
            return Err(response_error(response, &key).await);
        }
        let mut received = 0;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| e.without_url().to_string())?
        {
            received += chunk.len();
            if received > 16 * 1024 * 1024 {
                return Err("回答过长，已停止接收并保留已有内容。".into());
            }
            channel
                .send(chunk.to_vec())
                .map_err(|_| "聊天窗口已关闭。")?;
        }
        Ok(())
    };
    let result = tokio::select! { result = task => result, _ = &mut cancelled => Err("已停止生成。".into()) };
    state
        .0
        .lock()
        .map_err(|_| "聊天请求状态不可用。")?
        .remove(&request_id);
    result
}

#[tauri::command]
pub fn chat_cancel(state: State<'_, ChatRequests>, request_id: String) -> Result<(), String> {
    state.cancel(request_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fresh_database_supports_parallel_initial_loads() {
        let root = std::env::temp_dir().join(format!(
            "moyang-chat-start-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut failures = Vec::new();
        for attempt in 0..8 {
            let path = root.join(attempt.to_string());
            let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
            let workers: Vec<_> = (0..8)
                .map(|index| {
                    let path = path.clone();
                    let barrier = barrier.clone();
                    std::thread::spawn(move || {
                        barrier.wait();
                        store_request(
                            &path,
                            if index % 2 == 0 {
                                "providers"
                            } else {
                                "threads"
                            },
                            json!({}),
                        )
                    })
                })
                .collect();
            for worker in workers {
                if let Err(error) = worker.join().unwrap() {
                    failures.push(error);
                }
            }
        }
        std::fs::remove_dir_all(root).unwrap();
        assert!(
            failures.is_empty(),
            "Parallel first load failed: {failures:?}"
        );
    }
    #[test]
    fn stop_before_registration_does_not_start_a_paid_request() {
        let requests = ChatRequests::default();
        requests.cancel("early".into()).unwrap();
        assert!(requests.register("early").is_err());
        let mut receive = requests.register("active").unwrap();
        requests.cancel("active".into()).unwrap();
        assert_eq!(receive.try_recv(), Ok(()));
    }
    #[test]
    fn credentials_are_private_preserved_and_explicitly_clearable() {
        let root = std::env::temp_dir().join(format!(
            "moyang-chat-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut p = json!({"id":"mine","name":"本地服务","protocol":"openai","baseUrl":"http://127.0.0.1:11434","model":"custom","apiKey":"private-test-key"});
        assert!(store_request(&root, "save_provider", p.clone()).unwrap()["hasKey"] == true);
        p["apiKey"] = json!("");
        store_request(&root, "save_provider", p.clone()).unwrap();
        let public = store_request(&root, "providers", json!({})).unwrap();
        assert!(!public.to_string().contains("private-test-key"));
        assert_eq!(
            load_provider(&database(&root).unwrap(), "mine").unwrap().1,
            "private-test-key"
        );
        p["clearKey"] = json!(true);
        store_request(&root, "save_provider", p).unwrap();
        assert_eq!(
            load_provider(&database(&root).unwrap(), "mine").unwrap().1,
            ""
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn conversation_conflicts_preserve_saved_history() {
        let root = std::env::temp_dir().join(format!(
            "moyang-chat-thread-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let thread = json!({"id":"one","title":"讨论","revision":0,"updatedAt":12,"messages":[{"role":"user","content":"内容"}]});
        let saved = store_request(&root, "save_thread", thread.clone()).unwrap();
        assert_eq!(saved["revision"], 1);
        assert!(store_request(&root, "save_thread", thread).is_err());
        assert!(store_request(&root, "threads", json!({})).unwrap()[0]
            .get("messages")
            .is_none());
        assert_eq!(
            store_request(&root, "thread", json!({"id":"one"})).unwrap(),
            saved
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}
