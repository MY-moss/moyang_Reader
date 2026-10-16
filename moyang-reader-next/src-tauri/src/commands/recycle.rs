use super::*;
use serde_json::{json, Value};

fn now() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
fn base(root: &Path) -> Result<PathBuf, String> {
    let path = root.join(".moyang").join("recycle");
    fs::create_dir_all(&path).map_err(|e| format!("无法创建回收站：{e}"))?;
    let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    if !canonical.starts_with(root) {
        return Err("回收站路径不在阅读库内".into());
    }
    Ok(canonical)
}
pub(super) fn move_to_recycle(root: String, entry_path: String) -> Result<(), String> {
    let root = entries::canonical_workspace_root(&root)?;
    let source = entries::resolve_workspace_entry(&root, &entry_path)?;
    if source.starts_with(root.join(".moyang")) {
        return Err("不能删除阅读库内部数据目录".into());
    }
    let directory = base(&root)?.join(format!(
        "{}-{}",
        now(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&directory).map_err(|e| e.to_string())?;
    let manifest = json!({"id":directory.file_name().unwrap().to_string_lossy(),"path":entry_path,"deletedAt":now(),"name":source.file_name().unwrap().to_string_lossy(),"folder":source.is_dir()});
    files::write_text_file_inner(directory.join("entry.json"), manifest.to_string())?;
    fs::rename(&source, directory.join("content"))
        .map_err(|e| format!("无法移入回收站，原文件仍保留：{e}"))?;
    Ok(())
}
pub(super) fn list(root: &str) -> Result<Vec<Value>, String> {
    let root = entries::canonical_workspace_root(root)?;
    let directory = base(&root)?;
    let mut result = Vec::new();
    for entry in fs::read_dir(&directory).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if fs::symlink_metadata(&path)
            .map_err(|e| e.to_string())?
            .file_type()
            .is_symlink()
        {
            continue;
        }
        if path.join("content").exists() {
            if let Ok(text) = fs::read_to_string(path.join("entry.json")) {
                if let Ok(value) = serde_json::from_str::<Value>(&text) {
                    if value["deletedAt"].as_u64().is_some_and(|time| {
                        now().saturating_sub(time as u128) > 30 * 24 * 60 * 60 * 1000
                    }) && fs::canonicalize(&path)
                        .map_err(|e| e.to_string())?
                        .starts_with(&directory)
                    {
                        fs::remove_dir_all(&path)
                            .map_err(|e| format!("无法清理过期回收内容：{e}"))?;
                        continue;
                    }
                    result.push(value);
                }
            }
        }
    }
    result.sort_by_key(|item| std::cmp::Reverse(item["deletedAt"].as_u64().unwrap_or(0)));
    Ok(result)
}
pub(super) fn restore(root: &str, id: &str) -> Result<String, String> {
    let root = entries::canonical_workspace_root(root)?;
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit() || c == '-') {
        return Err("无效回收记录".into());
    }
    let recycle = base(&root)?;
    let directory = fs::canonicalize(recycle.join(id)).map_err(|e| e.to_string())?;
    if !directory.starts_with(&recycle) {
        return Err("回收记录路径无效".into());
    }
    let item: Value = serde_json::from_str(
        &fs::read_to_string(directory.join("entry.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let relative = item["path"]
        .as_str()
        .ok_or("缺少原始路径")?
        .replace('\\', "/");
    if relative
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == ".." || part.contains(':'))
    {
        return Err("原始路径无效".into());
    }
    let mut destination = root.join(&relative);
    let parent = destination.parent().ok_or("原始目录无效")?;
    // Validate the nearest existing ancestor before recreating missing folders.
    let mut ancestor = parent;
    while !ancestor.exists() {
        ancestor = ancestor.parent().ok_or("原始目录无效")?;
    }
    if !fs::canonicalize(ancestor)
        .map_err(|e| e.to_string())?
        .starts_with(&root)
    {
        return Err("恢复位置不在阅读库内".into());
    }
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    if destination.exists() {
        let stem = destination
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("恢复文件");
        let extension = if item["folder"].as_bool() == Some(true) {
            String::new()
        } else {
            destination
                .extension()
                .map(|v| format!(".{}", v.to_string_lossy()))
                .unwrap_or_default()
        };
        destination = parent.join(format!("{stem}（恢复 {}）{extension}", now()));
    }
    if destination.exists() {
        return Err("恢复名称已存在，请重试".into());
    }
    fs::rename(directory.join("content"), &destination)
        .map_err(|e| format!("恢复失败，回收内容仍保留：{e}"))?;
    let _ = fs::remove_file(directory.join("entry.json"));
    let _ = fs::remove_dir(directory);
    Ok(display_path(&destination))
}

pub(super) fn preview(root: &str, id: &str) -> Result<Value, String> {
    let root = entries::canonical_workspace_root(root)?;
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit() || c == '-') {
        return Err("无效回收记录".into());
    }
    let recycle = base(&root)?;
    let directory = fs::canonicalize(recycle.join(id)).map_err(|e| e.to_string())?;
    let content = fs::canonicalize(directory.join("content")).map_err(|e| e.to_string())?;
    if !directory.starts_with(&recycle) || !content.starts_with(&directory) {
        return Err("回收记录路径无效".into());
    }
    let item: Value = serde_json::from_str(
        &fs::read_to_string(directory.join("entry.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let mut children = Vec::new();
    if content.is_dir() {
        for entry in fs::read_dir(&content).map_err(|e| e.to_string())?.take(200) {
            children.push(
                entry
                    .map_err(|e| e.to_string())?
                    .file_name()
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        children.sort();
    }
    Ok(
        json!({"path": display_path(&content), "name": item["name"], "folder": content.is_dir(), "children": children}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restores_with_a_new_name_when_original_path_is_occupied() {
        let root = std::env::temp_dir().join(format!("moyang-recycle-test-{}", now()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("a.md"), "original").unwrap();
        move_to_recycle(display_path(&root), "a.md".into()).unwrap();
        assert!(!root.join("a.md").exists());
        let items = list(&display_path(&root)).unwrap();
        fs::write(root.join("a.md"), "new").unwrap();
        let restored = restore(&display_path(&root), items[0]["id"].as_str().unwrap()).unwrap();
        assert_eq!(fs::read_to_string(restored).unwrap(), "original");
        assert_eq!(fs::read_to_string(root.join("a.md")).unwrap(), "new");
        assert!(list(&display_path(&root)).unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }
}
