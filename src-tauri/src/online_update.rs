//! Signed portable updates: stage independently, then switch the launcher after saving.
use serde_json::{json, Value};
use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, State};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct OnlineUpdate(pub Mutex<Pending>);
#[derive(Default)]
pub struct Pending {
    update: Option<Update>,
    stage: Option<PathBuf>,
}
const EXE: &str = "Moyang Reader Next.exe";
const RELEASE_API: &str = "https://api.github.com/repos/MY-moss/moyang_Reader/releases";

fn release_asset(release: &Value, name: &str) -> Result<tauri::Url, String> {
    let value = release["assets"]
        .as_array()
        .and_then(|assets| {
            assets
                .iter()
                .find(|item| item["name"] == name && item["state"] == "uploaded")
        })
        .and_then(|item| item["url"].as_str())
        .ok_or_else(|| format!("发布中缺少 {name}"))?;
    let id = value
        .strip_prefix(&format!("{RELEASE_API}/assets/"))
        .ok_or("发布资源地址无效。")?;
    if id.is_empty() || !id.bytes().all(|c| c.is_ascii_digit()) {
        return Err("发布资源编号无效。".into());
    }
    tauri::Url::parse(value).map_err(|e| e.to_string())
}

// Some networks can reach GitHub's public API while github.com downloads time
// out. Use the same official release and the same signature, without a mirror.
async fn check_through_release_api(app: &tauri::AppHandle) -> Result<Option<Update>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Moyang-Reader-Updater")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let release: Value = client
        .get(format!("{RELEASE_API}/latest"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let feed = release_asset(&release, "reader-update.json")?;
    let mut update = app
        .updater_builder()
        .target("windows-x86_64-portable")
        .timeout(Duration::from_secs(20))
        .endpoints(vec![feed])
        .map_err(|e| e.to_string())?
        .header("Accept", "application/octet-stream")
        .map_err(|e| e.to_string())?
        .header("User-Agent", "Moyang-Reader-Updater")
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(found) = update.as_mut() {
        if release["tag_name"] != format!("reader-v{}", found.version) {
            return Err("更新源与发布版本不一致。".into());
        }
        found.download_url = release_asset(
            &release,
            &format!("moyang-reader-{}-windows-x64.zip", found.version),
        )?;
    }
    Ok(update)
}
#[tauri::command]
pub fn online_update_failure() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let root = release_root(&exe).ok()?;
    let text = fs::read_to_string(root.join("update-error.txt")).ok()?;
    Some(format!(
        "上次更新未完成，原版本和数据仍保留。{}",
        text.chars().take(400).collect::<String>()
    ))
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}
fn child(root: &Path, name: &str) -> Option<PathBuf> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', ':']) {
        return None;
    }
    Some(root.join(name))
}
pub(crate) fn release_root(exe: &Path) -> Result<PathBuf, String> {
    let directory = exe.parent().ok_or("无法定位应用目录。")?;
    let parent = directory.parent().ok_or("无法定位更新目录。")?;
    if directory.join("online-update.json").is_file()
        || read_json(&parent.join("latest.json"))
            .and_then(|v| v["directory"].as_str().map(str::to_string))
            .is_some_and(|name| child(parent, &name).is_some())
    {
        Ok(parent.to_path_buf())
    } else {
        Ok(directory.join("updates"))
    }
}

/// The original executable remains a stable entry point for standalone downloads.
pub fn forward_to_current() -> bool {
    if cfg!(debug_assertions) {
        return false;
    }
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Ok(root) = release_root(&exe) else {
        return false;
    };
    let Some(value) = read_json(&root.join("latest.json")) else {
        return false;
    };
    let Some(target) = value["directory"]
        .as_str()
        .and_then(|name| child(&root, name))
        .map(|p| p.join(EXE))
        .filter(|p| p.is_file())
    else {
        return false;
    };
    if fs::canonicalize(&target).ok() == fs::canonicalize(&exe).ok() {
        return false;
    }
    std::process::Command::new(&target)
        .args(std::env::args_os().skip(1))
        .current_dir(target.parent().unwrap())
        .spawn()
        .is_ok()
}

#[tauri::command]
pub async fn online_update_check(
    app: tauri::AppHandle,
    state: State<'_, OnlineUpdate>,
) -> Result<Option<Value>, String> {
    let builder = app
        .updater_builder()
        .target("windows-x86_64-portable")
        .timeout(Duration::from_secs(20));
    #[cfg(feature = "wdio")]
    let builder = if let Ok(endpoint) = std::env::var("MOYANG_TEST_UPDATE_ENDPOINT") {
        let url = tauri::Url::parse(&endpoint).map_err(|e| e.to_string())?;
        if url.host_str() != Some("127.0.0.1") {
            return Err("Update fixtures must use loopback".into());
        }
        builder
            .pubkey(std::env::var("MOYANG_TEST_UPDATE_PUBKEY").map_err(|e| e.to_string())?)
            .endpoints(vec![url])
            .map_err(|e| e.to_string())?
    } else {
        builder
    };
    let checked = builder.build().map_err(|e| e.to_string())?.check().await;
    let mut update = match checked {
        Ok(update) => update,
        Err(primary) => {
            // Isolated test failures must never fall through to a live service.
            #[cfg(feature = "wdio")]
            if std::env::var_os("MOYANG_TEST_UPDATE_ENDPOINT").is_some() {
                return Err(primary.to_string());
            }
            check_through_release_api(&app).await.map_err(|fallback| {
                format!("更新服务暂时不可用：{primary}；备用连接：{fallback}")
            })?
        }
    };
    // Checking small metadata should fail promptly; downloading an application
    // archive on a slower connection needs a separate, realistic time budget.
    if let Some(found) = update.as_mut() {
        found.timeout = Some(Duration::from_secs(600));
    }
    let info = update
        .as_ref()
        .map(|u| json!({"version":u.version,"body":u.body,"currentVersion":u.current_version}));
    let mut pending = state.0.lock().map_err(|_| "更新状态不可用。")?;
    pending.update = update;
    pending.stage = None;
    Ok(info)
}

