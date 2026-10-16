//! index: extracted from the verified local working copy.
use super::*;

pub(super) fn push_unique(values: &mut Vec<String>, value: String) {
    if !value.is_empty()
        && !values
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(&value))
    {
        values.push(value);
    }
}

pub(super) fn extract_wiki_links(source: &str) -> Vec<String> {
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

pub(super) fn is_external_link(target: &str) -> bool {
    let target = target.trim().to_ascii_lowercase();
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("mailto:")
        || target.starts_with("data:")
        || target.starts_with('#')
        || target.starts_with("//")
}

pub(super) fn markdown_link_end(source: &str, content_start: usize) -> Option<usize> {
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

pub(super) fn extract_markdown_links(source: &str) -> Vec<String> {
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

pub(super) fn clean_tag(value: &str) -> Option<String> {
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

pub(super) fn extract_tags(source: &str) -> Vec<String> {
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
                if token.starts_with('#') && !token.starts_with("##") {
                    if let Some(tag) = clean_tag(token) {
                        push_unique(&mut tags, tag);
                    }
                }
            }
        }
    }

    tags
}

pub(super) fn fallback_title(file: &WorkspaceFile) -> String {
    file.name
        .rsplit_once('.')
        .map(|(stem, _)| stem.to_string())
        .unwrap_or_else(|| file.name.clone())
}

pub(super) fn clean_title(value: &str) -> Option<String> {
    let title = value
        .trim()
        .trim_end_matches('#')
        .trim()
        .trim_matches(|character| matches!(character, '"' | '\''))
        .trim();
    (!title.is_empty()).then(|| title.to_string())
}

pub(super) fn atx_title(line: &str) -> Option<String> {
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

pub(super) fn is_setext_underline(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.len() >= 3
        && (trimmed.chars().all(|character| character == '=')
            || trimmed.chars().all(|character| character == '-'))
}

pub(super) fn extract_title(source: &str, file: &WorkspaceFile) -> String {
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

pub(super) fn index_entry_for_file(file: WorkspaceFile) -> Option<WorkspaceIndexEntry> {
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

pub(super) fn index_workspace_inner(root: PathBuf) -> Result<Vec<WorkspaceIndexEntry>, String> {
    let files = sorted_workspace_files(&root)?;
    let mut entries = Vec::new();

    for file in files {
        if let Some(entry) = index_entry_for_file(file) {
            entries.push(entry);
        }
    }

    Ok(entries)
}

pub(super) fn refresh_workspace_inner(
    root: PathBuf,
    paths: Vec<String>,
) -> Result<WorkspaceRefreshResult, String> {
    let root = fs::canonicalize(&root).map_err(|error| format!("无法确认工作区路径：{error}"))?;
    if !root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }

    // Windows may report a parent and hundreds of children for one operation.
    // Collapse overlapping scopes before scanning; each subtree is read once.
    let mut scopes: Vec<PathBuf> = Vec::new();
    for raw_path in paths {
        let Ok(scope) = normalize_access_path(Path::new(&raw_path)) else {
            continue;
        };
        if scope.strip_prefix(&root).is_ok_and(|relative| {
            relative
                .components()
                .any(|part| should_skip_directory(Path::new(part.as_os_str())))
        }) {
            continue;
        }
        if !access_path_contains(&root, &scope)
            || scopes
                .iter()
                .any(|parent| access_path_contains(parent, &scope))
        {
            continue;
        }
        scopes.retain(|child| !access_path_contains(&scope, child));
        scopes.push(scope);
    }

    let mut scope_paths = Vec::new();
    let mut folder_scope_paths = Vec::new();
    let mut folders = Vec::new();
    let mut files = Vec::new();
    for scope in scopes {
        let display = display_path(&scope);
        if !scope_paths
            .iter()
            .any(|existing| access_path_key(Path::new(existing)) == access_path_key(&scope))
        {
            scope_paths.push(display);
        }

        let folder_scope = if scope.is_dir() {
            Some(scope.clone())
        } else if !scope.is_file() {
            scope
                .parent()
                .filter(|parent| access_path_contains(&root, parent))
                .map(Path::to_path_buf)
        } else {
            None
        };
        if let Some(folder_scope) = folder_scope {
            if !folder_scope_paths.iter().any(|existing| {
                access_path_key(Path::new(existing)) == access_path_key(&folder_scope)
            }) {
                folder_scope_paths.push(display_path(&folder_scope));
                if folder_scope.is_dir() {
                    if folder_scope != root {
                        folders.push(workspace_directory(&root, &folder_scope)?);
                    }
                    collect_workspace_directories(&root, &folder_scope, &mut folders)?;
                }
            }
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

    folders.sort_by_key(|folder| folder.relative_path.to_ascii_lowercase());
    folders.dedup_by(|left, right| {
        access_path_key(Path::new(&left.path)) == access_path_key(Path::new(&right.path))
    });

    let index = files
        .iter()
        .filter_map(|file| index_entry_for_file(file.clone()))
        .collect();

    Ok(WorkspaceRefreshResult {
        scope_paths,
        folder_scope_paths,
        folders,
        files,
        index,
    })
}
