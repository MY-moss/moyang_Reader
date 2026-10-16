//! entries: extracted from the verified local working copy.
use super::*;

pub(super) fn markdown_extension(extension: Option<&str>) -> bool {
    extension
        .map(|value| MARKDOWN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

pub(super) fn create_note_parts(target: &str) -> Result<Vec<String>, String> {
    let target = target
        .trim()
        .split(['#', '?'])
        .next()
        .unwrap_or_default()
        .trim();
    if target.is_empty() || target.starts_with(['/', '\\']) || target.contains(':') {
        return Err("链接目标不是有效的工作区相对路径。".to_string());
    }

    let mut parts = Vec::new();
    for part in target.split(['/', '\\']) {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            if parts.pop().is_none() {
                return Err("链接不能跳出工作区目录。".to_string());
            }
            continue;
        }
        if part.chars().any(|character| {
            matches!(character, '<' | '>' | '"' | '|' | '?' | '*' | ':') || character == '\0'
        }) {
            return Err("链接目标包含 Windows 不允许的文件名字符。".to_string());
        }
        parts.push(part.to_string());
    }

    if parts.is_empty() {
        return Err("链接目标不能为空。".to_string());
    }

    let last = parts.last_mut().expect("parts is not empty");
    let extension = Path::new(last.as_str())
        .extension()
        .and_then(|extension| extension.to_str());
    if let Some(extension) = extension {
        if !markdown_extension(Some(extension)) {
            return Err("只能创建 Markdown 文档。".to_string());
        }
    } else {
        last.push_str(".md");
    }

    Ok(parts)
}

#[tauri::command]
pub fn create_markdown_file(
    root: String,
    base_file: String,
    target: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝在未通过用户文件夹选择的工作区中创建文档。请重新添加文件夹。".to_string());
    }
    create_markdown_file_inner(root, base_file, target)
}

pub(super) fn create_markdown_file_inner(
    root: String,
    base_file: String,
    target: String,
) -> Result<String, String> {
    let root = fs::canonicalize(PathBuf::from(root))
        .map_err(|error| format!("无法读取工作区目录：{error}"))?;
    let base_file = fs::canonicalize(PathBuf::from(base_file))
        .map_err(|error| format!("无法读取当前文档：{error}"))?;
    if !base_file.starts_with(&root) || !base_file.is_file() {
        return Err("当前文档不在所选工作区内。".to_string());
    }

    let parts = create_note_parts(&target)?;
    let base_directory = base_file
        .parent()
        .ok_or_else(|| "当前文档目录无法解析。".to_string())?;
    let base_relative = base_directory
        .strip_prefix(&root)
        .map_err(|_| "当前文档不在所选工作区内。".to_string())?;
    let mut relative_parts = base_relative
        .components()
        .filter_map(|component| component.as_os_str().to_str().map(str::to_string))
        .collect::<Vec<_>>();
    relative_parts.extend(parts);

    let mut candidate = root.clone();
    for part in &relative_parts {
        candidate.push(part);
    }
    if candidate.extension().is_none() {
        candidate.set_extension("md");
    }
    if !candidate.starts_with(&root) {
        return Err("链接不能跳出工作区目录。".to_string());
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "新文档目录无法解析。".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("无法创建文档目录：{error}"))?;
    let parent = fs::canonicalize(parent).map_err(|error| format!("无法确认文档目录：{error}"))?;
    if !parent.starts_with(&root) {
        return Err("链接不能跳出工作区目录。".to_string());
    }

    let file_name = candidate
        .file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("新文档");
    let contents = format!("# {file_name}\n\n");
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&candidate)
        .map_err(|error| format!("无法创建新文档：{error}"))?;
    file.write_all(contents.as_bytes())
        .map_err(|error| format!("无法写入新文档：{error}"))?;
    file.sync_all()
        .map_err(|error| format!("无法刷新新文档：{error}"))?;

    Ok(display_path(&candidate))
}

