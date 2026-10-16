//! dialogs: extracted from the verified local working copy.
use super::*;

#[tauri::command]
pub fn initial_paths(access: State<'_, AccessRegistry>) -> Vec<OpenPath> {
    let paths = collect_open_paths(std::env::args().skip(1));
    for path in &paths {
        let _ = register_open_path(access.inner(), path);
    }
    paths
}

#[tauri::command]
pub fn resolve_open_paths(paths: Vec<String>, access: State<'_, AccessRegistry>) -> Vec<OpenPath> {
    let paths = collect_open_paths(paths);
    for path in &paths {
        let _ = register_open_path(access.inner(), path);
    }
    paths
}

pub(crate) fn collect_open_paths<I>(arguments: I) -> Vec<OpenPath>
where
    I: IntoIterator<Item = String>,
{
    arguments
        .into_iter()
        .filter_map(|argument| {
            let path = Path::new(&argument);
            if path.is_dir() {
                return Some(OpenPath {
                    path: argument,
                    kind: OpenPathKind::Workspace,
                });
            }
            if path.is_file() && is_supported_document_path(path) {
                return Some(OpenPath {
                    path: argument,
                    kind: OpenPathKind::Document,
                });
            }
            None
        })
        .collect()
}

pub(crate) fn register_open_path(access: &AccessRegistry, path: &OpenPath) -> Result<(), String> {
    match path.kind {
        OpenPathKind::Document => access.register_document_path(Path::new(&path.path)),
        OpenPathKind::Workspace => access.register_workspace_path(Path::new(&path.path)),
    }
}

#[tauri::command]
pub async fn choose_document_paths(
    app: AppHandle,
    access: State<'_, AccessRegistry>,
) -> Result<Vec<String>, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("打开文档")
            .add_filter(
                "文档",
                &[
                    "md", "markdown", "mdown", "mkd", "txt", "text", "log", "docx", "pdf", "avif",
                    "gif", "jpeg", "jpg", "png", "svg", "webp",
                ],
            )
            .blocking_pick_files()
    })
    .await
    .map_err(|error| format!("打开文件选择器失败：{error}"))?;
    register_selected_paths(access, selected, false)
}

#[tauri::command]
pub async fn choose_workspace_path(
    app: AppHandle,
    access: State<'_, AccessRegistry>,
) -> Result<Option<String>, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("添加阅读库文件夹")
            .blocking_pick_folder()
    })
    .await
    .map_err(|error| format!("打开文件夹选择器失败：{error}"))?;
    register_selected_path(access, selected, true)
}

#[tauri::command]
pub fn authorize_stored_path(
    path: String,
    workspace: bool,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    authorize_stored_path_inner(PathBuf::from(path), workspace, access.inner())
}

pub(super) fn authorize_stored_path_inner(
    path: PathBuf,
    workspace: bool,
    access: &AccessRegistry,
) -> Result<String, String> {
    let path =
        fs::canonicalize(&path).map_err(|_| "记住的路径已不存在，请重新选择。".to_string())?;
    if workspace {
        if !path.is_dir() {
            return Err("记住的阅读库路径不是文件夹，请重新选择。".to_string());
        }
        access.register_workspace_path(&path)?;
    } else {
        if !path.is_file() || !is_supported_document_path(&path) {
            return Err("记住的文档已不存在或格式不受支持，请重新选择。".to_string());
        }
        access.register_document_path(&path)?;
    }

    Ok(display_path(&path))
}

#[tauri::command]
pub async fn choose_save_path(
    app: AppHandle,
    default_path: String,
    format: String,
    access: State<'_, AccessRegistry>,
) -> Result<Option<String>, String> {
    let (title, filter_name, extensions): (&str, &str, &'static [&'static str]) =
        match format.as_str() {
            "html" => ("导出 HTML", "HTML 网页", &["html", "htm"]),
            "docx" => ("导出 Word", "Word 文档", &["docx"]),
            "pdf" => ("导出 PDF", "PDF 文件", &["pdf"]),
            "json" => ("导出备份", "JSON 备份", &["json"]),
            "zip" => ("导出技能包", "ZIP 技能包", &["zip"]),
            "resource" => ("保存资源文件", "所有文件", &["*"]),
            "markdown" => (
                "导出 Markdown",
                "Markdown / 文本",
                &["md", "markdown", "txt"],
            ),
            _ => return Err("不支持的导出格式。".to_string()),
        };

    #[cfg(feature = "wdio")]
    if let Some(export_root) = std::env::var_os("MOYANG_DESKTOP_E2E_EXPORT_ROOT") {
        let default = PathBuf::from(&default_path);
        let file_name = default
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "桌面测试无法解析导出文件名。".to_string())?;
        let path = PathBuf::from(export_root).join(file_name);
        return register_selected_path(access, Some(FilePath::Path(path)), false);
    }

    let selected = tauri::async_runtime::spawn_blocking(move || {
        let default = PathBuf::from(default_path);
        let mut dialog = app
            .dialog()
            .file()
            .set_title(title)
            .add_filter(filter_name, extensions);
        if let Some(parent) = default
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        {
            dialog = dialog.set_directory(parent);
        }
        if let Some(file_name) = default.file_name().and_then(|name| name.to_str()) {
            dialog = dialog.set_file_name(file_name);
        }
        dialog.blocking_save_file()
    })
    .await
    .map_err(|error| format!("打开保存位置选择器失败：{error}"))?;
    register_selected_path(access, selected, false)
}

pub(super) fn register_selected_path(
    access: State<'_, AccessRegistry>,
    selected: Option<FilePath>,
    workspace: bool,
) -> Result<Option<String>, String> {
    let Some(selected) = selected else {
        return Ok(None);
    };
    register_selected_file_path(access.inner(), selected, workspace).map(Some)
}

pub(super) fn register_selected_paths(
    access: State<'_, AccessRegistry>,
    selected: Option<Vec<FilePath>>,
    workspace: bool,
) -> Result<Vec<String>, String> {
    selected
        .unwrap_or_default()
        .into_iter()
        .map(|selected| register_selected_file_path(access.inner(), selected, workspace))
        .collect()
}

pub(super) fn register_selected_file_path(
    access: &AccessRegistry,
    selected: FilePath,
    workspace: bool,
) -> Result<String, String> {
    let path = selected
        .into_path()
        .map_err(|_| "系统返回的选择路径不可访问。".to_string())?;
    let path_string = path
        .to_str()
        .ok_or_else(|| "选择的路径包含无法处理的字符。".to_string())?
        .to_string();
    if path.is_file() {
        if workspace {
            return Err("工作区选择器必须返回文件夹。".to_string());
        }
        access.register_document_path(&path)?;
    } else {
        if workspace {
            access.register_workspace_path(&path)?;
        } else {
            access.register_path(&path)?;
        }
    }
    Ok(path_string)
}
