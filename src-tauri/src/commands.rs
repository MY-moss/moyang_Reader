use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::SystemTime;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];
const TEXT_EXTENSIONS: [&str; 3] = ["txt", "text", "log"];
const DOCX_EXTENSIONS: [&str; 1] = ["docx"];
const PDF_EXTENSIONS: [&str; 1] = ["pdf"];
const IMAGE_EXTENSIONS: [&str; 7] = ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"];
const MAX_READ_FILE_BYTES: u64 = 100 * 1024 * 1024;
const MAX_SEARCH_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_INDEX_FILE_BYTES: u64 = 4 * 1024 * 1024;
static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub struct AccessRegistry {
    read_entries: Mutex<Vec<PathBuf>>,
    write_entries: Mutex<Vec<PathBuf>>,
    workspace_entries: Mutex<Vec<PathBuf>>,
}

struct ActiveWorkspaceWatcher {
    root_key: String,
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub struct WorkspaceWatcher {
    current: Mutex<Option<ActiveWorkspaceWatcher>>,
}

#[derive(Default)]
pub struct WorkspaceSearchCache {
    entries: Mutex<HashMap<String, CachedSearchText>>,
}

struct CachedSearchText {
    size: u64,
    modified: Option<SystemTime>,
    source: String,
}

impl WorkspaceSearchCache {
    fn read_text(&self, file: &WorkspaceFile) -> Option<String> {
        let path = PathBuf::from(&file.path);
        let metadata = fs::metadata(&path).ok()?;
        let key = access_path_key(&path);
        let modified = metadata.modified().ok();

        if let Ok(entries) = self.entries.lock() {
            if let Some(cached) = entries.get(&key) {
                if cached.size == metadata.len() && cached.modified == modified {
                    return Some(cached.source.clone());
                }
            }
        }

        let source = read_text_file_inner(path).ok()?;
        if let Ok(mut entries) = self.entries.lock() {
            entries.insert(
                key,
                CachedSearchText {
                    size: metadata.len(),
                    modified,
                    source: source.clone(),
                },
            );
        }
        Some(source)
    }

    fn invalidate_scopes(&self, scopes: &[String]) {
        let Ok(mut entries) = self.entries.lock() else {
            return;
        };
        entries.retain(|path, _| {
            !scopes.iter().any(|scope| {
                access_path_contains(Path::new(scope), Path::new(path))
                    || access_path_contains(
                        Path::new(&display_path(Path::new(scope))),
                        Path::new(&display_path(Path::new(path))),
                    )
            })
        });
    }
}

impl AccessRegistry {
    pub(crate) fn register_path(&self, path: &Path) -> Result<(), String> {
        self.register_read_path(path)?;
        self.register_write_path(path)
    }

    pub(crate) fn register_workspace_path(&self, path: &Path) -> Result<(), String> {
        self.register_path(path)?;
        register_access_entry(&self.workspace_entries, path)
    }

    pub(crate) fn register_document_path(&self, path: &Path) -> Result<(), String> {
        self.register_path(path)?;
        if path.is_file() {
            if let Some(parent) = path.parent() {
                self.register_read_path(parent)?;
            }
        }
        Ok(())
    }

    pub(crate) fn register_read_path(&self, path: &Path) -> Result<(), String> {
        register_access_entry(&self.read_entries, path)
    }

    pub(crate) fn register_write_path(&self, path: &Path) -> Result<(), String> {
        register_access_entry(&self.write_entries, path)
    }

    pub(crate) fn is_read_allowed(&self, path: &Path) -> bool {
        is_access_allowed(&self.read_entries, path)
    }

    pub(crate) fn is_write_allowed(&self, path: &Path) -> bool {
        is_access_allowed(&self.write_entries, path)
    }

    pub(crate) fn is_workspace_allowed(&self, path: &Path) -> bool {
        is_access_allowed(&self.workspace_entries, path)
    }
}

fn register_access_entry(entries: &Mutex<Vec<PathBuf>>, path: &Path) -> Result<(), String> {
    let normalized = normalize_access_path(path)?;
    let mut entries = entries
        .lock()
        .map_err(|_| "文件访问状态不可用。".to_string())?;

    if entries
        .iter()
        .any(|entry| access_path_contains(entry, &normalized))
    {
        return Ok(());
    }

    entries.retain(|entry| !access_path_contains(&normalized, entry));
    entries.push(normalized);
    Ok(())
}

fn is_access_allowed(entries: &Mutex<Vec<PathBuf>>, path: &Path) -> bool {
    let Ok(normalized) = normalize_access_path(path) else {
        return false;
    };
    entries
        .lock()
        .map(|entries| {
            entries
                .iter()
                .any(|entry| access_path_contains(entry, &normalized))
        })
        .unwrap_or(false)
}

fn normalize_access_path(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return fs::canonicalize(path).map_err(|error| format!("无法确认文件路径：{error}"));
    }

    let parent = path
        .parent()
        .ok_or_else(|| "文件路径没有可确认的父目录。".to_string())?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "文件名无法解析。".to_string())?;
    Ok(fs::canonicalize(parent)
        .map_err(|error| format!("无法确认文件父目录：{error}"))?
        .join(file_name))
}