pub(super) fn validate_workspace_entry_name(raw_name: &str) -> Result<String, String> {
    let name = raw_name.trim();
    if name.is_empty() || name == "." || name == ".." {
        return Err("名称不能为空，也不能使用 . 或 ..。".to_string());
    }
    if name.contains(['/', '\\']) {
        return Err("名称只能是一层文件名，不能包含路径分隔符。".to_string());
    }
    if name.chars().any(|character| {
        matches!(character, '<' | '>' | '"' | '|' | '?' | '*' | ':') || character == '\0'
    }) {
        return Err("名称包含 Windows 不允许的文件名字符。".to_string());
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err("名称不能以句点或空格结尾。".to_string());
    }

    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    if matches!(
        stem.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    ) {
        return Err("这个名称是 Windows 保留设备名，请换一个名称。".to_string());
    }

    Ok(name.to_string())
}

pub(super) fn resolve_workspace_parent(root: &Path, parent_path: &str) -> Result<PathBuf, String> {
    let parent_path = parent_path.trim().replace('\\', "/");
    if parent_path.starts_with('/') || parent_path.contains(':') {
        return Err("父文件夹必须是工作区内的相对路径。".to_string());
    }

    let mut candidate = root.to_path_buf();
    for part in parent_path.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." || part.contains(['<', '>', '"', '|', '?', '*', ':']) {
            return Err("父文件夹路径不是有效的工作区相对路径。".to_string());
        }
        candidate.push(part);
    }

    let canonical =
        fs::canonicalize(&candidate).map_err(|error| format!("无法读取父文件夹：{error}"))?;
    if !canonical.starts_with(root) || !canonical.is_dir() {
        return Err("父文件夹不在当前工作区内。".to_string());
    }
    Ok(canonical)
}

pub(super) fn create_workspace_note_inner(
    root: String,
    parent_path: String,
    raw_name: String,
) -> Result<String, String> {
    let root = fs::canonicalize(PathBuf::from(root))
        .map_err(|error| format!("无法读取工作区目录：{error}"))?;
    if !root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }
    let parent = resolve_workspace_parent(&root, &parent_path)?;
    let mut name = validate_workspace_entry_name(&raw_name)?;
    if let Some(extension) = Path::new(&name)
        .extension()
        .and_then(|extension| extension.to_str())
    {
        if !markdown_extension(Some(extension)) && !extension.eq_ignore_ascii_case("txt") {
            return Err("新建笔记只能使用 Markdown 或 TXT 扩展名。".to_string());
        }
    } else {
        name.push_str(".md");
    }

    let candidate = parent.join(&name);
    let file_stem = candidate
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("未命名笔记");
    let contents = if candidate
        .extension()
        .and_then(|v| v.to_str())
        .is_some_and(|v| v.eq_ignore_ascii_case("txt"))
    {
        String::new()
    } else {
        format!("# {file_stem}\n\n")
    };
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&candidate)
        .map_err(|error| format!("无法创建新笔记：{error}"))?;
    file.write_all(contents.as_bytes())
        .map_err(|error| format!("无法写入新笔记：{error}"))?;
    file.sync_all()
        .map_err(|error| format!("无法刷新新笔记：{error}"))?;

    Ok(display_path(&candidate))
}

pub(super) fn create_workspace_folder_inner(
    root: String,
    parent_path: String,
    raw_name: String,
) -> Result<String, String> {
    let root = fs::canonicalize(PathBuf::from(root))
        .map_err(|error| format!("无法读取工作区目录：{error}"))?;
    if !root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }
    let parent = resolve_workspace_parent(&root, &parent_path)?;
    let name = validate_workspace_entry_name(&raw_name)?;
    let candidate = parent.join(&name);
    fs::create_dir(&candidate).map_err(|error| format!("无法创建文件夹：{error}"))?;
    Ok(display_path(&candidate))
}

pub(super) fn canonical_workspace_root(raw_root: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(PathBuf::from(raw_root))
        .map_err(|error| format!("无法读取工作区目录：{error}"))?;
    if !root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }
    Ok(root)
}

