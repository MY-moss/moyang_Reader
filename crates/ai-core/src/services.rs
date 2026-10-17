//! Shared API profiles; credentials stay outside ordinary knowledge backups.
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub models: Vec<String>,
    #[serde(default)]
    pub favorites: Vec<String>,
    #[serde(default)]
    pub model_options: std::collections::BTreeMap<String, Value>,
    #[serde(default)]
    pub has_key: bool,
}

pub fn database(path: &Path) -> Result<Connection, String> {
    // Providers and history load concurrently. SQLite's busy timeout does not
    // serialize the first transition to WAL; initialize before another opener.
    static INITIALIZE: Mutex<()> = Mutex::new(());
    let _initialize = INITIALIZE
        .lock()
        .map_err(|_| "聊天数据库暂时无法初始化，请重新读取。")?;
    std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    let db = Connection::open(path.join("chat.sqlite")).map_err(|e| e.to_string())?;
    db.busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS providers(id TEXT PRIMARY KEY,data TEXT NOT NULL,secret TEXT NOT NULL); CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL,updated INTEGER NOT NULL);").map_err(|e| e.to_string())?;
    Ok(db)
}

pub fn endpoint(provider: &Provider, models: bool) -> Result<String, String> {
    let mut url = reqwest::Url::parse(provider.base_url.trim()).map_err(|_| "API 地址无效。")?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("API 地址应为不含密钥、参数或账号的 HTTP 基础地址。".into());
    }
    let mut base = url.path().trim_end_matches('/').to_string();
    for suffix in ["/chat/completions", "/messages", "/models", "/embeddings"] {
        if base.ends_with(suffix) {
            base.truncate(base.len() - suffix.len());
            break;
        }
    }
    if base.is_empty() {
        base = "/v1".into();
    }
    url.set_path(&format!(
        "{base}/{}",
        if models {
            "models"
        } else if provider.protocol == "anthropic" {
            "messages"
        } else {
            "chat/completions"
        }
    ));
    Ok(url.to_string())
}

pub fn load_provider(db: &Connection, id: &str) -> Result<(Provider, String), String> {
    let (raw, key): (String, String) = db
        .query_row("SELECT data,secret FROM providers WHERE id=?", [id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|_| "请先添加并保存 API 服务。")?;
    Ok((serde_json::from_str(&raw).map_err(|e| e.to_string())?, key))
}

pub fn provider_request(path: &Path, operation: &str, payload: Value) -> Result<Value, String> {
    let db = database(path)?;
    let id = payload["id"].as_str().unwrap_or("");
    match operation {
        "providers" => {
            let mut stmt = db
                .prepare("SELECT data,secret<>'' FROM providers ORDER BY rowid")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, bool>(1)?)))
                .map_err(|e| e.to_string())?;
            let mut out = Vec::new();
            for row in rows {
                let (raw, has_key) = row.map_err(|e| e.to_string())?;
                let mut provider: Provider =
                    serde_json::from_str(&raw).map_err(|e| e.to_string())?;
                provider.has_key = has_key;
                out.push(provider);
            }
            Ok(json!(out))
        }
        "save_provider" => {
            let mut provider: Provider =
                serde_json::from_value(payload.clone()).map_err(|e| e.to_string())?;
            if provider.id.is_empty()
                || provider.name.trim().is_empty()
                || !["openai", "anthropic"].contains(&provider.protocol.as_str())
            {
                return Err("请填写服务名称并选择协议。".into());
            }
            endpoint(&provider, false)?;
            if payload.get("models").is_none() {
                provider.models = load_provider(&db, &provider.id)
                    .map(|v| v.0.models)
                    .unwrap_or_default();
            }
            if let Ok((old, _)) = load_provider(&db, &provider.id) {
                if payload.get("favorites").is_none() {
                    provider.favorites = old.favorites;
                }
                if payload.get("modelOptions").is_none() {
                    provider.model_options = old.model_options;
                }
            }
            for options in provider.model_options.values() {
                if !options.is_object() {
                    return Err("模型配置应为对象。".into());
                }
                let context = options
                    .get("contextTokens")
                    .map(|v| v.as_u64())
                    .unwrap_or(Some(16384));
                let output = options
                    .get("outputTokens")
                    .map(|v| v.as_u64())
                    .unwrap_or(Some(4096));
                if !matches!((context, output), (Some(c),Some(o)) if (512..=2000000).contains(&c) && o>0 && o<c)
                {
                    return Err("模型上下文与输出预算无效。".into());
                }
            }
            provider.model = provider.model.trim().to_string();
            provider.models.push(provider.model.clone());
            let mut seen = std::collections::HashSet::new();
            provider.models = provider
                .models
                .into_iter()
                .map(|id| id.trim().to_string())
                .filter(|id| !id.is_empty() && seen.insert(id.clone()))
                .collect();
            let old = load_provider(&db, &provider.id)
                .ok()
                .map(|v| v.1)
                .unwrap_or_default();
            let key = if payload["clearKey"] == true {
                String::new()
            } else {
                payload["apiKey"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .unwrap_or(&old)
                    .to_string()
            };
            if let Ok((old, old_key)) = load_provider(&db, &provider.id) {
                if old.base_url != provider.base_url
                    || old.protocol != provider.protocol
                    || old_key != key
                {
                    for options in provider.model_options.values_mut() {
                        if let Some(options) = options.as_object_mut() {
                            options.remove("testedAt");
                        }
                    }
                }
            }
            provider.has_key = !key.is_empty();
            let raw = serde_json::to_string(&provider).map_err(|e| e.to_string())?;
            db.execute("INSERT INTO providers(id,data,secret) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET data=excluded.data,secret=excluded.secret", params![provider.id,raw,key]).map_err(|e| e.to_string())?;
            Ok(json!(provider))
        }
        "delete_provider" => {
            db.execute("DELETE FROM providers WHERE id=?", [id])
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        _ => Err("未知 API 服务操作。".into()),
    }
}