fn access_path_contains(root: &Path, candidate: &Path) -> bool {
    let root = access_path_key(root);
    let candidate = access_path_key(candidate);
    candidate == root || candidate.starts_with(&(root.trim_end_matches('/').to_string() + "/"))
}

fn access_path_key(path: &Path) -> String {
    let value = path.to_string_lossy().replace('\\', "/");
    if cfg!(windows) {
        value.to_ascii_lowercase()
    } else {
        value
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFile {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub size: u64,
    pub kind: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkspaceSearchResult {
    pub file: WorkspaceFile,
    pub preview: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexEntry {
    pub file: WorkspaceFile,
    pub title: String,
    pub links: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRefreshResult {
    pub scope_paths: Vec<String>,
    pub files: Vec<WorkspaceFile>,
    pub index: Vec<WorkspaceIndexEntry>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangeEvent {
    pub root: String,
    pub paths: Vec<String>,
}

fn decode_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        if !(bytes.len() - 2).is_multiple_of(2) {
            return Err("UTF-16 文件末尾存在不完整的字节，无法安全读取。".to_string());
        }
        let values = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]));
        let text = String::from_utf16(values.collect::<Vec<_>>().as_slice())
            .map_err(|error| format!("UTF-16 文件无法解析：{error}"))?;
        return reject_suspicious_binary_text(text);
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        if !(bytes.len() - 2).is_multiple_of(2) {
            return Err("UTF-16 文件末尾存在不完整的字节，无法安全读取。".to_string());
        }
        let values = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]));
        let text = String::from_utf16(values.collect::<Vec<_>>().as_slice())
            .map_err(|error| format!("UTF-16 文件无法解析：{error}"))?;
        return reject_suspicious_binary_text(text);
    }

    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let text = String::from_utf8(bytes[3..].to_vec())
            .map_err(|error| format!("UTF-8 文件无法解析：{error}"))?;
        return reject_suspicious_binary_text(text);
    }

    if let Ok(text) = String::from_utf8(bytes.to_vec()) {
        return reject_suspicious_binary_text(text);
    }

    let (decoded, _, had_errors) = encoding_rs::GB18030.decode(bytes);
    if had_errors {
        return Err("文件不是有效的 UTF-8、UTF-16 或 GB18030 文本。".to_string());
    }
    reject_suspicious_binary_text(decoded.into_owned())
}

fn reject_suspicious_binary_text(text: String) -> Result<String, String> {
    let character_count = text.chars().count();
    let suspicious_count = text
        .chars()
        .filter(|character| {
            *character == '\u{FFFD}'
                || (character.is_control() && !matches!(*character, '\t' | '\n' | '\r'))
        })
        .count();
    let has_nul = text.contains('\0');
    if has_nul
        || (suspicious_count >= 3
            && suspicious_count.saturating_mul(100) >= character_count.max(1).saturating_mul(2))
    {
        return Err(
            "文件内容疑似二进制或损坏文本，已拒绝按文本打开，以避免乱码覆盖原文件。".to_string(),
        );
    }
    Ok(text)
}

#[tauri::command]
pub fn initial_paths(access: State<'_, AccessRegistry>) -> Vec<String> {
    let paths = std::env::args()
        .skip(1)
        .filter(|argument| {
            Path::new(argument).is_file() && is_supported_document_path(Path::new(argument))
        })
        .collect::<Vec<_>>();
    for path in &paths {
        let _ = access.register_document_path(Path::new(path));
    }
    paths
}

#[tauri::command]
pub async fn choose_document_path(
    app: AppHandle,
    access: State<'_, AccessRegistry>,
) -> Result<Option<String>, String> {
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
            .blocking_pick_file()
    })
    .await
    .map_err(|error| format!("打开文件选择器失败：{error}"))?;
    register_selected_path(access, selected, false)
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
            "markdown" => (
                "导出 Markdown",
                "Markdown / 文本",
                &["md", "markdown", "txt"],
            ),
            _ => return Err("不支持的导出格式。".to_string()),
        };

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

fn register_selected_path(
    access: State<'_, AccessRegistry>,
    selected: Option<FilePath>,
    workspace: bool,
) -> Result<Option<String>, String> {
    let Some(selected) = selected else {
        return Ok(None);
    };
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
    Ok(Some(path_string))
}

#[tauri::command]
pub fn close_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不可用。".to_string())?;
    window
        .destroy()
        .map_err(|error| format!("关闭窗口失败：{error}"))
}

#[tauri::command]
pub fn read_text_file(path: String, access: State<'_, AccessRegistry>) -> Result<String, String> {
    if !access.is_read_allowed(Path::new(&path)) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    read_text_file_inner(PathBuf::from(path))
}

fn read_text_file_inner(path: PathBuf) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_READ_FILE_BYTES {
        return Err("文件过大，暂不支持直接打开超过 100 MB 的文本文件。".to_string());
    }
    let bytes = fs::read(&path).map_err(|error| format!("无法读取文件：{error}"))?;
    decode_text(&bytes)
}

