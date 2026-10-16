//! Windows storage migration keeps stable directory links for existing MCP clients.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct StorageMigration(Mutex<Option<PathBuf>>);
#[derive(Clone, Serialize, Deserialize)]
struct Location {
    key: String,
    label: String,
    logical: PathBuf,
    physical: PathBuf,
    bytes: u64,
    files: u64,
}
fn physical(path: &Path) -> Result<PathBuf, String> {
    let value = fs::canonicalize(path).map_err(|e| format!("无法读取 {}：{e}", path.display()))?;
    Ok(PathBuf::from(
        value.to_string_lossy().trim_start_matches(r"\\?\"),
    ))
}
fn measure(path: &Path) -> Result<(u64, u64), String> {
    let mut size = 0;
    let mut count = 0;
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                // Independently moved categories remain links. Their bytes are counted at
                // the actual category location, never recursively followed through a parent.
                continue;
            }
        }
        if metadata.is_dir() {
            let (n, c) = measure(&entry.path())?;
            size += n;
            count += c;
        } else if metadata.is_file() {
            size += metadata.len();
            count += 1;
        }
    }
    Ok((size, count))
}
fn locations(app: &tauri::AppHandle) -> Result<Vec<Location>, String> {
    let mut candidates = vec![
        (
            "data",
            "知识、记忆、技能、聊天、扩展与阅读设置",
            crate::data_paths::data_directory(app)?,
        ),
        (
            "config",
            "应用配置",
            crate::data_paths::config_directory(app)?,
        ),
        (
            "cache",
            "界面数据、草稿与缓存",
            crate::data_paths::cache_directory(app)?,
        ),
        (
            "ai",
            "独立 AI 数据位置",
            crate::data_paths::ai_directory(app)?,
        ),
    ];
    let webview = std::env::var_os("WEBVIEW2_USER_DATA_FOLDER")
        .map(PathBuf::from)
        .map(Ok)
        .unwrap_or_else(|| app.path().app_local_data_dir().map_err(|e| e.to_string()))?;
    candidates.push(("webview", "界面与浏览器缓存", webview));
    let ai=crate::data_paths::ai_directory(app)?;
    let store=moyang_ai_core::Store::open(&ai).map_err(|e|e.to_string())?;
    candidates.push(("models","本应用的本地模型",store.model_directory().map_err(|e|e.to_string())?));
    candidates.push(("snapshots","AI 自动快照",ai.join("snapshots")));
    candidates.push(("chat","API 服务与聊天记录",crate::data_paths::config_directory(app)?.join("chat")));
    candidates.push(("extensions","扩展安装与配置",crate::data_paths::config_directory(app)?.join("extensions")));
    candidates.push(("downloads","应用更新与保留版本",crate::online_update::release_root(&std::env::current_exe().map_err(|e|e.to_string())?)?));
    let mut result: Vec<Location> = Vec::new();
    for (key, label, logical) in candidates {
        fs::create_dir_all(&logical).map_err(|e|e.to_string())?;
        let actual = physical(&logical)?;
        if result.iter().any(|p| actual==p.physical) {
            continue;
        }
        let (bytes, files) = measure(&actual)?;
        result.push(Location {
            key: key.into(),
            label: label.into(),
            logical,
            physical: actual,
            bytes,
            files,
        });
    }
    Ok(result)
}
fn work_directory() -> PathBuf {
    std::env::temp_dir().join("moyang-storage-migration")
}
fn helper() -> Result<PathBuf, String> {
    let dir = work_directory();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("migrate-storage.ps1");
    fs::write(&path, include_str!("migrate-storage.ps1")).map_err(|e| e.to_string())?;
    Ok(path)
}
fn command(script: &Path) -> std::process::Command {
    let mut cmd = std::process::Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
    ])
    .arg(script);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd
}

#[tauri::command]
pub async fn storage_info(app: tauri::AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let items = locations(&app)?;
        let report = fs::read_to_string(work_directory().join("result.json"))
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok());
        Ok(json!({"native":true,"locations":items,"report":report,
          "program":std::env::current_exe().ok().and_then(|p|p.parent().map(Path::to_path_buf)),
          "externalModels":std::env::var_os("OLLAMA_MODELS").map(PathBuf::from)}))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn storage_choose_target(
    app: tauri::AppHandle,
    state: State<'_, StorageMigration>,
) -> Result<Option<String>, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("选择新的存储文件夹（使用其中的 MoyangData 子目录）")
            .blocking_pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(selected) = selected else {
        return Ok(None);
    };
    let parent = selected.into_path().map_err(|e| e.to_string())?;
    let target = physical(&parent)?.join("MoyangData");
    *state.0.lock().map_err(|_| "迁移状态不可用")? = Some(target.clone());
    Ok(Some(target.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn storage_prepare(
    app: tauri::AppHandle,
    state: State<'_, StorageMigration>,
    include_models: bool,
    category: Option<String>,
) -> Result<Value, String> {
    let target = state
        .0
        .lock()
        .map_err(|_| "迁移状态不可用")?
        .clone()
        .ok_or("请先选择新的存储文件夹。")?;
    tauri::async_runtime::spawn_blocking(move || {
        let requested=category.as_deref().filter(|s|*s!="all");
        let all_locations=locations(&app)?;
        let models=all_locations.iter().find(|p|p.key=="models").map(|p|p.physical.clone());
        let candidates: Vec<_> = all_locations
            .into_iter()
            .filter(|p| requested.map(|key|p.key==key).unwrap_or(p.key!="downloads" && (include_models || p.key!="models")))
            .collect();
        if candidates.is_empty(){return Err("所选存储分类不存在，请刷新后重试。".into());}
        let items:Vec<_>=candidates.iter().filter(|p|!candidates.iter().any(|other|p.key!=other.key && p.physical.starts_with(&other.physical))).cloned().collect();
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let moves_models=models.is_some_and(|path|items.iter().any(|p|path.starts_with(&p.physical)));
        let plan = json!({"target":target,"items":items,"moves_models":moves_models,"executable":exe,"pid":std::process::id()});
        let script = helper()?;
        let file = work_directory().join(format!("plan-{}.json", std::process::id()));
        fs::write(&file, serde_json::to_vec(&plan).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        let output = command(&script)
            .arg("-PlanPath")
            .arg(&file)
            .arg("-CheckOnly")
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        let checked: Value =
            serde_json::from_slice(&output.stdout).map_err(|e| format!("无法读取迁移检查：{e}"))?;
        Ok(json!({"target":target,"items":items,"bytes":checked["bytes"],"free":checked["free"]}))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn storage_start(
    app: tauri::AppHandle,
    state: State<'_, StorageMigration>,
) -> Result<(), String> {
    let target = state
        .0
        .lock()
        .map_err(|_| "迁移状态不可用")?
        .clone()
        .ok_or("请先检查迁移计划。")?;
    let file = work_directory().join(format!("plan-{}.json", std::process::id()));
    let plan: Value = serde_json::from_slice(&fs::read(&file).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    if plan["target"] != json!(target) {
        return Err("存储位置已变化，请重新检查。".into());
    }
    // The helper revalidates after the process (including SQLite/WebView handles) has exited.
    command(&helper()?)
        .arg("-PlanPath")
        .arg(file)
        .spawn()
        .map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}
