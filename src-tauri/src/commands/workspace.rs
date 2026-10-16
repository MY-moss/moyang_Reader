//! workspace: extracted from the verified local working copy.
use super::*;

pub(super) fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
}

pub(super) fn document_kind(path: &Path) -> Option<&'static str> {
    let extension = extension(path)?;
    if MARKDOWN_EXTENSIONS.contains(&extension.as_str()) {
        return Some("markdown");
    }
    if TEXT_EXTENSIONS.contains(&extension.as_str()) {
        return Some("text");
    }
    if DOCX_EXTENSIONS.contains(&extension.as_str()) {
        return Some("docx");
    }
    if PDF_EXTENSIONS.contains(&extension.as_str()) {
        return Some("pdf");
    }
    if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Some("image");
    }
    None
}

pub fn is_supported_text_path(path: &Path) -> bool {
    matches!(document_kind(path), Some("markdown" | "text"))
}

pub fn is_supported_document_path(path: &Path) -> bool {
    document_kind(path).is_some()
}

pub(super) fn should_skip_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| matches!(name, ".git" | ".moyang" | "node_modules" | "target"))
        .unwrap_or(false)
}

pub(super) fn workspace_file(root: &Path, path: &Path) -> Result<WorkspaceFile, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "工作区中存在无法解析名称的文件。".to_string())?;
    let relative_path = path
        .strip_prefix(root)
        .map_err(|error| format!("无法计算工作区相对路径：{error}"))?
        .to_string_lossy()
        .replace('\\', "/");

    Ok(WorkspaceFile {
        path: display_path(path),
        name: name.to_string(),
        relative_path,
        size: metadata.len(),
        kind: document_kind(path).unwrap_or("markdown").to_string(),
    })
}

pub(super) fn collect_workspace_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<WorkspaceFile>,
) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| format!("无法读取工作区目录：{error}"))?
    {
        let entry = entry.map_err(|error| format!("无法读取工作区条目：{error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("无法读取工作区条目类型：{error}"))?;

        if file_type.is_dir() {
            if !should_skip_directory(&path) {
                collect_workspace_files(root, &path, files)?;
            }
        } else if file_type.is_file() && is_supported_document_path(&path) {
            files.push(workspace_file(root, &path)?);
        }
    }

    Ok(())
}

pub(super) fn workspace_directory(root: &Path, path: &Path) -> Result<WorkspaceDirectory, String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "工作区中存在无法解析名称的文件夹。".to_string())?;
    let relative_path = path
        .strip_prefix(root)
        .map_err(|error| format!("无法计算工作区文件夹相对路径：{error}"))?
        .to_string_lossy()
        .replace('\\', "/");

    Ok(WorkspaceDirectory {
        path: path.to_string_lossy().into_owned(),
        name: name.to_string(),
        relative_path,
    })
}

pub(super) fn collect_workspace_directories(
    root: &Path,
    directory: &Path,
    directories: &mut Vec<WorkspaceDirectory>,
) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| format!("无法读取工作区目录：{error}"))?
    {
        let entry = entry.map_err(|error| format!("无法读取工作区条目：{error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("无法读取工作区条目类型：{error}"))?;

        if file_type.is_dir() && !should_skip_directory(&path) {
            directories.push(workspace_directory(root, &path)?);
            collect_workspace_directories(root, &path, directories)?;
        }
    }

    Ok(())
}

pub(super) fn sorted_workspace_files(root: &Path) -> Result<Vec<WorkspaceFile>, String> {
    if !root.is_dir() {
        return Err("请选择一个有效的工作区文件夹。".to_string());
    }

    let mut files = Vec::new();
    collect_workspace_files(root, root, &mut files)?;
    files.sort_by_key(|file| file.relative_path.to_ascii_lowercase());
    Ok(files)
}

pub(super) fn sorted_workspace_directories(root: &Path) -> Result<Vec<WorkspaceDirectory>, String> {
    if !root.is_dir() {
        return Err("请选择一个有效的工作区文件夹。".to_string());
    }

    let mut directories = Vec::new();
    collect_workspace_directories(root, root, &mut directories)?;
    directories.sort_by_key(|directory| directory.relative_path.to_ascii_lowercase());
    Ok(directories)
}

#[tauri::command]
pub fn list_workspace_files(
    root: String,
    access: State<'_, AccessRegistry>,
) -> Result<Vec<WorkspaceFile>, String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝读取未通过用户选择的工作区。请重新添加文件夹。".to_string());
    }
    list_workspace_files_inner(PathBuf::from(root))
}

pub(super) fn list_workspace_files_inner(root: PathBuf) -> Result<Vec<WorkspaceFile>, String> {
    sorted_workspace_files(&root)
}

#[tauri::command]
pub fn list_workspace_directories(
    root: String,
    access: State<'_, AccessRegistry>,
) -> Result<Vec<WorkspaceDirectory>, String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝读取未通过用户选择的工作区。请重新添加文件夹。".to_string());
    }
    let root = fs::canonicalize(PathBuf::from(root))
        .map_err(|error| format!("无法确认工作区路径：{error}"))?;
    sorted_workspace_directories(&root)
}

pub(super) fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{unc}");
    }
    value
        .strip_prefix(r"\\?\")
        .unwrap_or(value.as_ref())
        .to_string()
}