#[tauri::command]
pub fn read_binary_file(
    path: String,
    access: State<'_, AccessRegistry>,
) -> Result<tauri::ipc::Response, String> {
    let path = PathBuf::from(path);
    if !access.is_read_allowed(&path) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_READ_FILE_BYTES {
        return Err("文件过大，暂不支持直接打开超过 100 MB 的附件。".to_string());
    }
    fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|error| format!("无法读取文件：{error}"))
}

#[tauri::command]
pub fn path_exists(path: String, access: State<'_, AccessRegistry>) -> bool {
    access.is_read_allowed(Path::new(&path)) && path_exists_inner(Path::new(&path))
}

fn path_exists_inner(path: &Path) -> bool {
    path.exists()
}

#[tauri::command]
pub fn file_size(path: String, access: State<'_, AccessRegistry>) -> Result<u64, String> {
    if !access.is_read_allowed(Path::new(&path)) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    fs::metadata(PathBuf::from(path))
        .map(|metadata| metadata.len())
        .map_err(|error| format!("无法读取文件信息：{error}"))
}

#[tauri::command]
pub fn watch_workspace(
    root: String,
    access: State<'_, AccessRegistry>,
    workspace_watcher: State<'_, WorkspaceWatcher>,
    app: AppHandle,
) -> Result<(), String> {
    let requested_root = PathBuf::from(&root);
    if !access.is_workspace_allowed(&requested_root) {
        return Err("拒绝监听未通过用户选择的工作区。请重新选择文件夹。".to_string());
    }

    let normalized_root = fs::canonicalize(&requested_root)
        .map_err(|error| format!("无法确认工作区路径：{error}"))?;
    if !normalized_root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }

    let event_root = root.clone();
    let watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| {
            let Ok(event) = result else {
                return;
            };

            let mut paths = event
                .paths
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect::<Vec<_>>();
            paths.sort_unstable();
            paths.dedup();
            if paths.is_empty() {
                return;
            }

            let _ = app.emit(
                "workspace-changed",
                WorkspaceChangeEvent {
                    root: event_root.clone(),
                    paths,
                },
            );
        },
        Config::default(),
    )
    .map_err(|error| format!("无法创建工作区监听：{error}"))?;

    let mut watcher = watcher;
    watcher
        .watch(&normalized_root, RecursiveMode::Recursive)
        .map_err(|error| format!("无法监听工作区：{error}"))?;

    let mut current = workspace_watcher
        .current
        .lock()
        .map_err(|_| "工作区监听状态不可用。".to_string())?;
    let previous = current.replace(ActiveWorkspaceWatcher {
        root_key: access_path_key(&requested_root),
        _watcher: watcher,
    });
    drop(current);
    drop(previous);
    Ok(())
}

#[tauri::command]
pub fn unwatch_workspace(
    root: String,
    workspace_watcher: State<'_, WorkspaceWatcher>,
) -> Result<(), String> {
    let root_key = access_path_key(Path::new(&root));
    let mut current = workspace_watcher
        .current
        .lock()
        .map_err(|_| "工作区监听状态不可用。".to_string())?;

    let should_unwatch = current
        .as_ref()
        .map(|active| active.root_key == root_key)
        .unwrap_or(false);
    if should_unwatch {
        current.take();
    }
    Ok(())
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
}

fn document_kind(path: &Path) -> Option<&'static str> {
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

fn should_skip_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| matches!(name, ".git" | ".moyang" | "node_modules" | "target"))
        .unwrap_or(false)
}

fn workspace_file(root: &Path, path: &Path) -> Result<WorkspaceFile, String> {
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
        path: path.to_string_lossy().into_owned(),
        name: name.to_string(),
        relative_path,
        size: metadata.len(),
        kind: document_kind(path).unwrap_or("markdown").to_string(),
    })
}

fn collect_workspace_files(
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

fn sorted_workspace_files(root: &Path) -> Result<Vec<WorkspaceFile>, String> {
    if !root.is_dir() {
        return Err("请选择一个有效的工作区文件夹。".to_string());
    }

    let mut files = Vec::new();
    collect_workspace_files(root, root, &mut files)?;
    files.sort_by_key(|file| file.relative_path.to_ascii_lowercase());
    Ok(files)
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

fn list_workspace_files_inner(root: PathBuf) -> Result<Vec<WorkspaceFile>, String> {
    sorted_workspace_files(&root)
}

#[tauri::command]
pub fn search_workspace(
    root: String,
    query: String,
    access: State<'_, AccessRegistry>,
    cache: State<'_, WorkspaceSearchCache>,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝读取未通过用户选择的工作区。请重新添加文件夹。".to_string());
    }
    search_workspace_inner_with_cache(PathBuf::from(root), query, &cache)
}

#[cfg(test)]
fn search_workspace_inner(
    root: PathBuf,
    query: String,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    let cache = WorkspaceSearchCache::default();
    search_workspace_inner_with_cache(root, query, &cache)
}

fn search_workspace_inner_with_cache(
    root: PathBuf,
    query: String,
    cache: &WorkspaceSearchCache,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let files = sorted_workspace_files(&root)?;
    let mut results = Vec::new();

    for file in files {
        let name_matches = file.name.to_lowercase().contains(&query);
        let preview = if is_supported_text_path(Path::new(&file.path))
            && file.size <= MAX_SEARCH_FILE_BYTES
        {
            cache.read_text(&file).and_then(|source| {
                source
                    .lines()
                    .find(|line| line.to_lowercase().contains(&query))
                    .map(|line| line.trim().chars().take(180).collect::<String>())
            })
        } else {
            None
        };

        if name_matches || preview.is_some() {
            results.push(WorkspaceSearchResult {
                file,
                preview: preview.unwrap_or_else(|| "文件名匹配".to_string()),
            });
        }

        if results.len() >= 100 {
            break;
        }
    }

    Ok(results)
}

fn push_unique(values: &mut Vec<String>, value: String) {
    if !value.is_empty()
        && !values
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(&value))
    {
        values.push(value);
    }
}