pub(super) fn resolve_workspace_entry(
    root: &Path,
    raw_entry_path: &str,
) -> Result<PathBuf, String> {
    let entry_path = raw_entry_path.trim().replace('\\', "/");
    if entry_path.is_empty() || entry_path.starts_with('/') || entry_path.contains(':') {
        return Err("工作区条目必须是非空的相对路径。".to_string());
    }

    let mut candidate = root.to_path_buf();
    let mut has_part = false;
    for part in entry_path.split('/') {
        if part.is_empty() {
            continue;
        }
        validate_workspace_entry_name(part)
            .map_err(|_| "工作区条目路径不是有效的相对路径。".to_string())?;
        candidate.push(part);
        has_part = true;
    }
    if !has_part {
        return Err("工作区条目必须是非空的相对路径。".to_string());
    }

    let metadata =
        fs::symlink_metadata(&candidate).map_err(|error| format!("无法读取工作区条目：{error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("出于安全原因，暂不支持重命名或删除符号链接。".to_string());
    }

    let canonical =
        fs::canonicalize(&candidate).map_err(|error| format!("无法确认工作区条目：{error}"))?;
    if !canonical.starts_with(root) {
        return Err("工作区条目不在当前工作区内。".to_string());
    }
    Ok(canonical)
}

pub(super) fn rename_workspace_entry_inner(
    root: String,
    entry_path: String,
    raw_name: String,
) -> Result<String, String> {
    let root = canonical_workspace_root(&root)?;
    let source = resolve_workspace_entry(&root, &entry_path)?;
    let mut name = validate_workspace_entry_name(&raw_name)?;
    let source_is_directory = fs::symlink_metadata(&source)
        .map_err(|error| format!("无法读取工作区条目：{error}"))?
        .is_dir();

    if !source_is_directory && Path::new(&name).extension().is_none() {
        if let Some(extension) = source.extension().and_then(|value| value.to_str()) {
            name.push('.');
            name.push_str(extension);
        }
    }
    if !source_is_directory && !is_supported_document_path(Path::new(&name)) {
        return Err(
            "文件扩展名不受支持，请保留为 Markdown、文本、Word、PDF 或图片文件。".to_string(),
        );
    }

    let parent = source
        .parent()
        .ok_or_else(|| "工作区条目目录无法解析。".to_string())?;
    let destination = parent.join(name);
    if !destination.starts_with(&root) {
        return Err("新名称不能跳出当前工作区。".to_string());
    }
    let changes_only_case =
        cfg!(windows) && access_path_key(&source) == access_path_key(&destination);
    if fs::symlink_metadata(&destination).is_ok() && !changes_only_case {
        return Err("目标名称已经存在，请换一个名称。".to_string());
    }

    fs::rename(&source, &destination).map_err(|error| format!("无法重命名工作区条目：{error}"))?;
    Ok(display_path(&destination))
}

pub(super) fn delete_workspace_entry_inner(root: String, entry_path: String) -> Result<(), String> {
    recycle::move_to_recycle(root, entry_path)
}

pub(super) fn copy_workspace_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir(destination).map_err(|error| format!("无法创建副本文件夹：{error}"))?;
    let result = (|| {
        for entry in fs::read_dir(source).map_err(|error| format!("无法读取源文件夹：{error}"))?
        {
            let entry = entry.map_err(|error| format!("无法读取源文件夹内容：{error}"))?;
            let source_child = entry.path();
            let destination_child = destination.join(entry.file_name());
            let file_type = entry
                .file_type()
                .map_err(|error| format!("无法读取副本内容类型：{error}"))?;
            if file_type.is_symlink() {
                return Err("副本中包含符号链接，出于安全原因无法复制。".to_string());
            }
            if file_type.is_dir() {
                copy_workspace_directory(&source_child, &destination_child)?;
            } else if file_type.is_file() {
                fs::copy(&source_child, &destination_child)
                    .map_err(|error| format!("无法复制文件到副本：{error}"))?;
            } else {
                return Err("副本中包含不支持的文件类型。".to_string());
            }
        }
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(destination);
    }
    result
}

pub(super) fn duplicate_workspace_entry_inner(
    root: String,
    entry_path: String,
    raw_name: String,
) -> Result<String, String> {
    let root = canonical_workspace_root(&root)?;
    let source = resolve_workspace_entry(&root, &entry_path)?;
    let source_metadata =
        fs::symlink_metadata(&source).map_err(|error| format!("无法读取工作区条目：{error}"))?;
    let source_is_directory = source_metadata.is_dir();
    let mut name = validate_workspace_entry_name(&raw_name)?;

    if !source_is_directory && Path::new(&name).extension().is_none() {
        if let Some(extension) = source.extension().and_then(|value| value.to_str()) {
            name.push('.');
            name.push_str(extension);
        }
    }
    if !source_is_directory && !is_supported_document_path(Path::new(&name)) {
        return Err(
            "文件扩展名不受支持，请保留为 Markdown、文本、Word、PDF 或图片文件。".to_string(),
        );
    }

    let parent = source
        .parent()
        .ok_or_else(|| "工作区条目目录无法解析。".to_string())?;
    let destination = parent.join(name);
    if !destination.starts_with(&root) {
        return Err("副本名称不能跳出当前工作区。".to_string());
    }
    if fs::symlink_metadata(&destination).is_ok() {
        return Err("目标名称已经存在，请换一个名称。".to_string());
    }

    if source_is_directory {
        copy_workspace_directory(&source, &destination)?;
    } else {
        fs::copy(&source, &destination).map_err(|error| format!("无法创建文件副本：{error}"))?;
    }
    Ok(display_path(&destination))
}

pub(super) fn reveal_workspace_entry_inner(root: String, entry_path: String) -> Result<(), String> {
    let root = canonical_workspace_root(&root)?;
    let target = if entry_path.trim().is_empty() {
        root
    } else {
        resolve_workspace_entry(&root, &entry_path)?
    };

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        let argument = if target.is_file() {
            format!("/select,{}", target.display())
        } else {
            target.display().to_string()
        };
        Command::new("explorer.exe")
            .creation_flags(0x0800_0000)
            .arg(argument)
            .spawn()
            .map_err(|error| format!("无法打开资源管理器：{error}"))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = target;
        Err("在当前平台无法打开 Windows 资源管理器。".to_string())
    }
}