fn stage_package(bytes: &[u8], version: &str, exe: &Path) -> Result<PathBuf, String> {
    if !version
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || ".-+".contains(c))
    {
        return Err("更新版本无效。".into());
    }
    let root = release_root(exe)?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let directory = root.join(format!("{version}-online-{nonce}"));
    fs::create_dir(&directory).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
        for index in 0..zip.len() {
            let mut file = zip.by_index(index).map_err(|e| e.to_string())?;
            let enclosed = file.enclosed_name().ok_or("更新包包含无效路径。")?;
            let path = directory.join(enclosed);
            if file.is_dir() {
                fs::create_dir_all(&path).map_err(|e| e.to_string())?;
            } else {
                fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
                std::io::copy(
                    &mut file,
                    &mut fs::File::create(path).map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
            }
        }
        if !directory.join(EXE).is_file() || !directory.join("moyang-ai-mcp.exe").is_file() {
            return Err("更新包缺少主程序或 MCP 程序。".into());
        }
        let manifest = read_json(&directory.join("SHA256.json")).ok_or("更新包缺少版本清单。")?;
        if manifest["version"] != version {
            return Err("更新清单与包版本不一致。".into());
        }
        let runtime = moyang_ai_core::local_model_runtime();
        fs::write(
            directory.join("online-update.json"),
            serde_json::to_vec(&json!({"version":version,"runtime":runtime,"previous_exe":exe}))
                .unwrap(),
        )
        .map_err(|e| e.to_string())?;
        fs::write(
            directory.join("activate-update.ps1"),
            include_str!("activate-update.ps1"),
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(error) = result {
        // This directory was just created by this invocation beneath the resolved release root.
        let _ = fs::remove_dir_all(&directory);
        return Err(error);
    }
    Ok(directory)
}

#[tauri::command]
pub async fn online_update_download(
    state: State<'_, OnlineUpdate>,
    channel: Channel<Value>,
) -> Result<(), String> {
    let mut update = state
        .0
        .lock()
        .map_err(|_| "更新状态不可用。")?
        .update
        .clone()
        .ok_or("请先检查更新。")?;
    update.timeout = Some(Duration::from_secs(600));
    let mut started = false;
    let bytes = update
        .download(
            |size, total| {
                if !started {
                    let _ = channel.send(json!({"event":"Started","data":{"contentLength":total}}));
                    started = true;
                }
                let _ = channel.send(json!({"event":"Progress","data":{"chunkLength":size}}));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    // download() returns only after verifying the Tauri signature.
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let directory =
        tauri::async_runtime::spawn_blocking(move || stage_package(&bytes, &update.version, &exe))
            .await
            .map_err(|e| e.to_string())??;
    state.0.lock().map_err(|_| "更新状态不可用。")?.stage = Some(directory);
    let _ = channel.send(json!({"event":"Finished"}));
    Ok(())
}

#[tauri::command]
pub fn online_update_activate(
    app: tauri::AppHandle,
    state: State<'_, OnlineUpdate>,
) -> Result<(), String> {
    let directory = state
        .0
        .lock()
        .map_err(|_| "更新状态不可用。")?
        .stage
        .clone()
        .ok_or("更新尚未下载完成。")?;
    let mut command = std::process::Command::new("powershell.exe");
    command
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
        ])
        .arg(directory.join("activate-update.ps1"))
        .arg("-OldProcessId")
        .arg(std::process::id().to_string());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
        .spawn()
        .map_err(|e| format!("无法启动更新切换程序：{e}"))?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn official_release_fallback_requires_an_uploaded_asset_from_this_repository() {
        let mut release = json!({"assets":[{"name":"reader-update.json","state":"uploaded","url":format!("{RELEASE_API}/assets/123")} ]});
        assert!(release_asset(&release, "reader-update.json")
            .unwrap()
            .as_str()
            .ends_with("/123"));
        assert!(release_asset(&release, "other.json").is_err());
        release["assets"][0]["state"] = json!("new");
        assert!(release_asset(&release, "reader-update.json").is_err());
        release["assets"][0]["state"] = json!("uploaded");
        release["assets"][0]["url"] = json!("https://example.org/assets/123");
        assert!(release_asset(&release, "reader-update.json").is_err());
    }
    fn package(version: &str, complete: bool) -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, body) in [
            (EXE, "reader"),
            ("moyang-ai-mcp.exe", "mcp"),
            ("SHA256.json", &format!("{{\"version\":\"{version}\"}}")),
        ] {
            if !complete && name == EXE {
                continue;
            }
            zip.start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            zip.write_all(body.as_bytes()).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }
    #[test]
    fn staging_preserves_pointer_and_rejects_incomplete_or_mismatched_packages() {
        let root = std::env::temp_dir().join(format!(
            "moyang-update-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("old")).unwrap();
        fs::write(root.join("latest.json"), r#"{"directory":"old"}"#).unwrap();
        let exe = root.join("old").join(EXE);
        assert!(stage_package(&package("2.0.0", false), "2.0.0", &exe).is_err());
        assert!(stage_package(&package("2.0.1", true), "2.0.0", &exe).is_err());
        let stage = stage_package(&package("2.0.0", true), "2.0.0", &exe).unwrap();
        assert!(stage.join(EXE).is_file());
        assert_eq!(
            read_json(&root.join("latest.json")).unwrap()["directory"],
            "old"
        );
        assert!(child(&root, "../other").is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
