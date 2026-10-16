use crate::*;
use base64::Engine;
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use toml_edit::{value, DocumentMut, Item, Table};

pub struct ClientPaths {
    pub codex: PathBuf,
    pub claude_settings: PathBuf,
    pub claude_mcp: PathBuf,
}
impl ClientPaths {
    pub fn user() -> Result<Self> {
        let home = std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
            .ok_or_else(|| invalid("无法确定用户目录。"))?;
        let codex = std::env::var_os("CODEX_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".codex"));
        let claude = std::env::var_os("CLAUDE_CONFIG_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".claude"));
        Ok(Self {
            codex,
            claude_settings: claude.join("settings.json"),
            claude_mcp: if std::env::var_os("CLAUDE_CONFIG_DIR").is_some() {
                claude.join(".claude.json")
            } else {
                home.join(".claude.json")
            },
        })
    }
}
pub(super) fn read(path: &Path) -> Result<String> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.into()),
    }
}
pub(super) fn object(raw: &str) -> Result<Value> {
    let v = if raw.trim().is_empty() {
        json!({})
    } else {
        serde_json::from_str(raw)?
    };
    if !v.is_object() {
        return Err(invalid("客户端配置必须是对象。"));
    }
    Ok(v)
}
pub(super) fn write_config(path: &Path, before: &str, after: &str) -> Result<()> {
    if before == after {
        return Ok(());
    }
    let parent = path.parent().ok_or_else(|| invalid("配置路径无效。"))?;
    fs::create_dir_all(parent)?;
    if read(path)? != before {
        return Err(invalid("客户端正在修改配置，请稍后重试。"));
    }
    if path.exists() {
        fs::copy(
            path,
            path.with_file_name(format!(
                "{}.moyang-{}.bak",
                path.file_name().unwrap().to_string_lossy(),
                uuid::Uuid::new_v4()
            )),
        )?;
    }
    let mut file = tempfile::NamedTempFile::new_in(parent)?;
    file.write_all(after.as_bytes())?;
    file.as_file().sync_all()?;
    if read(path)? != before {
        return Err(invalid("客户端配置发生并发修改，原内容已保留。"));
    }
    file.persist(path).map_err(|e| Error::Io(e.error))?;
    Ok(())
}
fn shell_quote(text: &str) -> String {
    format!("'{}'", text.replace('\\', "/").replace('\'', "'\"'\"'"))
}
fn ps_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "''"))
}
fn hooks(exe: &Path, data: &Path, client: &str) -> Value {
    let exe = exe.to_string_lossy();
    let data = data.to_string_lossy();
    let command = format!(
        "{} --data-dir {} --hook {client}",
        shell_quote(&exe),
        shell_quote(&data)
    );
    let script=format!("[Console]::InputEncoding=[System.Text.UTF8Encoding]::new(); [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); & {} --data-dir {} --hook {client}",ps_quote(&exe),ps_quote(&data));
    let encoded = base64::engine::general_purpose::STANDARD.encode(
        script
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>(),
    );
    let windows = format!("powershell.exe -NoProfile -NonInteractive -EncodedCommand {encoded}");
    let mut hooks = serde_json::Map::new();
    for event in ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"] {
        let mut handler =
            json!({"type":"command","command":command,"timeout":if event=="SessionEnd"{3}else{15}});
        if client == "codex" {
            handler["commandWindows"] = json!(windows);
        }
        if client == "claude" {
            handler["command"] = json!(exe);
            handler["args"] = json!(["--data-dir", data, "--hook", client]);
        }
        hooks.insert(event.into(), json!([{"hooks":[handler]}]));
    }
    Value::Object(hooks)
}
fn merge_hooks(config: &mut Value, owned: &Value, add: bool) -> Result<()> {
    if config.get("hooks").is_none() {
        config["hooks"] = json!({});
    }
    let target = config["hooks"]
        .as_object_mut()
        .ok_or_else(|| invalid("hooks 配置格式无效，未修改。"))?;
    for (event, groups) in owned.as_object().unwrap() {
        let list = target
            .entry(event)
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .ok_or_else(|| invalid("钩子事件配置格式无效。"))?;
        for group in groups.as_array().unwrap() {
            // Remove only the exact handlers we wrote, even if another client merged groups.
            if !add {
                for existing in list.iter_mut() {
                    if let Some(h) = existing["hooks"].as_array_mut() {
                        h.retain(|v| !group["hooks"].as_array().unwrap().contains(v));
                    }
                }
                list.retain(|g| g["hooks"].as_array().is_none_or(|h| !h.is_empty()));
            } else if !list.iter().any(|g| {
                g["hooks"].as_array().is_some_and(|h| {
                    group["hooks"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .all(|v| h.contains(v))
                })
            }) {
                list.push(group.clone());
            }
        }
    }
    Ok(())
}
fn contains_hooks(config: &Value, desired: &Value) -> bool {
    desired.as_object().unwrap().iter().all(|(event, groups)| {
        groups.as_array().unwrap().iter().all(|group| {
            config["hooks"][event].as_array().is_some_and(|existing| {
                existing.iter().any(|item| {
                    item["hooks"].as_array().is_some_and(|handlers| {
                        group["hooks"]
                            .as_array()
                            .unwrap()
                            .iter()
                            .all(|handler| handlers.contains(handler))
                    })
                })
            })
        })
    })
}
fn same_server_target(left: &Value, right: &Value) -> bool {
    let same_path = |left: &Value, right: &Value| {
        let (Some(left), Some(right)) = (left.as_str(), right.as_str()) else {
            return false;
        };
        left == right
            || fs::canonicalize(left)
                .ok()
                .zip(fs::canonicalize(right).ok())
                .is_some_and(|(left, right)| left == right)
    };
    let (Some(left_args), Some(right_args)) = (left["args"].as_array(), right["args"].as_array())
    else {
        return false;
    };
    left.as_object().is_some_and(|v| v.len() == 2)
        && right.as_object().is_some_and(|v| v.len() == 2)
        && left_args.len() == 2
        && right_args.len() == 2
        && left_args[0] == "--data-dir"
        && right_args[0] == "--data-dir"
        && same_path(&left["command"], &right["command"])
        && same_path(&left_args[1], &right_args[1])
}
/// Exact merge with a per-application ownership manifest. Other services and hook groups survive.
pub fn configure_client(
    store: &Store,
    paths: &ClientPaths,
    exe: &Path,
    client: &str,
    action: &str,
) -> Result<Value> {
    if !["codex", "claude"].contains(&client)
        || !["status", "install", "uninstall"].contains(&action)
    {
        return Err(invalid("未知客户端操作。"));
    }
    let data = store.path.parent().unwrap();
    let key = format!("client-install:{client}");
    let manifest = store.setting_value(&key)?;
    // Keep both completed and interrupted installations until both files are updated.
    let owned: Vec<&Value> = std::iter::once(&manifest)
        .chain(manifest["pending"].as_array().into_iter().flatten())
        .collect();
    let config_path = if client == "codex" {
        paths.codex.join("config.toml")
    } else {
        paths.claude_mcp.clone()
    };
    let hook_path = if client == "codex" {
        paths.codex.join("hooks.json")
    } else {
        paths.claude_settings.clone()
    };
    let before = read(&config_path)?;
    let hook_before = read(&hook_path)?;
    let target = json!({"command":exe,"args":["--data-dir",data]});
    // Keep the exact installed spelling and hook definitions for the same files.
    // A CLI forward-slash path and the desktop's Windows path must not look like
    // a reinstall or invalidate client trust and successful connection receipts.
    let matching = owned
        .iter()
        .rev()
        .find(|entry| same_server_target(&entry["server"], &target) && entry["hooks"].is_object());
    let desired = matching.map_or(target.clone(), |entry| entry["server"].clone());
    let desired_hooks =
        matching.map_or_else(|| hooks(exe, data, client), |entry| entry["hooks"].clone());
    let mut doc = if client == "codex" {
        before
            .parse::<DocumentMut>()
            .map_err(|e| invalid(&format!("Codex 配置无法解析：{e}")))?
    } else {
        DocumentMut::new()
    };
    let mut config = if client == "claude" {
        object(&before)?
    } else {
        json!({})
    };
    let current = if client == "codex" {
        if let Some(item) = doc.get("mcp_servers").and_then(|m| m.get("moyang-ai")) {
            json!({"command":item.get("command").and_then(Item::as_str),"args":item.get("args").and_then(Item::as_array).map(|a|a.iter().map(|x|x.as_str().unwrap_or("")).collect::<Vec<_>>())})
        } else {
            Value::Null
        }
    } else {
        config["mcpServers"]["moyang-ai"].clone()
    };
    let mut hook_config = object(&hook_before)?;
    let connection_changed = current != desired || !contains_hooks(&hook_config, &desired_hooks);
    if action != "status" {
        if action == "install" && !exe.is_file() {
            return Err(invalid("MCP 程序不存在，请先完成桌面打包。"));
        }
        let current_owned = owned.iter().any(|entry| current == entry["server"]);
        if !current.is_null() && !current_owned && current != desired {
            return Err(invalid(
                "存在同名 moyang-ai 配置且不属于本应用，已保留。请先在客户端重命名该服务。",
            ));
        }
        for installation in &owned {
            if let Some(old) = installation.get("hooks") {
                merge_hooks(&mut hook_config, old, false)?;
            }
        }
        if action == "install" {
            merge_hooks(&mut hook_config, &desired_hooks, true)?;
        }
        if client == "codex" {
            if action == "install" {
                if doc.get("mcp_servers").is_none() {
                    doc["mcp_servers"] = Item::Table(Table::new());
                }
                let mut entry = Table::new();
                entry["command"] = value(desired["command"].as_str().unwrap());
                let mut args = toml_edit::Array::new();
                for arg in desired["args"].as_array().unwrap() {
                    args.push(arg.as_str().unwrap());
                }
                entry["args"] = value(args);
                if doc["mcp_servers"].get("moyang-ai").is_none() {
                    doc["mcp_servers"]["moyang-ai"] = Item::Table(entry);
                } else {
                    doc["mcp_servers"]["moyang-ai"]["command"] = entry["command"].clone();
                    doc["mcp_servers"]["moyang-ai"]["args"] = entry["args"].clone();
                }
            } else if !current.is_null() && current_owned {
                if doc["mcp_servers"]["moyang-ai"]
                    .as_table_like()
                    .is_some_and(|t| t.iter().any(|(k, _)| k != "command" && k != "args"))
                {
                    return Err(invalid(
                        "moyang-ai 配置含有后来添加的字段，已保留；请在客户端检查后移除。",
                    ));
                }
                if let Some(t) = doc["mcp_servers"].as_table_like_mut() {
                    t.remove("moyang-ai");
                }
            }
        } else if action == "install" {
            if config.get("mcpServers").is_none() {
                config["mcpServers"] = json!({});
            }
            if !config["mcpServers"].is_object() {
                return Err(invalid("mcpServers 配置格式无效。"));
            }
            config["mcpServers"]["moyang-ai"] = desired.clone();
        } else if !current.is_null() && current_owned {
            if let Some(m) = config["mcpServers"].as_object_mut() {
                m.remove("moyang-ai");
            }
        }
        let after = if client == "codex" {
            doc.to_string()
        } else {
            serde_json::to_string_pretty(&config)?
        };
        let hook_after = serde_json::to_string_pretty(&hook_config)?;
        // Retry the same interrupted installation without creating a new generation.
        // An idempotent repair must keep receipts from the already working connection.
        let pending_since = manifest["pending"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|entry| entry["server"] == desired && entry["hooks"] == desired_hooks)
            .and_then(|entry| entry["installed_at"].as_i64());
        let installed_at = if connection_changed {
            pending_since.unwrap_or_else(now)
        } else {
            pending_since
                .or_else(|| manifest["installed_at"].as_i64())
                .unwrap_or(0)
        };
        let installation = json!({"server":desired,"hooks":desired_hooks,"config":config_path,"hook_config":hook_path,"installed_at":installed_at});
        // Record intent without discarding the previous ownership. A failure can leave
        // either the old server or old hooks on disk, both of which a retry must recognize.
        if action == "install" {
            let mut pending = manifest["pending"].as_array().cloned().unwrap_or_default();
            if !pending.contains(&installation) {
                pending.push(installation.clone());
            }
            let mut recoverable = if manifest.is_object() {
                manifest.clone()
            } else {
                json!({})
            };
            recoverable["pending"] = json!(pending);
            store.set_setting_value(&key, &recoverable)?;
        }
        write_config(&config_path, &before, &after)?;
        write_config(&hook_path, &hook_before, &hook_after)?;
        if action == "uninstall" {
            store.set_setting_value(&key, &Value::Null)?;
        } else {
            store.set_setting_value(&key, &installation)?;
        }
        return configure_client(store, paths, exe, client, "status");
    }
    let configured = current == desired;
    let hooks_configured = contains_hooks(&hook_config, &desired_hooks);
    let historical_receipts = store.client_receipts(client)?;
    let mut receipts = historical_receipts.clone();
    let installed_at = owned
        .iter()
        .rev()
        .find(|entry| entry["server"] == desired && entry["hooks"] == desired_hooks)
        .and_then(|entry| entry["installed_at"].as_i64())
        .unwrap_or(0);
    for kind in ["mcp", "hook", "completed"] {
        let field = format!("{kind}_at");
        let source = store.setting_value(&format!("connection-source:{client}:{kind}"))?;
        let from_executable = source["executable"].as_str().is_some_and(|path| {
            fs::canonicalize(path)
                .ok()
                .zip(fs::canonicalize(exe).ok())
                .is_some_and(|(actual, expected)| actual == expected)
        });
        if (installed_at > 0
            && (receipts[&field].as_i64().unwrap_or(0) <= installed_at
                || source["at"] != receipts[&field]
                || !from_executable))
            || (kind == "mcp" && !configured)
            || (kind != "mcp" && !hooks_configured)
        {
            receipts[&field] = Value::Null;
        }
    }
    Ok(
        json!({"client":client,"configured":configured,"hooks_configured":hooks_configured,"config_path":config_path,"hook_path":hook_path,"receipts":receipts,"historical_receipts":historical_receipts,"trust_hint":if client=="codex"{"在 Codex 输入 /hooks，检查并信任 Moyang 的四项钩子。"}else{"重启 Claude Code；若客户端要求确认钩子，请在客户端完成。"}}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    #[test]
    fn equivalent_windows_path_spellings_keep_connection_status_and_hooks() {
        let root = tempfile::tempdir().unwrap();
        let paths = ClientPaths {
            codex: root.path().join("codex"),
            claude_settings: root.path().join("claude/settings.json"),
            claude_mcp: root.path().join("claude.json"),
        };
        let exe = root.path().join("moyang.exe");
        fs::write(&exe, "").unwrap();
        let directory = root.path().join("data");
        let forward = |p: &Path| PathBuf::from(p.to_string_lossy().replace('\\', "/"));
        let initial = Store::open(forward(&directory)).unwrap();
        let desktop = Store::open(&directory).unwrap();
        for client in ["codex", "claude"] {
            configure_client(&initial, &paths, &forward(&exe), client, "install").unwrap();
            let key = format!("client-install:{client}");
            let manifest = initial.setting_value(&key).unwrap();
            let config_path = if client == "codex" {
                paths.codex.join("config.toml")
            } else {
                paths.claude_mcp.clone()
            };
            let hook_path = if client == "codex" {
                paths.codex.join("hooks.json")
            } else {
                paths.claude_settings.clone()
            };
            let config_before = read(&config_path).unwrap();
            let hooks_before = read(&hook_path).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(3));
            let at = now();
            for kind in ["mcp", "hook", "completed"] {
                initial
                    .set_setting_value(&format!("connection:{client}:{kind}"), &json!(at))
                    .unwrap();
                initial
                    .set_setting_value(
                        &format!("connection-source:{client}:{kind}"),
                        &json!({"at":at,"executable":exe}),
                    )
                    .unwrap();
            }
            for action in ["status", "install"] {
                let status = configure_client(&desktop, &paths, &exe, client, action).unwrap();
                assert_eq!(status["configured"], true, "{client} {action}");
                assert_eq!(status["hooks_configured"], true);
                assert_eq!(status["receipts"]["mcp_at"], at);
                assert_eq!(status["receipts"]["hook_at"], at);
                assert_eq!(status["receipts"]["completed_at"], at);
            }
            assert_eq!(read(&config_path).unwrap(), config_before);
            assert_eq!(read(&hook_path).unwrap(), hooks_before);
            assert_eq!(desktop.setting_value(&key).unwrap(), manifest);
            let different = Store::open(root.path().join("different-data")).unwrap();
            let status = configure_client(&different, &paths, &exe, client, "status").unwrap();
            assert_eq!(status["configured"], false);
            assert!(configure_client(&different, &paths, &exe, client, "install").is_err());
            assert_eq!(read(&config_path).unwrap(), config_before);
        }
    }
    #[test]
    fn receipts_belong_to_the_installed_connection_and_reinstall_is_idempotent() {
        let root = tempfile::tempdir().unwrap();
        let paths = ClientPaths {
            codex: root.path().join("codex"),
            claude_settings: root.path().join("claude/settings.json"),
            claude_mcp: root.path().join("claude.json"),
        };
        let old_exe = root.path().join("old.exe");
        let new_exe = root.path().join("new.exe");
        fs::write(&old_exe, "").unwrap();
        fs::write(&new_exe, "").unwrap();
        let store = Store::open(root.path().join("data")).unwrap();
        for client in ["codex", "claude"] {
            let record_receipts = |exe: &Path| {
                // A real client process takes longer than a timestamp tick to restart.
                std::thread::sleep(std::time::Duration::from_millis(3));
                let at = now();
                for kind in ["mcp", "hook", "completed"] {
                    store
                        .set_setting_value(&format!("connection:{client}:{kind}"), &json!(at))
                        .unwrap();
                    store
                        .set_setting_value(
                            &format!("connection-source:{client}:{kind}"),
                            &json!({"at":at,"executable":exe}),
                        )
                        .unwrap();
                }
                at
            };
            configure_client(&store, &paths, &old_exe, client, "install").unwrap();
            let old_at = record_receipts(&old_exe);
            let same = configure_client(&store, &paths, &old_exe, client, "install").unwrap();
            assert_eq!(same["receipts"]["mcp_at"], old_at);
            assert_eq!(same["receipts"]["hook_at"], old_at);
            let moved = configure_client(&store, &paths, &new_exe, client, "install").unwrap();
            assert!(moved["receipts"]["mcp_at"].is_null());
            assert!(moved["receipts"]["hook_at"].is_null());
            assert_eq!(moved["historical_receipts"]["completed_at"], old_at);
            record_receipts(&old_exe);
            let old_running = configure_client(&store, &paths, &new_exe, client, "status").unwrap();
            assert!(old_running["receipts"]["hook_at"].is_null());
            let fresh_at = record_receipts(&new_exe);
            let fresh = configure_client(&store, &paths, &new_exe, client, "status").unwrap();
            assert_eq!(fresh["receipts"]["mcp_at"], fresh_at);
            assert_eq!(fresh["receipts"]["hook_at"], fresh_at);
            let same = configure_client(&store, &paths, &new_exe, client, "install").unwrap();
            assert_eq!(same["receipts"]["completed_at"], fresh_at);
            let hook_path = if client == "codex" {
                paths.codex.join("hooks.json")
            } else {
                paths.claude_settings.clone()
            };
            let mut changed = object(&read(&hook_path).unwrap()).unwrap();
            changed["hooks"]["Stop"] = json!([]);
            fs::write(&hook_path, serde_json::to_string(&changed).unwrap()).unwrap();
            let repaired = configure_client(&store, &paths, &new_exe, client, "install").unwrap();
            assert!(repaired["receipts"]["hook_at"].is_null());
        }
        let actual = std::env::current_exe().unwrap();
        configure_client(&store, &paths, &actual, "codex", "install").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(3));
        store.connection_receipt("codex", "mcp").unwrap();
        let status = configure_client(&store, &paths, &actual, "codex", "status").unwrap();
        assert!(status["receipts"]["mcp_at"].is_number());
    }
    #[cfg(windows)]
    #[test]
    fn relocated_install_can_retry_after_either_config_file_is_locked() {
        use std::os::windows::fs::OpenOptionsExt;
        for locked_hooks in [false, true] {
            let root = tempfile::tempdir().unwrap();
            let paths = ClientPaths {
                codex: root.path().join("codex"),
                claude_settings: root.path().join("claude/settings.json"),
                claude_mcp: root.path().join("claude.json"),
            };
            let old_exe = root.path().join("old.exe");
            let new_exe = root.path().join("new.exe");
            fs::write(&old_exe, "").unwrap();
            fs::write(&new_exe, "").unwrap();
            let store = Store::open(root.path().join("data")).unwrap();
            configure_client(&store, &paths, &old_exe, "codex", "install").unwrap();
            let locked_path = paths.codex.join(if locked_hooks {
                "hooks.json"
            } else {
                "config.toml"
            });
            // Permit reads and writes but deny deletion/replacement, as a client holding a file can do.
            let lock = fs::OpenOptions::new()
                .read(true)
                .share_mode(3)
                .open(locked_path)
                .unwrap();
            assert!(configure_client(&store, &paths, &new_exe, "codex", "install").is_err());
            drop(lock);
            let status = configure_client(&store, &paths, &new_exe, "codex", "install").unwrap();
            assert_eq!(status["configured"], true);
            assert_eq!(status["hooks_configured"], true);
            let config = object(&read(&paths.codex.join("hooks.json")).unwrap()).unwrap();
            for event in ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"] {
                assert_eq!(config["hooks"][event].as_array().unwrap().len(), 1);
            }
            configure_client(&store, &paths, &new_exe, "codex", "uninstall").unwrap();
            let config = object(&read(&paths.codex.join("hooks.json")).unwrap()).unwrap();
            assert!(config["hooks"]
                .as_object()
                .unwrap()
                .values()
                .all(|v| v.as_array().unwrap().is_empty()));
        }
    }
    #[test]
    fn exact_merge_reinstall_and_uninstall_preserve_other_clients() {
        let root = tempfile::tempdir().unwrap();
        let paths = ClientPaths {
            codex: root.path().join("codex"),
            claude_settings: root.path().join("claude/settings.json"),
            claude_mcp: root.path().join("claude.json"),
        };
        fs::create_dir_all(&paths.codex).unwrap();
        fs::create_dir_all(paths.claude_settings.parent().unwrap()).unwrap();
        fs::write(
            paths.codex.join("config.toml"),
            "# preserve comment\nmodel = 'existing'\n[mcp_servers.other]\ncommand='other.exe'\n",
        )
        .unwrap();
        for p in [
            paths.codex.join("hooks.json"),
            paths.claude_settings.clone(),
        ] {
            fs::write(p,r#"{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"existing"}]}]},"custom":true}"#).unwrap();
        }
        fs::write(
            &paths.claude_mcp,
            r#"{"mcpServers":{"other":{"command":"other"}},"user":"keep","clientMetric":123.1234567890123456789}"#,
        )
        .unwrap();
        let exe = root.path().join("moyang.exe");
        fs::write(&exe, "").unwrap();
        let s = Store::open(root.path().join("data")).unwrap();
        for client in ["codex", "claude"] {
            for _ in 0..2 {
                let r = configure_client(&s, &paths, &exe, client, "install").unwrap();
                assert_eq!(r["configured"], true);
                assert_eq!(r["hooks_configured"], true);
            }
            configure_client(&s, &paths, &exe, client, "uninstall").unwrap();
        }
        assert!(read(&paths.codex.join("config.toml"))
            .unwrap()
            .contains("# preserve comment"));
        assert!(read(&paths.codex.join("config.toml"))
            .unwrap()
            .contains("other.exe"));
        assert_eq!(
            object(&read(&paths.claude_mcp).unwrap()).unwrap()["user"],
            "keep"
        );
        assert!(read(&paths.claude_mcp)
            .unwrap()
            .contains("123.1234567890123456789"));
        let hooks = object(&read(&paths.claude_settings).unwrap()).unwrap();
        assert_eq!(hooks["hooks"]["Stop"].as_array().unwrap().len(), 1);
        assert_eq!(hooks["hooks"]["Stop"][0]["hooks"][0]["command"], "existing");
    }
}