fn extract_wiki_links(source: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut cursor = 0;

    while let Some(start_offset) = source[cursor..].find("[[") {
        let start = cursor + start_offset;
        let content_start = start + 2;
        let Some(end_offset) = source[content_start..].find("]]") else {
            break;
        };
        let end = content_start + end_offset;
        let is_embed = start > 0 && source.as_bytes().get(start - 1) == Some(&b'!');
        if !is_embed {
            let target = source[content_start..end]
                .split('|')
                .next()
                .unwrap_or_default()
                .trim();
            push_unique(&mut links, target.to_string());
        }
        cursor = end + 2;
    }

    links
}

fn is_external_link(target: &str) -> bool {
    let target = target.trim().to_ascii_lowercase();
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("mailto:")
        || target.starts_with("data:")
        || target.starts_with('#')
        || target.starts_with("//")
}

fn markdown_link_end(source: &str, content_start: usize) -> Option<usize> {
    let mut depth = 1;
    let mut escaped = false;
    for (offset, character) in source[content_start..].char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if character == '(' {
            depth += 1;
        } else if character == ')' {
            depth -= 1;
            if depth == 0 {
                return Some(content_start + offset);
            }
        }
    }
    None
}

fn extract_markdown_links(source: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut cursor = 0;

    while let Some(marker_offset) = source[cursor..].find("](") {
        let marker = cursor + marker_offset;
        let is_image = source[..marker]
            .rfind('[')
            .and_then(|open| {
                open.checked_sub(1)
                    .map(|before| source.as_bytes()[before] == b'!')
            })
            .unwrap_or(false);
        let content_start = marker + 2;
        let Some(end) = markdown_link_end(source, content_start) else {
            break;
        };
        let mut target = source[content_start..end].trim();
        if let Some(stripped) = target.strip_prefix('<') {
            target = stripped.split('>').next().unwrap_or_default().trim();
        } else {
            target = target.split_whitespace().next().unwrap_or_default();
        }

        if !is_image && !target.is_empty() && !is_external_link(target) {
            push_unique(&mut links, target.to_string());
        }
        cursor = end + 1;
    }

    links
}

fn clean_tag(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches(|character: char| {
        matches!(
            character,
            ',' | '.'
                | ';'
                | ':'
                | '，'
                | '。'
                | '；'
                | '：'
                | ')'
                | '）'
                | ']'
                | '】'
                | '"'
                | '\''
        )
    });
    let tag = trimmed.trim_start_matches('#').trim();
    if tag.is_empty() || tag.starts_with('#') {
        return None;
    }
    if tag
        .chars()
        .all(|character| character.is_alphanumeric() || matches!(character, '_' | '-' | '/'))
    {
        Some(tag.to_string())
    } else {
        None
    }
}

fn extract_tags(source: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut in_code_fence = false;

    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code_fence = !in_code_fence;
            continue;
        }
        if in_code_fence {
            continue;
        }

        if let Some(raw_tags) = trimmed.strip_prefix("tags:") {
            let raw_tags = raw_tags
                .trim()
                .trim_start_matches('[')
                .trim_end_matches(']');
            for raw_tag in raw_tags.split(',') {
                if let Some(tag) = clean_tag(raw_tag) {
                    push_unique(&mut tags, tag);
                }
            }
        }

        if trimmed.starts_with('#') && !trimmed.starts_with("# ") && !trimmed.starts_with("#\t") {
            for token in trimmed.split_whitespace() {
                if let Some(tag) = clean_tag(token) {
                    push_unique(&mut tags, tag);
                }
            }
        }
    }

    tags
}

fn fallback_title(file: &WorkspaceFile) -> String {
    file.name
        .rsplit_once('.')
        .map(|(stem, _)| stem.to_string())
        .unwrap_or_else(|| file.name.clone())
}

fn clean_title(value: &str) -> Option<String> {
    let title = value
        .trim()
        .trim_end_matches('#')
        .trim()
        .trim_matches(|character| matches!(character, '"' | '\''))
        .trim();
    (!title.is_empty()).then(|| title.to_string())
}

fn atx_title(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    let hash_count = trimmed
        .chars()
        .take_while(|character| *character == '#')
        .count();
    if !(1..=6).contains(&hash_count) {
        return None;
    }

    let rest = trimmed.get(hash_count..)?;
    if !rest
        .as_bytes()
        .first()
        .is_some_and(|character| *character == b' ' || *character == b'\t')
    {
        return None;
    }
    clean_title(rest)
}

fn is_setext_underline(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.len() >= 3
        && (trimmed.chars().all(|character| character == '=')
            || trimmed.chars().all(|character| character == '-'))
}

fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    value
        .strip_prefix(r"\\?\")
        .unwrap_or(value.as_ref())
        .to_string()
}

fn extract_title(source: &str, file: &WorkspaceFile) -> String {
    let lines = source.lines().collect::<Vec<_>>();
    if let Some(first) = lines.first().map(|line| line.trim()) {
        if first == "---" || first == "+++" {
            for line in lines.iter().skip(1) {
                let trimmed = line.trim();
                if trimmed == first {
                    break;
                }
                if let Some(value) = trimmed.strip_prefix("title:").and_then(clean_title) {
                    return value;
                }
            }
        }
    }

    for (index, line) in lines.iter().enumerate() {
        if let Some(title) = atx_title(line) {
            return title;
        }
        if index + 1 < lines.len()
            && !line.trim().is_empty()
            && is_setext_underline(lines[index + 1])
        {
            if let Some(title) = clean_title(line) {
                return title;
            }
        }
    }

    fallback_title(file)
}

fn markdown_extension(extension: Option<&str>) -> bool {
    extension
        .map(|value| MARKDOWN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn create_note_parts(target: &str) -> Result<Vec<String>, String> {
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

fn create_markdown_file_inner(
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

#[tauri::command]
pub fn index_workspace(
    root: String,
    access: State<'_, AccessRegistry>,
) -> Result<Vec<WorkspaceIndexEntry>, String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝读取未通过用户选择的工作区。请重新添加文件夹。".to_string());
    }
    index_workspace_inner(PathBuf::from(root))
}

#[tauri::command]
pub fn refresh_workspace(
    root: String,
    paths: Vec<String>,
    access: State<'_, AccessRegistry>,
    cache: State<'_, WorkspaceSearchCache>,
) -> Result<WorkspaceRefreshResult, String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝读取未通过用户选择的工作区。请重新添加工作区。".to_string());
    }
    let result = refresh_workspace_inner(PathBuf::from(root), paths)?;
    cache.invalidate_scopes(&result.scope_paths);
    Ok(result)
}

fn index_entry_for_file(file: WorkspaceFile) -> Option<WorkspaceIndexEntry> {
    if file.kind != "markdown" || file.size > MAX_INDEX_FILE_BYTES {
        return None;
    }

    let source = read_text_file_inner(PathBuf::from(file.path.clone())).ok()?;
    let mut links = extract_wiki_links(&source);
    for link in extract_markdown_links(&source) {
        push_unique(&mut links, link);
    }
    Some(WorkspaceIndexEntry {
        title: extract_title(&source, &file),
        links,
        tags: extract_tags(&source),
        file,
    })
}

fn index_workspace_inner(root: PathBuf) -> Result<Vec<WorkspaceIndexEntry>, String> {
    let files = sorted_workspace_files(&root)?;
    let mut entries = Vec::new();

    for file in files {
        if let Some(entry) = index_entry_for_file(file) {
            entries.push(entry);
        }
    }

    Ok(entries)
}

fn refresh_workspace_inner(
    root: PathBuf,
    paths: Vec<String>,
) -> Result<WorkspaceRefreshResult, String> {
    let root = fs::canonicalize(&root).map_err(|error| format!("无法确认工作区路径：{error}"))?;
    if !root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }

    let mut scope_paths = Vec::new();
    let mut files = Vec::new();
    for raw_path in paths {
        let requested = PathBuf::from(raw_path);
        let Ok(scope) = normalize_access_path(&requested) else {
            continue;
        };
        if !access_path_contains(&root, &scope) {
            continue;
        }

        let display = display_path(&scope);
        if !scope_paths
            .iter()
            .any(|existing| access_path_key(Path::new(existing)) == access_path_key(&scope))
        {
            scope_paths.push(display);
        }

        if scope.is_dir() {
            collect_workspace_files(&root, &scope, &mut files)?;
        } else if scope.is_file() && is_supported_document_path(&scope) {
            files.push(workspace_file(&root, &scope)?);
        }
    }

    files.sort_by_key(|file| file.relative_path.to_ascii_lowercase());
    files.dedup_by(|left, right| {
        access_path_key(Path::new(&left.path)) == access_path_key(Path::new(&right.path))
    });

    let index = files
        .iter()
        .filter_map(|file| index_entry_for_file(file.clone()))
        .collect();

    Ok(WorkspaceRefreshResult {
        scope_paths,
        files,
        index,
    })
}