impl crate::Store {
    pub fn bind_services(&self, directory: &Path) -> crate::Result<()> {
        // A Windows storage junction may cross drives. Use its physical parent
        // for both the temporary file and atomic rename, keeping the public alias stable.
        let root = std::fs::canonicalize(self.path.parent().unwrap())?;
        let path = root.join("runtime-services.json");
        let data = serde_json::to_vec(&json!({"directory":directory}))?;
        if std::fs::read(&path).ok().as_deref() == Some(data.as_slice()) {
            return Ok(());
        }
        let mut pending = tempfile::NamedTempFile::new_in(&root)?;
        use std::io::Write;
        pending.write_all(&data)?;
        pending.as_file().sync_all()?;
        pending.persist(path).map_err(|e| e.error)?;
        Ok(())
    }
    pub fn services_directory(&self) -> crate::Result<PathBuf> {
        let root = self.path.parent().unwrap();
        match std::fs::read(root.join("runtime-services.json")) {
            Ok(raw) => {
                let value: Value = serde_json::from_slice(&raw)?;
                let path = PathBuf::from(
                    value["directory"]
                        .as_str()
                        .ok_or_else(|| crate::invalid("API 服务目录配置无效。"))?,
                );
                if !path.is_absolute() {
                    return Err(crate::invalid("API 服务目录应为完整路径。"));
                }
                Ok(path)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(root.join("services")),
            Err(e) => Err(e.into()),
        }
    }
    pub(crate) fn service(&self, id: &str) -> crate::Result<(Provider, String)> {
        let db = database(&self.services_directory()?).map_err(|e| crate::invalid(&e))?;
        load_provider(&db, id).map_err(|e| crate::invalid(&e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_services_binding_survives_a_storage_directory_link() {
        let dir = tempfile::tempdir().unwrap();
        let physical = dir.path().join("physical");
        let alias = dir.path().join("alias");
        std::fs::create_dir(&physical).unwrap();
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let script = dir.path().join("link.ps1");
            std::fs::write(&script, "param([string]$Alias,[string]$Target)\n$ErrorActionPreference='Stop'\nNew-Item -ItemType Junction -Path $Alias -Target $Target | Out-Null\n").unwrap();
            let status = std::process::Command::new("powershell.exe")
                .args(["-NoProfile", "-NonInteractive", "-File"])
                .arg(script)
                .arg(&alias)
                .arg(&physical)
                .creation_flags(0x08000000)
                .status()
                .unwrap();
            assert!(status.success());
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(&physical, &alias).unwrap();
        let store = crate::Store::open(&alias).unwrap();
        let services = dir.path().join("chat");
        store.bind_services(&services).unwrap();
        assert_eq!(store.services_directory().unwrap(), services);
        let next = dir.path().join("other-chat");
        store.bind_services(&next).unwrap();
        assert_eq!(
            crate::Store::open(&physical)
                .unwrap()
                .services_directory()
                .unwrap(),
            next
        );
        store.bind_services(&next).unwrap();
        assert_eq!(
            std::fs::read_dir(&physical)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().starts_with(".tmp"))
                .count(),
            0
        );
        #[cfg(windows)]
        std::fs::remove_dir(&alias).unwrap();
        #[cfg(unix)]
        std::fs::remove_file(&alias).unwrap();
    }

    #[test]
    fn model_catalog_roundtrips_preserving_legacy_profiles_and_credentials() {
        let dir = tempfile::tempdir().unwrap();
        let mut input = json!({"id":"multi","name":"多模型服务","protocol":"openai","baseUrl":"http://localhost:7331/v1","model":"fast","apiKey":"test-secret"});
        let old = provider_request(dir.path(), "save_provider", input.clone()).unwrap();
        assert_eq!(old["models"], json!(["fast"]));
        input["models"] = json!(["fast", " careful ", "fast", ""]);
        input.as_object_mut().unwrap().remove("apiKey");
        let saved = provider_request(dir.path(), "save_provider", input.clone()).unwrap();
        assert_eq!(saved["models"], json!(["fast", "careful"]));
        assert_eq!(saved["hasKey"], true);
        input.as_object_mut().unwrap().remove("models");
        input["name"] = json!("旧客户端改名");
        provider_request(dir.path(), "save_provider", input).unwrap();
        let list = provider_request(dir.path(), "providers", json!({})).unwrap();
        assert_eq!(list[0]["models"], json!(["fast", "careful"]));
        assert!(!list.to_string().contains("test-secret"));
        assert_eq!(
            load_provider(&database(dir.path()).unwrap(), "multi")
                .unwrap()
                .1,
            "test-secret"
        );
    }
}

#[cfg(test)]
mod model_options_tests {
    use super::*;
    #[test]
    fn budget_and_favorites_survive_old_clients_but_changed_service_clears_test_status() {
        let dir = tempfile::tempdir().unwrap();
        let input = json!({"id":"multi","name":"个人服务","protocol":"openai","baseUrl":"http://localhost:7331/v1","model":"fast","favorites":["careful"],"modelOptions":{"careful":{"contextTokens":32000,"outputTokens":512,"testedAt":123}}});
        provider_request(dir.path(), "save_provider", input.clone()).unwrap();
        let mut legacy = input.clone();
        legacy.as_object_mut().unwrap().remove("favorites");
        legacy.as_object_mut().unwrap().remove("modelOptions");
        let kept = provider_request(dir.path(), "save_provider", legacy.clone()).unwrap();
        assert_eq!(kept["modelOptions"]["careful"]["outputTokens"], 512);
        assert_eq!(kept["favorites"], json!(["careful"]));
        legacy["baseUrl"] = json!("http://localhost:7332/v1");
        let changed = provider_request(dir.path(), "save_provider", legacy).unwrap();
        assert!(changed["modelOptions"]["careful"]["testedAt"].is_null());
        let mut invalid = input;
        invalid["modelOptions"]["careful"]["outputTokens"] = json!(32000);
        assert!(provider_request(dir.path(), "save_provider", invalid).is_err());
        assert_eq!(
            provider_request(dir.path(), "providers", json!({})).unwrap()[0]["baseUrl"],
            "http://localhost:7332/v1"
        );
    }
}
