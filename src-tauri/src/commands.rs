use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];
const TEXT_EXTENSIONS: [&str; 3] = ["txt", "text", "log"];
const DOCX_EXTENSIONS: [&str; 1] = ["docx"];
const PDF_EXTENSIONS: [&str; 1] = ["pdf"];
const IMAGE_EXTENSIONS: [&str; 7] = ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"];
const MAX_READ_FILE_BYTES: u64 = 100 * 1024 * 1024;
const MAX_SEARCH_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_INDEX_FILE_BYTES: u64 = 4 * 1024 * 1024;

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

fn decode_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        if (bytes.len() - 2) % 2 != 0 {
            return Err("UTF-16 文件末尾存在不完整的字节，无法安全读取。".to_string());
        }
        let values = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]));
        return String::from_utf16(values.collect::<Vec<_>>().as_slice())
            .map_err(|error| format!("UTF-16 文件无法解析：{error}"));
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        if (bytes.len() - 2) % 2 != 0 {
            return Err("UTF-16 文件末尾存在不完整的字节，无法安全读取。".to_string());
        }
        let values = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]));
        return String::from_utf16(values.collect::<Vec<_>>().as_slice())
            .map_err(|error| format!("UTF-16 文件无法解析：{error}"));
    }

    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8(bytes[3..].to_vec())
            .map_err(|error| format!("UTF-8 文件无法解析：{error}"));
    }

    if let Ok(text) = String::from_utf8(bytes.to_vec()) {
        return Ok(text);
    }

    let (decoded, _, had_errors) = encoding_rs::GB18030.decode(bytes);
    if had_errors {
        return Err("文件不是有效的 UTF-8、UTF-16 或 GB18030 文本。".to_string());
    }
    Ok(decoded.into_owned())
}

#[tauri::command]
pub fn initial_paths() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|argument| {
            Path::new(argument).is_file() && is_supported_document_path(Path::new(argument))
        })
        .collect()
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_READ_FILE_BYTES {
        return Err("文件过大，暂不支持直接打开超过 100 MB 的文本文件。".to_string());
    }
    let bytes = fs::read(&path).map_err(|error| format!("无法读取文件：{error}"))?;
    decode_text(&bytes)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn file_size(path: String) -> Result<u64, String> {
    fs::metadata(PathBuf::from(path))
        .map(|metadata| metadata.len())
        .map_err(|error| format!("无法读取文件信息：{error}"))
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
pub fn list_workspace_files(root: String) -> Result<Vec<WorkspaceFile>, String> {
    sorted_workspace_files(&PathBuf::from(root))
}

#[tauri::command]
pub fn search_workspace(root: String, query: String) -> Result<Vec<WorkspaceSearchResult>, String> {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let files = sorted_workspace_files(&PathBuf::from(root))?;
    let mut results = Vec::new();

    for file in files {
        let name_matches = file.name.to_lowercase().contains(&query);
        let preview = if is_supported_text_path(Path::new(&file.path))
            && file.size <= MAX_SEARCH_FILE_BYTES
        {
            read_text_file(file.path.clone()).ok().and_then(|source| {
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
pub fn index_workspace(root: String) -> Result<Vec<WorkspaceIndexEntry>, String> {
    let files = sorted_workspace_files(&PathBuf::from(root))?;
    let mut entries = Vec::new();

    for file in files {
        if file.kind != "markdown" || file.size > MAX_INDEX_FILE_BYTES {
            continue;
        }

        let source = match read_text_file(file.path.clone()) {
            Ok(source) => source,
            Err(_) => continue,
        };
        let mut links = extract_wiki_links(&source);
        for link in extract_markdown_links(&source) {
            push_unique(&mut links, link);
        }
        entries.push(WorkspaceIndexEntry {
            title: extract_title(&source, &file),
            links,
            tags: extract_tags(&source),
            file,
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    let parent = path
        .parent()
        .ok_or_else(|| "文件路径没有父目录。".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "文件名无法解析。".to_string())?;

    let backup = parent.join(format!(".{file_name}.moyang.bak"));
    if path.is_file() {
        fs::copy(&path, &backup).map_err(|error| format!("创建备份失败：{error}"))?;
    }

    let temp = parent.join(format!(".{file_name}.moyang.tmp"));
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temp)
        .map_err(|error| format!("创建临时文件失败：{error}"))?;
    file.write_all(contents.as_bytes())
        .map_err(|error| format!("写入临时文件失败：{error}"))?;
    file.sync_all()
        .map_err(|error| format!("刷新临时文件失败：{error}"))?;
    drop(file);

    if path.exists() {
        fs::remove_file(&path).map_err(|error| format!("替换原文件失败：{error}"))?;
    }
    fs::rename(&temp, &path).map_err(|error| format!("完成文件替换失败：{error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        create_markdown_file, decode_text, extract_title, index_workspace,
        is_supported_document_path, is_supported_text_path, list_workspace_files, path_exists,
        read_text_file, search_workspace, should_skip_directory, WorkspaceFile,
        MAX_READ_FILE_BYTES,
    };
    use std::fs;
    use std::path::Path;

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
        let error =
            read_text_file(path.to_string_lossy().into_owned()).expect_err("reject large file");
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
        let files = list_workspace_files(root_string.clone()).expect("list workspace files");
        assert_eq!(files.len(), 7);
        assert!(files
            .iter()
            .any(|file| file.relative_path == "notes/Second.MARKDOWN"));
        assert!(files.iter().any(|file| file.kind == "docx"));
        assert!(files.iter().any(|file| file.kind == "pdf"));
        assert!(files.iter().any(|file| file.kind == "image"));
        let index = index_workspace(root_string.clone()).expect("index workspace");
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
        assert!(path_exists(
            root.join("README.md").to_string_lossy().into_owned()
        ));
        assert!(path_exists(root.to_string_lossy().into_owned()));
        assert!(!path_exists(
            root.join("missing.md").to_string_lossy().into_owned()
        ));

        let created = create_markdown_file(
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
        assert!(create_markdown_file(
            root_string.clone(),
            notes.join("Linked.md").to_string_lossy().into_owned(),
            "../outside".to_string(),
        )
        .is_err());
        assert!(create_markdown_file(
            root_string.clone(),
            notes.join("Linked.md").to_string_lossy().into_owned(),
            "Created Note".to_string(),
        )
        .is_err());

        let results =
            search_workspace(root_string, "needle".to_string()).expect("search workspace");
        assert_eq!(results.len(), 2);
        assert!(results
            .iter()
            .any(|result| result.file.name == "Second.MARKDOWN"));
        assert!(results.iter().any(|result| result.file.name == "plain.txt"));

        fs::remove_dir_all(root).expect("remove test workspace");
    }
}