#[tauri::command]
pub fn write_text_file(
    path: String,
    contents: String,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !access.is_write_allowed(&path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    write_text_file_inner(path, contents)
}

fn write_text_file_inner(path: PathBuf, contents: String) -> Result<(), String> {
    write_bytes_file_inner(path, contents.as_bytes(), true)
}

#[tauri::command]
pub fn write_binary_file(
    path: String,
    contents: Vec<u8>,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !access.is_write_allowed(&path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }
    write_bytes_file_inner(path, &contents, false)
}

fn write_bytes_file_inner(
    path: PathBuf,
    contents: &[u8],
    create_backup: bool,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "文件路径没有父目录。".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "文件名无法解析。".to_string())?;

    if create_backup {
        let backup = parent.join(format!(".{file_name}.moyang.bak"));
        if path.is_file() {
            fs::copy(&path, &backup).map_err(|error| format!("创建备份失败：{error}"))?;
        }
    }

    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp = parent.join(format!(
        ".{file_name}.moyang.tmp-{}-{nonce}",
        std::process::id()
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)
            .map_err(|error| format!("创建临时文件失败：{error}"))?;
        file.write_all(contents)
            .map_err(|error| format!("写入临时文件失败：{error}"))?;
        file.sync_all()
            .map_err(|error| format!("刷新临时文件失败：{error}"))?;
        drop(file);

        replace_file(&temp, &path).map_err(|error| format!("完成文件替换失败：{error}"))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(not(windows))]
fn replace_file(temp: &Path, destination: &Path) -> std::io::Result<()> {
    fs::rename(temp, destination)
}

#[cfg(windows)]
fn replace_file(temp: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temp = temp
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let status = unsafe {
        MoveFileExW(
            temp.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if status == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        access_path_key, clean_tag, create_markdown_file_inner, decode_text,
        extract_markdown_links, extract_tags, extract_title, extract_wiki_links,
        index_workspace_inner, is_supported_document_path, is_supported_text_path,
        list_workspace_files_inner, path_exists_inner, read_text_file_inner,
        refresh_workspace_inner, search_workspace_inner, search_workspace_inner_with_cache,
        should_skip_directory, write_text_file_inner, AccessRegistry, WorkspaceFile,
        WorkspaceSearchCache, MAX_READ_FILE_BYTES, TEMP_FILE_COUNTER,
    };
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::Ordering;

    #[test]
    fn recognizes_supported_document_extensions_case_insensitively() {
        assert!(is_supported_document_path(Path::new("notes/Today.MD")));
        assert!(is_supported_document_path(Path::new(
            "notes/Today.markdown"
        )));
        assert!(is_supported_text_path(Path::new("notes/Today.txt")));
        assert!(is_supported_document_path(Path::new("notes/Guide.DOCX")));
        assert!(is_supported_document_path(Path::new("notes/Guide.PDF")));
        assert!(is_supported_document_path(Path::new("notes/Cover.PNG")));
        assert!(!is_supported_document_path(Path::new("notes/Guide.doc")));
    }

    #[test]
    fn access_registry_keeps_document_reads_wider_than_writes() {
        let root =
            std::env::temp_dir().join(format!("moyang-reader-access-{}", std::process::id()));
        let vault = root.join("vault");
        let note = vault.join("note.md");
        let attachment = vault.join("image.png");
        let sibling = vault.join("other.md");
        let outside = root.join("outside.md");
        fs::create_dir_all(&vault).expect("create access test directory");
        fs::write(&note, "note").expect("write access test note");
        fs::write(&attachment, [0_u8, 1, 2]).expect("write access test attachment");

        let access = AccessRegistry::default();
        access
            .register_document_path(&note)
            .expect("register selected document");

        assert!(access.is_read_allowed(&note));
        assert!(access.is_read_allowed(&attachment));
        assert!(access.is_read_allowed(&sibling));
        assert!(access.is_write_allowed(&note));
        assert!(!access.is_write_allowed(&sibling));
        assert!(!access.is_read_allowed(&outside));
        assert!(!access.is_write_allowed(&outside));
        assert!(!access.is_workspace_allowed(&vault));

        access
            .register_workspace_path(&vault)
            .expect("register selected directory");
        assert!(access.is_write_allowed(&sibling));
        assert!(access.is_workspace_allowed(&vault));

        fs::remove_dir_all(root).expect("remove access test directory");
    }

    #[test]
    fn replaces_existing_file_without_removing_the_original_first() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-atomic-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.load(Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create atomic test directory");
        let path = root.join("note.md");
        fs::write(&path, "old").expect("write original file");

        write_text_file_inner(path.clone(), "new".to_string()).expect("replace file");

        assert_eq!(
            fs::read_to_string(&path).expect("read replaced file"),
            "new"
        );
        assert_eq!(
            fs::read_to_string(root.join(".note.md.moyang.bak")).expect("read backup"),
            "old"
        );
        fs::remove_dir_all(root).expect("remove atomic test directory");
    }

    #[test]
    fn decodes_utf16_and_rejects_incomplete_trailing_bytes() {
        assert_eq!(
            decode_text(&[0xFF, 0xFE, b'A', 0]).expect("decode UTF-16LE"),
            "A"
        );
        assert_eq!(
            decode_text(&[0xFE, 0xFF, 0, b'A']).expect("decode UTF-16BE"),
            "A"
        );
        assert!(decode_text(&[0xFF, 0xFE, b'A']).is_err());
        assert_eq!(
            decode_text("你好".as_bytes()).expect("decode UTF-8"),
            "你好"
        );
        assert_eq!(
            decode_text(&[0xEF, 0xBB, 0xBF, b'B']).expect("decode UTF-8 BOM"),
            "B"
        );
        let (gb18030, _, had_errors) = encoding_rs::GB18030.encode("你好，世界");
        assert!(!had_errors);
        assert_eq!(
            decode_text(gb18030.as_ref()).expect("decode GB18030"),
            "你好，世界"
        );
        assert!(decode_text(&[0, 1, 2, 3]).is_err());
        assert!(decode_text(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0x01]).is_err());
    }

    #[test]
    fn extracts_wiki_links_without_embeds_or_aliases() {
        assert_eq!(
            extract_wiki_links("[[Target|别名]] ![[Cover.png]] [[target]] [[Second#Section]]"),
            vec!["Target", "Second#Section"]
        );
    }

    #[test]
    fn extracts_nested_markdown_links_and_skips_external_or_image_links() {
        assert_eq!(
            extract_markdown_links(
                "[Second](Second.MARKDOWN#Heading) [Guide](docs/Guide(2026).md) [Space](<folder/with space.md>) [web](https://example.com) ![cover](Cover.png)"
            ),
            vec![
                "Second.MARKDOWN#Heading",
                "docs/Guide(2026).md",
                "folder/with space.md"
            ]
        );
    }

    #[test]
    fn extracts_tags_from_frontmatter_style_lines_and_headings() {
        assert_eq!(
            extract_tags(
                "tags: [front, nested/path]\n\n#topic #second\n\n[[README]] #inline\n\n```md\n#inside-code\n```"
            ),
            vec!["front", "nested/path", "topic", "second"]
        );
    }

    #[test]
    fn cleans_valid_tags_and_rejects_invalid_values() {
        assert_eq!(clean_tag(" #topic, "), Some("topic".to_string()));
        assert_eq!(clean_tag("#nested/path"), Some("nested/path".to_string()));
        assert_eq!(clean_tag("#not.valid"), None);
        assert_eq!(clean_tag("#bad#"), None);
        assert_eq!(clean_tag(""), None);
    }

    #[test]
    fn rejects_binary_bytes_from_a_markdown_named_file() {
        let path = std::env::temp_dir().join(format!(
            "moyang-reader-binary-md-{}-{}.md",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::write(&path, [0_u8, 1, 2, 3]).expect("write binary markdown fixture");

        let error = read_text_file_inner(path.clone()).expect_err("reject binary markdown fixture");
        assert!(error.contains("疑似二进制"));
        fs::remove_file(path).expect("remove binary markdown fixture");
    }

    #[test]
    fn extracts_titles_from_frontmatter_atx_and_setext_headings() {
        let file = WorkspaceFile {
            path: "C:/Notes/fallback.md".to_string(),
            name: "fallback.md".to_string(),
            relative_path: "fallback.md".to_string(),
            size: 0,
            kind: "markdown".to_string(),
        };
        assert_eq!(
            extract_title("## Second-level title", &file),
            "Second-level title"
        );
        assert_eq!(extract_title("Setext title\n===\n", &file), "Setext title");
        assert_eq!(
            extract_title("---\ntitle: \"Frontmatter title\"\n---\n# Heading", &file),
            "Frontmatter title"
        );
        assert_eq!(extract_title("body only", &file), "fallback");
    }

    #[test]
    fn rejects_text_files_over_the_read_limit() {
        let path = std::env::temp_dir().join(format!("moyang-reader-large-{}", std::process::id()));
        let file = fs::File::create(&path).expect("create sparse file");
        file.set_len(MAX_READ_FILE_BYTES + 1)
            .expect("grow sparse file");
        let error = read_text_file_inner(path.clone()).expect_err("reject large file");
        assert!(error.contains("100 MB"));
        fs::remove_file(path).expect("remove sparse file");
    }

    #[test]
    fn skips_generated_and_hidden_directories() {
        assert!(should_skip_directory(Path::new("vault/.git")));
        assert!(should_skip_directory(Path::new("vault/node_modules")));
        assert!(!should_skip_directory(Path::new("vault/Notes")));
    }

    #[test]
    fn lists_and_searches_markdown_files_without_generated_directories() {
        let root = std::env::temp_dir().join(format!("moyang-reader-test-{}", std::process::id()));
        let notes = root.join("notes");
        let generated = root.join("node_modules");
        fs::create_dir_all(&notes).expect("create notes directory");
        fs::create_dir_all(&generated).expect("create generated directory");
        fs::write(root.join("README.md"), "入口文档").expect("write root document");
        fs::write(notes.join("Second.MARKDOWN"), "包含needle的内容")
            .expect("write nested document");
        fs::write(notes.join("plain.txt"), "needle in text").expect("write text document");
        fs::write(notes.join("Guide.docx"), [0_u8, 1, 2]).expect("write docx document");
        fs::write(notes.join("Guide.pdf"), [3_u8, 4, 5]).expect("write pdf document");
        fs::write(notes.join("Cover.png"), [6_u8, 7, 8]).expect("write image attachment");
        fs::write(
            notes.join("Linked.md"),
            "# Linked note\n\ntags: [front]\n\n#topic\n\n[[README]] #inline\n\n[Second](Second.MARKDOWN#Heading) [Guide](docs/Guide(2026).md) ![cover](Cover.png) [web](https://example.com)",
        )
        .expect("write linked document");
        fs::write(generated.join("ignored.md"), "needle").expect("write ignored document");

        let root_string = root.to_string_lossy().into_owned();
        let files = list_workspace_files_inner(PathBuf::from(root_string.clone()))
            .expect("list workspace files");
        assert_eq!(files.len(), 7);
        assert!(files
            .iter()
            .any(|file| file.relative_path == "notes/Second.MARKDOWN"));
        assert!(files.iter().any(|file| file.kind == "docx"));
        assert!(files.iter().any(|file| file.kind == "pdf"));
        assert!(files.iter().any(|file| file.kind == "image"));
        let index =
            index_workspace_inner(PathBuf::from(root_string.clone())).expect("index workspace");
        let linked = index
            .iter()
            .find(|entry| entry.file.name == "Linked.md")
            .expect("find linked document");
        assert_eq!(linked.title, "Linked note");
        assert_eq!(
            linked.links,
            vec!["README", "Second.MARKDOWN#Heading", "docs/Guide(2026).md"]
        );
        assert!(linked.tags.iter().any(|tag| tag == "front"));
        assert!(linked.tags.iter().any(|tag| tag == "topic"));
        assert!(!linked.tags.iter().any(|tag| tag == "inline"));
        assert!(path_exists_inner(&root.join("README.md")));
        assert!(path_exists_inner(&root));
        assert!(!path_exists_inner(&root.join("missing.md")));

        let created = create_markdown_file_inner(
            root_string.clone(),
            notes.join("Linked.md").to_string_lossy().into_owned(),
            "Created Note#Section".to_string(),
        )
        .expect("create markdown file");
        assert_eq!(
            fs::canonicalize(&created).expect("canonicalize created note"),
            fs::canonicalize(notes.join("Created Note.md")).expect("canonicalize expected note")
        );
        assert_eq!(
            fs::read_to_string(&created).expect("read created note"),
            "# Created Note\n\n"
        );
        assert!(create_markdown_file_inner(
            root_string.clone(),
            notes.join("Linked.md").to_string_lossy().into_owned(),
            "../outside".to_string(),
        )
        .is_err());
        assert!(create_markdown_file_inner(
            root_string.clone(),
            notes.join("Linked.md").to_string_lossy().into_owned(),
            "Created Note".to_string(),
        )
        .is_err());

        let results = search_workspace_inner(PathBuf::from(root_string), "needle".to_string())
            .expect("search workspace");
        assert_eq!(results.len(), 2);
        assert!(results
            .iter()
            .any(|result| result.file.name == "Second.MARKDOWN"));
        assert!(results.iter().any(|result| result.file.name == "plain.txt"));

        fs::remove_dir_all(root).expect("remove test workspace");
    }

    #[test]
    fn reuses_search_text_cache_and_invalidates_changed_scopes() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-cache-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create search cache workspace");
        let note = root.join("note.txt");
        fs::write(&note, "first needle").expect("write search cache note");

        let cache = WorkspaceSearchCache::default();
        let first = search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
            .expect("search first query");
        assert_eq!(first.len(), 1);
        let cache_key = access_path_key(&note);
        assert_eq!(
            cache
                .entries
                .lock()
                .expect("lock search cache")
                .get(&cache_key)
                .map(|entry| entry.source.as_str()),
            Some("first needle")
        );

        let cached_query =
            search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
                .expect("search cached query");
        assert_eq!(cached_query.len(), 1);

        cache.invalidate_scopes(&[root.to_string_lossy().into_owned()]);
        assert!(cache
            .entries
            .lock()
            .expect("lock invalidated search cache")
            .is_empty());

        fs::write(&note, "second needle").expect("update search cache note");
        let updated = search_workspace_inner_with_cache(root.clone(), "second".to_string(), &cache)
            .expect("search updated query");
        assert_eq!(updated.len(), 1);

        fs::remove_dir_all(root).expect("remove search cache workspace");
    }

    #[test]
    fn refreshes_only_changed_workspace_scopes_and_removes_deleted_files() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-refresh-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let notes = root.join("notes");
        fs::create_dir_all(&notes).expect("create notes directory");
        fs::write(root.join("README.md"), "unchanged").expect("write unchanged document");
        let changed = notes.join("Changed.md");
        fs::write(&changed, "# Before").expect("write changed document");

        let delta =
            refresh_workspace_inner(root.clone(), vec![notes.to_string_lossy().into_owned()])
                .expect("refresh changed directory");
        assert_eq!(delta.files.len(), 1);
        assert_eq!(delta.index.len(), 1);
        assert_eq!(delta.index[0].title, "Before");
        assert!(!delta.files.iter().any(|file| file.name == "README.md"));

        fs::write(&changed, "# After\n\n#topic").expect("update changed document");
        let updated =
            refresh_workspace_inner(root.clone(), vec![changed.to_string_lossy().into_owned()])
                .expect("refresh changed file");
        assert_eq!(updated.index[0].title, "After");
        assert_eq!(updated.index[0].tags, vec!["topic"]);

        fs::remove_file(&changed).expect("remove changed document");
        let removed =
            refresh_workspace_inner(root.clone(), vec![changed.to_string_lossy().into_owned()])
                .expect("refresh deleted file");
        assert_eq!(removed.scope_paths.len(), 1);
        assert!(removed.files.is_empty());
        assert!(removed.index.is_empty());

        fs::remove_dir_all(root).expect("remove refresh workspace");
    }
}
