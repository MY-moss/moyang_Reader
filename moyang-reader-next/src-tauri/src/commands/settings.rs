//! settings: extracted from the verified local working copy.
use super::*;

#[tauri::command]
pub fn close_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不可用。".to_string())?;
    window
        .destroy()
        .map_err(|error| format!("关闭窗口失败：{error}"))
}

pub(super) fn app_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    crate::data_paths::config_directory(app)
        .map(|directory| directory.join(APP_SETTINGS_FILE_NAME))
        .map_err(|error| format!("无法定位应用配置目录：{error}"))
}

#[tauri::command]
pub fn read_app_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = app_settings_path(&app)?;
    read_settings_at(&path)
}

fn read_settings_at(path: &Path) -> Result<Option<String>, String> {
    use rusqlite::OptionalExtension;
    let database = path.with_file_name("settings.sqlite");
    if database.is_file() {
        let db = settings_database(&database)?;
        let saved: Option<String> = db
            .query_row("SELECT contents FROM preferences WHERE id=1", [], |row| {
                row.get(0)
            })
            .optional()
            .map_err(|e| format!("读取设置失败：{e}"))?;
        if saved.is_some() {
            return Ok(saved);
        }
    }
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("无法读取应用设置文件信息：{error}")),
    };
    if metadata.len() > MAX_APP_SETTINGS_BYTES as u64 {
        return Err("应用设置文件过大，已拒绝读取。".to_string());
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|error| format!("无法读取应用设置文件：{error}"))
}

#[tauri::command]
pub fn write_app_settings(app: AppHandle, contents: String) -> Result<(), String> {
    if contents.len() > MAX_APP_SETTINGS_BYTES {
        return Err("应用设置内容过大，已拒绝保存。".to_string());
    }
    let path = app_settings_path(&app)?;
    write_settings_at(&path, &contents)
}

fn settings_database(path: &Path) -> Result<rusqlite::Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建设置目录失败：{e}"))?;
    }
    let db = rusqlite::Connection::open(path).map_err(|e| format!("打开设置失败：{e}"))?;
    db.busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS preferences(id INTEGER PRIMARY KEY CHECK(id=1), contents TEXT NOT NULL);").map_err(|e| format!("初始化设置失败：{e}"))?;
    Ok(db)
}
fn write_settings_at(legacy: &Path, contents: &str) -> Result<(), String> {
    // SQLite commits avoid rename-based replacement, which can fail with
    // ERROR_NOT_SAME_DEVICE inside Windows encrypted profile directories.
    let mut db = settings_database(&legacy.with_file_name("settings.sqlite"))?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO preferences(id,contents) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET contents=excluded.contents", [contents]).map_err(|e| format!("保存设置失败：{e}"))?;
    tx.commit().map_err(|e| format!("提交设置失败：{e}"))
}

#[cfg(test)]
mod settings_tests {
    use super::*;
    #[test]
    fn reads_legacy_json_then_persists_transactional_settings_without_changing_legacy() {
        let root = std::env::temp_dir().join(format!(
            "moyang-settings-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).unwrap();
        let legacy = root.join("settings.json");
        fs::write(&legacy, "{\"theme\":\"light\"}").unwrap();
        assert_eq!(
            read_settings_at(&legacy).unwrap().unwrap(),
            "{\"theme\":\"light\"}"
        );
        write_settings_at(&legacy, "{\"theme\":\"dark\"}").unwrap();
        assert_eq!(
            read_settings_at(&legacy).unwrap().unwrap(),
            "{\"theme\":\"dark\"}"
        );
        assert_eq!(
            fs::read_to_string(&legacy).unwrap(),
            "{\"theme\":\"light\"}"
        );
        write_settings_at(&legacy, "{\"theme\":\"system\"}").unwrap();
        assert_eq!(
            read_settings_at(&legacy).unwrap().unwrap(),
            "{\"theme\":\"system\"}"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