#[tauri::command]
pub fn create_workspace_note(
    root: String,
    parent_path: String,
    name: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝在未通过用户文件夹选择的工作区中创建笔记。请重新添加文件夹。".to_string());
    }
    create_workspace_note_inner(root, parent_path, name)
}

#[tauri::command]
pub fn create_workspace_folder(
    root: String,
    parent_path: String,
    name: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err(
            "拒绝在未通过用户文件夹选择的工作区中创建文件夹。请重新添加文件夹。".to_string(),
        );
    }
    create_workspace_folder_inner(root, parent_path, name)
}

#[tauri::command]
pub fn rename_workspace_entry(
    patches: Option<Vec<rename::LinkPatch>>,
    root: String,
    entry_path: String,
    name: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝修改未通过用户文件夹选择的工作区。请重新添加文件夹。".to_string());
    }
    rename::rename_with_links(root, entry_path, name, patches.unwrap_or_default())
}

#[tauri::command]
pub fn delete_workspace_entry(
    root: String,
    entry_path: String,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝删除未通过用户文件夹选择的工作区内容。请重新添加文件夹。".to_string());
    }
    delete_workspace_entry_inner(root, entry_path)
}

#[tauri::command]
pub fn duplicate_workspace_entry(
    root: String,
    entry_path: String,
    name: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝在未通过用户文件夹选择的工作区中创建副本。请重新添加文件夹。".to_string());
    }
    duplicate_workspace_entry_inner(root, entry_path, name)
}

#[tauri::command]
pub fn reveal_workspace_entry(
    root: String,
    entry_path: String,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝打开未通过用户选择的工作区路径。请重新添加文件夹。".to_string());
    }
    reveal_workspace_entry_inner(root, entry_path)
}
