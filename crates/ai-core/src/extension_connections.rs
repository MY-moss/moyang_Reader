use crate::{
    connections::{object, read, write_config},
    invalid, ClientPaths, Result,
};
use serde_json::{json, Value};
use toml_edit::{value, DocumentMut, Item, Table};

fn client_config(config: &Value, client: &str) -> Result<Value> {
    let mut result = json!({});
    if let Some(command) = config["command"].as_str().filter(|s| !s.trim().is_empty()) {
        if !config["url"].is_null() {
            return Err(invalid("MCP 命令与远程地址不能同时设置。"));
        }
        result["command"] = json!(command);
        let args = config.get("args").cloned().unwrap_or(json!([]));
        if !args
            .as_array()
            .is_some_and(|a| a.iter().all(Value::is_string))
        {
            return Err(invalid("MCP 参数必须是文字数组。"));
        }
        result["args"] = args;
        if client == "claude" {
            result["type"] = json!("stdio");
        }
        if let Some(env) = config.get("env") {
            insert_map(&mut result, "env", env)?;
        }
    } else {
        let url = config["url"]
            .as_str()
            .ok_or_else(|| invalid("MCP 缺少命令或地址。"))?;
        let parsed = reqwest::Url::parse(url).map_err(|_| invalid("MCP 地址无效。"))?;
        if !["http", "https"].contains(&parsed.scheme()) {
            return Err(invalid("MCP 地址需要 HTTP 或 HTTPS。"));
        }
        result["url"] = json!(url);
        if client == "claude" {
            result["type"] = json!("http");
        }
        if let Some(headers) = config.get("headers") {
            insert_map(
                &mut result,
                if client == "codex" {
                    "http_headers"
                } else {
                    "headers"
                },
                headers,
            )?;
        }
    }
    Ok(result)
}
fn insert_map(target: &mut Value, key: &str, source: &Value) -> Result<()> {
    let entries = source
        .as_object()
        .ok_or_else(|| invalid("MCP 环境变量或请求头格式无效。"))?;
    if !entries.values().all(Value::is_string) {
        return Err(invalid("MCP 环境变量或请求头需要文字。"));
    }
    if !entries.is_empty() {
        target[key] = source.clone();
    }
    Ok(())
}
fn toml_json(item: &Item) -> Value {
    if let Some(table) = item.as_table_like() {
        return Value::Object(
            table
                .iter()
                .map(|(k, v)| (k.into(), toml_json(v)))
                .collect(),
        );
    }
    if let Some(s) = item.as_str() {
        return json!(s);
    }
    if let Some(b) = item.as_bool() {
        return json!(b);
    }
    if let Some(n) = item.as_integer() {
        return json!(n);
    }
    if let Some(array) = item.as_array() {
        return json!(array
            .iter()
            .map(|v| v.as_str().map(Value::from).unwrap_or(Value::Null))
            .collect::<Vec<_>>());
    }
    Value::Null
}
fn toml_entry(config: &Value) -> Table {
    let mut table = Table::new();
    for (key, v) in config.as_object().unwrap() {
        if let Some(s) = v.as_str() {
            table[key] = value(s);
        } else if let Some(a) = v.as_array() {
            let mut array = toml_edit::Array::new();
            for s in a {
                array.push(s.as_str().unwrap());
            }
            table[key] = value(array);
        } else if let Some(map) = v.as_object() {
            let mut values = Table::new();
            for (k, s) in map {
                values[k] = value(s.as_str().unwrap());
            }
            table[key] = Item::Table(values);
        }
    }
    table
}
/// Only an explicit install/remove changes a namespaced MCP entry; hooks and trust remain untouched.
pub fn configure_external_client(
    paths: &ClientPaths,
    client: &str,
    id: &str,
    config: &Value,
    previous: Option<&Value>,
    action: &str,
) -> Result<Value> {
    if id.is_empty()
        || id.len() > 100
        || !id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"._-".contains(&b))
    {
        return Err(invalid("扩展 ID 无效。"));
    }
    if !["preview", "install", "remove"].contains(&action) {
        return Err(invalid("未知连接操作。"));
    }
    let path = match client {
        "codex" => paths.codex.join("config.toml"),
        "claude" => paths.claude_mcp.clone(),
        _ => return Err(invalid("不支持的客户端。")),
    };
    let key = format!("moyang-ext-{id}");
    let before = read(&path)?;
    let desired = client_config(config, client)?;
    let previous = previous.map(|p| client_config(p, client)).transpose()?;
    let mut doc = if client == "codex" {
        before
            .parse::<DocumentMut>()
            .map_err(|e| invalid(&format!("Codex 配置无法解析：{e}")))?
    } else {
        DocumentMut::new()
    };
    let mut json_doc = if client == "claude" {
        object(&before)?
    } else {
        json!({})
    };
    let current = if client == "codex" {
        doc.get("mcp_servers")
            .and_then(|m| m.get(&key))
            .map(toml_json)
            .unwrap_or(Value::Null)
    } else {
        json_doc["mcpServers"][&key].clone()
    };
    let owned = previous.as_ref().is_some_and(|p| *p == current);
    let installed = !current.is_null();
    if action == "install" && installed && !owned && current != desired {
        return Err(invalid(
            "该连接已被其他程序或你修改，原配置已保留。请先在客户端检查。",
        ));
    }
    if action == "remove" && installed && !owned {
        return Err(invalid(
            "连接含有本应用安装后发生的修改，已保留。请在客户端核对后移除。",
        ));
    }
    if client == "codex" {
        if doc.get("mcp_servers").is_none() {
            doc["mcp_servers"] = Item::Table(Table::new());
        }
        let servers = doc["mcp_servers"]
            .as_table_like_mut()
            .ok_or_else(|| invalid("mcp_servers 格式无效。"))?;
        if action == "remove" {
            servers.remove(&key);
        } else {
            servers.insert(&key, Item::Table(toml_entry(&desired)));
        }
    } else {
        if json_doc.get("mcpServers").is_none() {
            json_doc["mcpServers"] = json!({});
        }
        let servers = json_doc["mcpServers"]
            .as_object_mut()
            .ok_or_else(|| invalid("mcpServers 格式无效。"))?;
        if action == "remove" {
            servers.remove(&key);
        } else {
            servers.insert(key.clone(), desired);
        }
    }
    let after = if client == "codex" {
        doc.to_string()
    } else {
        serde_json::to_string_pretty(&json_doc)?
    };
    if action != "preview" {
        write_config(&path, &before, &after)?;
    }
    Ok(
        json!({"path":path,"content":after,"installed": if action=="preview"{installed}else{action=="install"},"owned":if action=="preview"{owned}else{action=="install"},"message":match action{"install"=>"配置已保存并备份。请在客户端重新加载并确认信任；尚未验证连接。","remove"=>"已移除本扩展的连接，其他设置保持原样。",_=>"预览不会修改客户端配置。"}}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn merges_and_removes_only_owned_entries_in_both_clients() {
        let root = tempfile::tempdir().unwrap();
        let paths = ClientPaths {
            codex: root.path().join("codex"),
            claude_settings: root.path().join("settings.json"),
            claude_mcp: root.path().join("claude.json"),
        };
        std::fs::create_dir_all(&paths.codex).unwrap();
        std::fs::write(
            paths.codex.join("config.toml"),
            "# retain\nmodel='existing'\n[mcp_servers.other]\ncommand='other'\n",
        )
        .unwrap();
        std::fs::write(
            &paths.claude_mcp,
            r#"{"mcpServers":{"other":{"command":"other"}},"metric":123.1234567890123456789}"#,
        )
        .unwrap();
        let config = json!({"command":"demo","args":["--serve"],"env":{"PROJECT":"书房"}});
        for client in ["codex", "claude"] {
            let preview =
                configure_external_client(&paths, client, "demo", &config, None, "preview")
                    .unwrap();
            assert_eq!(preview["installed"], false);
            configure_external_client(&paths, client, "demo", &config, None, "install").unwrap();
            assert!(
                configure_external_client(&paths, client, "demo", &config, None, "remove").is_err()
            );
            let installed = configure_external_client(
                &paths,
                client,
                "demo",
                &config,
                Some(&config),
                "preview",
            )
            .unwrap();
            assert_eq!(installed["owned"], true);
            configure_external_client(&paths, client, "demo", &config, Some(&config), "remove")
                .unwrap();
        }
        assert!(read(&paths.codex.join("config.toml"))
            .unwrap()
            .contains("# retain"));
        assert!(read(&paths.claude_mcp)
            .unwrap()
            .contains("123.1234567890123456789"));
        assert!(read(&paths.claude_mcp).unwrap().contains("other"));
    }
    #[test]
    fn preserves_user_changes_and_supports_remote_headers() {
        let root = tempfile::tempdir().unwrap();
        let paths = ClientPaths {
            codex: root.path().into(),
            claude_settings: root.path().join("settings.json"),
            claude_mcp: root.path().join("claude.json"),
        };
        let remote =
            json!({"url":"https://example.test/mcp","headers":{"Authorization":"Bearer example"}});
        configure_external_client(&paths, "codex", "remote", &remote, None, "install").unwrap();
        let file = paths.codex.join("config.toml");
        let edited = read(&file).unwrap().replace("example.test", "changed.test");
        std::fs::write(&file, &edited).unwrap();
        assert!(configure_external_client(
            &paths,
            "codex",
            "remote",
            &remote,
            Some(&remote),
            "install"
        )
        .is_err());
        assert!(configure_external_client(
            &paths,
            "codex",
            "remote",
            &remote,
            Some(&remote),
            "remove"
        )
        .is_err());
        assert_eq!(read(&file).unwrap(), edited);
    }
}
