use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
#[cfg(test)]
use std::sync::atomic::AtomicUsize;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use std::{fs::File, io::Read, process::Command};

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
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
const MAX_SEARCH_CACHE_ENTRIES: usize = 256;
const MAX_SEARCH_CACHE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_SEARCH_INDEX_ROOTS: usize = 8;
const MAX_SEARCH_INDEX_POSTINGS: usize = 500_000;
const MAX_SEARCH_INDEX_TOKENS_PER_FILE: usize = 100_000;
const MAX_SEARCH_INDEX_TOKEN_CHARS: usize = 256;
const SEARCH_INDEX_CACHE_VERSION: u32 = 4;
const MAX_PERSISTED_SEARCH_INDEX_BYTES: u64 = 64 * 1024 * 1024;
const MAX_PERSISTED_SEARCH_INDEX_FILES: usize = 50_000;
const MAX_FILE_LIST_CACHE_ENTRIES: usize = 32;
const MAX_PDF_HTML_BYTES: usize = 32 * 1024 * 1024;
const MAX_APP_SETTINGS_BYTES: usize = 256 * 1024;
const APP_SETTINGS_FILE_NAME: &str = "settings.json";
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
    file_lists: Mutex<HashMap<String, CachedWorkspaceFileList>>,
    search_indexes: Mutex<HashMap<String, CachedSearchIndex>>,
    event_driven_roots: Mutex<HashSet<String>>,
    access_counter: AtomicU64,
    #[cfg(test)]
    metadata_checks: AtomicUsize,
    #[cfg(test)]
    text_reads: AtomicUsize,
    #[cfg(test)]
    directory_stamp_checks: AtomicUsize,
}

struct CachedSearchText {
    size: u64,
    modified: Option<SystemTime>,
    source: String,
    memory_bytes: u64,
    last_used: u64,
}

#[derive(Clone, PartialEq, Eq)]
struct CachedDirectoryStamp {
    path: PathBuf,
    modified: SystemTime,
}

struct CachedWorkspaceFileList {
    files: Vec<WorkspaceFile>,
    directories: Vec<CachedDirectoryStamp>,
    last_used: u64,
}

#[derive(Default)]
struct CachedSearchIndex {
    files: HashMap<String, IndexedSearchFile>,
    unindexed_files: HashSet<String>,
    postings: HashMap<String, HashSet<String>>,
    posting_count: usize,
    file_access_counter: u64,
    last_used: u64,
    disabled: bool,
    file_snapshot: Option<Vec<SearchIndexFileStamp>>,
}

#[derive(Clone, PartialEq, Eq)]
struct SearchIndexFileStamp {
    path: String,
    size: u64,
}

struct IndexedSearchFile {
    size: u64,
    modified: Option<SystemTime>,
    tokens: HashSet<String>,
    last_used: u64,
}

#[derive(Deserialize)]
struct PersistedSearchIndex {
    version: u32,
    root: String,
    disabled: bool,
    files: Vec<PersistedIndexedSearchFile>,
    unindexed_files: Vec<String>,
}

#[derive(Deserialize)]
struct PersistedIndexedSearchFile {
    path: String,
    size: u64,
    modified_nanos: Option<u64>,
    tokens: Vec<String>,
    last_used: u64,
}

#[derive(Serialize)]
struct SearchIndexSnapshot<'a> {
    version: u32,
    root: String,
    disabled: bool,
    files: Vec<PersistedIndexedSearchFileSnapshot<'a>>,
    unindexed_files: Vec<&'a String>,
}

#[derive(Serialize)]
struct PersistedIndexedSearchFileSnapshot<'a> {
    path: &'a str,
    size: u64,
    modified_nanos: Option<u64>,
    tokens: Vec<&'a String>,
    last_used: u64,
}

fn collect_workspace_directory_stamps(
    directory: &Path,
    stamps: &mut Vec<CachedDirectoryStamp>,
) -> Result<(), String> {
    let modified = fs::metadata(directory)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| format!("无法读取工作区目录时间：{error}"))?;
    stamps.push(CachedDirectoryStamp {
        path: directory.to_path_buf(),
        modified,
    });

    for entry in fs::read_dir(directory).map_err(|error| format!("无法读取工作区目录：{error}"))?
    {
        let entry = entry.map_err(|error| format!("无法读取工作区条目：{error}"))?;
        let path = entry.path();
        if entry
            .file_type()
            .map_err(|error| format!("无法读取工作区条目类型：{error}"))?
            .is_dir()
            && !should_skip_directory(&path)
        {
            collect_workspace_directory_stamps(&path, stamps)?;
        }
    }

    Ok(())
}

fn workspace_directory_stamps(root: &Path) -> Result<Vec<CachedDirectoryStamp>, String> {
    let mut stamps = Vec::new();
    collect_workspace_directory_stamps(root, &mut stamps)?;
    Ok(stamps)
}

fn prune_search_entries(entries: &mut HashMap<String, CachedSearchText>) {
    while entries.len() > MAX_SEARCH_CACHE_ENTRIES
        || entries
            .values()
            .map(|entry| entry.memory_bytes)
            .sum::<u64>()
            > MAX_SEARCH_CACHE_BYTES
    {
        let Some(oldest_key) = entries
            .iter()
            .min_by_key(|(_, entry)| entry.last_used)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        entries.remove(&oldest_key);
    }
}

fn prune_file_lists(file_lists: &mut HashMap<String, CachedWorkspaceFileList>) {
    while file_lists.len() > MAX_FILE_LIST_CACHE_ENTRIES {
        let Some(oldest_key) = file_lists
            .iter()
            .min_by_key(|(_, entry)| entry.last_used)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        file_lists.remove(&oldest_key);
    }
}

fn prune_search_indexes(search_indexes: &mut HashMap<String, CachedSearchIndex>) {
    while search_indexes.len() > MAX_SEARCH_INDEX_ROOTS {
        let Some(oldest_key) = search_indexes
            .iter()
            .min_by_key(|(_, entry)| entry.last_used)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        search_indexes.remove(&oldest_key);
    }
}

fn is_cjk_search_char(character: char) -> bool {
    matches!(
        character,
        '\u{3400}'..='\u{4DBF}'
            | '\u{4E00}'..='\u{9FFF}'
            | '\u{F900}'..='\u{FAFF}'
            | '\u{20000}'..='\u{2FA1F}'
    )
}

fn is_ascii_search_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

fn insert_search_token(tokens: &mut HashSet<String>, token: String) -> bool {
    if token.is_empty() {
        return true;
    }
    if token.chars().count() > MAX_SEARCH_INDEX_TOKEN_CHARS {
        return false;
    }
    tokens.insert(token);
    tokens.len() <= MAX_SEARCH_INDEX_TOKENS_PER_FILE
}

fn source_search_tokens(source: &str) -> Option<HashSet<String>> {
    let mut tokens = HashSet::new();
    let mut ascii_word = String::new();
    let mut previous_cjk = None;

    for character in source.to_lowercase().chars() {
        if is_ascii_search_char(character) {
            previous_cjk = None;
            ascii_word.push(character);
            if ascii_word.chars().count() > MAX_SEARCH_INDEX_TOKEN_CHARS {
                return None;
            }
            continue;
        }

        if !ascii_word.is_empty()
            && !insert_search_token(&mut tokens, std::mem::take(&mut ascii_word))
        {
            return None;
        }

        if is_cjk_search_char(character) {
            if let Some(previous) = previous_cjk {
                if !insert_search_token(&mut tokens, format!("{previous}{character}")) {
                    return None;
                }
            }
            previous_cjk = Some(character);
        } else {
            previous_cjk = None;
        }
    }

    if !ascii_word.is_empty() && !insert_search_token(&mut tokens, ascii_word) {
        return None;
    }

    Some(tokens)
}

fn search_index_file_snapshot(files: &[WorkspaceFile]) -> Vec<SearchIndexFileStamp> {
    files
        .iter()
        .filter(|file| {
            is_supported_text_path(Path::new(&file.path)) && file.size <= MAX_SEARCH_FILE_BYTES
        })
        .map(|file| SearchIndexFileStamp {
            path: access_path_key(Path::new(&file.path)),
            size: file.size,
        })
        .collect()
}

fn system_time_marker(modified: Option<SystemTime>) -> Option<u64> {
    modified
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| duration.as_nanos().try_into().ok())
}

fn marker_system_time(marker: Option<u64>) -> Option<SystemTime> {
    marker.and_then(|value| UNIX_EPOCH.checked_add(Duration::from_nanos(value)))
}

fn persistent_search_index_key(root: &Path) -> String {
    let mut hash = 14_695_981_039_346_656_037_u64;
    for byte in access_path_key(root).as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1_099_511_628_211_u64);
    }
    format!("{hash:016x}")
}

fn persistent_search_index_path(cache_directory: &Path, root: &Path) -> PathBuf {
    cache_directory
        .join("search-index")
        .join(format!("{}.json", persistent_search_index_key(root)))
}

fn next_indexed_file_access(index: &mut CachedSearchIndex) -> u64 {
    let access = index.file_access_counter;
    index.file_access_counter = index.file_access_counter.saturating_add(1);
    access
}

fn store_unindexed_file(
    index: &mut CachedSearchIndex,
    path: String,
    size: u64,
    modified: Option<SystemTime>,
) {
    let last_used = next_indexed_file_access(index);
    index.unindexed_files.insert(path.clone());
    index.files.insert(
        path,
        IndexedSearchFile {
            size,
            modified,
            tokens: HashSet::new(),
            last_used,
        },
    );
}

fn oldest_indexed_file(index: &CachedSearchIndex) -> Option<String> {
    index
        .files
        .iter()
        .filter(|(_, file)| !file.tokens.is_empty())
        .min_by(|(left_path, left), (right_path, right)| {
            left.last_used
                .cmp(&right.last_used)
                .then_with(|| left_path.cmp(right_path))
        })
        .map(|(path, _)| path.clone())
}

fn demote_indexed_file(index: &mut CachedSearchIndex, path: &str) -> bool {
    let Some(file) = index.files.get_mut(path) else {
        return false;
    };
    if file.tokens.is_empty() {
        return false;
    }

    let tokens = std::mem::take(&mut file.tokens);
    for token in tokens {
        if let Some(paths) = index.postings.get_mut(&token) {
            if paths.remove(path) {
                index.posting_count = index.posting_count.saturating_sub(1);
            }
            if paths.is_empty() {
                index.postings.remove(&token);
            }
        }
    }
    index.unindexed_files.insert(path.to_string());
    true
}

fn touch_indexed_file(index: &mut CachedSearchIndex, path: &str) {
    if index.unindexed_files.contains(path)
        || !index
            .files
            .get(path)
            .map(|file| !file.tokens.is_empty())
            .unwrap_or(false)
    {
        return;
    }

    let last_used = next_indexed_file_access(index);
    if let Some(file) = index.files.get_mut(path) {
        file.last_used = last_used;
    }
}

fn add_indexed_file_with_tokens(
    index: &mut CachedSearchIndex,
    path: String,
    size: u64,
    modified: Option<SystemTime>,
    tokens: HashSet<String>,
) -> bool {
    add_indexed_file_with_limit(
        index,
        path,
        size,
        modified,
        tokens,
        MAX_SEARCH_INDEX_POSTINGS,
    )
}

fn add_indexed_file_with_limit(
    index: &mut CachedSearchIndex,
    path: String,
    size: u64,
    modified: Option<SystemTime>,
    tokens: HashSet<String>,
    posting_limit: usize,
) -> bool {
    remove_indexed_file(index, &path);
    if tokens.len() > MAX_SEARCH_INDEX_TOKENS_PER_FILE
        || tokens
            .iter()
            .any(|token| token.chars().count() > MAX_SEARCH_INDEX_TOKEN_CHARS)
    {
        return false;
    }

    let additional_postings = tokens
        .iter()
        .filter(|token| {
            !index
                .postings
                .get(*token)
                .map(|paths| paths.contains(&path))
                .unwrap_or(false)
        })
        .count();

    while index.posting_count.saturating_add(additional_postings) > posting_limit {
        let Some(oldest_path) = oldest_indexed_file(index) else {
            break;
        };
        if !demote_indexed_file(index, &oldest_path) {
            break;
        }
    }

    if index.posting_count.saturating_add(additional_postings) > posting_limit {
        store_unindexed_file(index, path, size, modified);
        return true;
    }

    let path_key = path.clone();
    let last_used = next_indexed_file_access(index);
    for token in &tokens {
        let paths = index.postings.entry(token.clone()).or_default();
        if paths.insert(path.clone()) {
            index.posting_count += 1;
        }
    }
    index.files.insert(
        path,
        IndexedSearchFile {
            size,
            modified,
            tokens,
            last_used,
        },
    );
    index.unindexed_files.remove(&path_key);
    true
}

fn load_persisted_search_index(cache_directory: &Path, root: &Path) -> Option<CachedSearchIndex> {
    let path = persistent_search_index_path(cache_directory, root);
    let metadata = fs::metadata(&path).ok()?;
    if metadata.len() > MAX_PERSISTED_SEARCH_INDEX_BYTES {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    let snapshot = serde_json::from_slice::<PersistedSearchIndex>(&bytes).ok()?;
    if snapshot.version != SEARCH_INDEX_CACHE_VERSION
        || snapshot.root != access_path_key(root)
        || snapshot.files.len() > MAX_PERSISTED_SEARCH_INDEX_FILES
        || snapshot.unindexed_files.len() > MAX_PERSISTED_SEARCH_INDEX_FILES
    {
        return None;
    }

    let mut index = CachedSearchIndex {
        disabled: snapshot.disabled,
        ..CachedSearchIndex::default()
    };
    if index.disabled {
        return Some(index);
    }

    let mut persisted_files = snapshot.files;
    persisted_files.sort_by(|left, right| {
        left.last_used
            .cmp(&right.last_used)
            .then_with(|| left.path.cmp(&right.path))
    });
    for file in persisted_files {
        let path = file.path;
        let last_used = file.last_used;
        let tokens = file.tokens.into_iter().collect::<HashSet<_>>();
        if !add_indexed_file_with_tokens(
            &mut index,
            path.clone(),
            file.size,
            marker_system_time(file.modified_nanos),
            tokens,
        ) {
            return None;
        }
        if let Some(indexed_file) = index.files.get_mut(&path) {
            indexed_file.last_used = last_used;
        }
        index.file_access_counter = index.file_access_counter.max(last_used.saturating_add(1));
    }
    index.unindexed_files = snapshot.unindexed_files.into_iter().collect();
    if !index
        .unindexed_files
        .iter()
        .all(|path| index.files.contains_key(path))
    {
        return None;
    }
    Some(index)
}

fn persist_search_index(cache_directory: &Path, root: &Path, index: &CachedSearchIndex) {
    let directory = cache_directory.join("search-index");
    if fs::create_dir_all(&directory).is_err() {
        return;
    }

    let snapshot = SearchIndexSnapshot {
        version: SEARCH_INDEX_CACHE_VERSION,
        root: access_path_key(root),
        disabled: index.disabled,
        files: index
            .files
            .iter()
            .map(|(path, file)| PersistedIndexedSearchFileSnapshot {
                path,
                size: file.size,
                modified_nanos: system_time_marker(file.modified),
                tokens: file.tokens.iter().collect(),
                last_used: file.last_used,
            })
            .collect(),
        unindexed_files: index.unindexed_files.iter().collect(),
    };
    let Ok(bytes) = serde_json::to_vec(&snapshot) else {
        return;
    };
    if bytes.len() as u64 > MAX_PERSISTED_SEARCH_INDEX_BYTES {
        return;
    }

    let path = persistent_search_index_path(cache_directory, root);
    let temporary_path = path.with_extension(format!(
        "json.tmp-{}",
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    if fs::write(&temporary_path, bytes).is_ok() {
        let _ = fs::rename(temporary_path, path);
    }
}

fn remove_indexed_file(index: &mut CachedSearchIndex, path: &str) {
    index.unindexed_files.remove(path);
    let Some(file) = index.files.remove(path) else {
        return;
    };

    for token in file.tokens {
        if let Some(paths) = index.postings.get_mut(&token) {
            if paths.remove(path) {
                index.posting_count = index.posting_count.saturating_sub(1);
            }
            if paths.is_empty() {
                index.postings.remove(&token);
            }
        }
    }
}

fn add_indexed_file(
    index: &mut CachedSearchIndex,
    path: String,
    size: u64,
    modified: Option<SystemTime>,
    source: &str,
) -> bool {
    let Some(tokens) = source_search_tokens(source) else {
        store_unindexed_file(index, path, size, modified);
        return true;
    };
    add_indexed_file_with_tokens(index, path, size, modified, tokens)
}

impl WorkspaceSearchCache {
    fn enable_event_driven_root(&self, root: &Path) {
        let root_key = access_path_key(root);
        self.invalidate_scopes(std::slice::from_ref(&root_key));
        if let Ok(mut roots) = self.event_driven_roots.lock() {
            roots.clear();
            roots.insert(root_key);
        }
    }

    fn disable_event_driven_root(&self, root: &Path) {
        if let Ok(mut roots) = self.event_driven_roots.lock() {
            roots.remove(&access_path_key(root));
        }
        self.invalidate_scopes(&[root.to_string_lossy().into_owned()]);
    }

    fn is_event_driven_root(&self, root: &Path) -> bool {
        self.event_driven_roots
            .lock()
            .map(|roots| roots.contains(&access_path_key(root)))
            .unwrap_or(false)
    }

    fn next_access(&self) -> u64 {
        self.access_counter.fetch_add(1, Ordering::Relaxed)
    }

    fn list_files(&self, root: &Path) -> Result<Vec<WorkspaceFile>, String> {
        let key = access_path_key(root);
        let access = self.next_access();
        let event_driven = self.is_event_driven_root(root);
        #[cfg(test)]
        if !event_driven {
            self.directory_stamp_checks.fetch_add(1, Ordering::Relaxed);
        }
        let current_directories = if event_driven {
            None
        } else {
            workspace_directory_stamps(root).ok()
        };
        if let Ok(file_lists) = self.file_lists.lock() {
            if let Some(cached) = file_lists.get(&key) {
                let cache_is_valid = if event_driven {
                    root.is_dir()
                } else {
                    current_directories
                        .as_ref()
                        .map(|directories| directories == &cached.directories)
                        .unwrap_or(false)
                };
                if cache_is_valid {
                    let files = cached.files.clone();
                    drop(file_lists);
                    if let Ok(mut file_lists) = self.file_lists.lock() {
                        if let Some(cached) = file_lists.get_mut(&key) {
                            cached.last_used = access;
                        }
                    }
                    return Ok(files);
                }
            }
        }

        let files = sorted_workspace_files(root)?;
        let directories = if event_driven {
            Vec::new()
        } else {
            workspace_directory_stamps(root).unwrap_or_default()
        };
        if event_driven || !directories.is_empty() {
            if let Ok(mut file_lists) = self.file_lists.lock() {
                file_lists.insert(
                    key,
                    CachedWorkspaceFileList {
                        files: files.clone(),
                        directories,
                        last_used: access,
                    },
                );
                prune_file_lists(&mut file_lists);
            }
        }
        Ok(files)
    }

    fn read_text(&self, file: &WorkspaceFile) -> Option<String> {
        let path = PathBuf::from(&file.path);
        let key = access_path_key(&path);
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => {
                if let Ok(mut entries) = self.entries.lock() {
                    entries.remove(&key);
                }
                return None;
            }
        };
        let modified = metadata.modified().ok();
        let access = self.next_access();

        if let Ok(mut entries) = self.entries.lock() {
            if let Some(cached) = entries.get(&key) {
                if cached.size == metadata.len() && cached.modified == modified {
                    let source = cached.source.clone();
                    drop(entries);
                    if let Ok(mut entries) = self.entries.lock() {
                        if let Some(cached) = entries.get_mut(&key) {
                            cached.last_used = access;
                        }
                    }
                    return Some(source);
                }
            }
            entries.remove(&key);
        }

        #[cfg(test)]
        self.text_reads.fetch_add(1, Ordering::Relaxed);
        let source = read_text_file_inner(path).ok()?;
        if let Ok(mut entries) = self.entries.lock() {
            entries.insert(
                key,
                CachedSearchText {
                    size: metadata.len(),
                    modified,
                    source: source.clone(),
                    memory_bytes: source.len() as u64,
                    last_used: access,
                },
            );
            prune_search_entries(&mut entries);
        }
        Some(source)
    }

    fn refresh_search_index(
        &self,
        root: &Path,
        files: &[WorkspaceFile],
        persistence_directory: Option<&Path>,
    ) {
        let key = access_path_key(root);
        let access = self.next_access();
        let index = if let Ok(mut indexes) = self.search_indexes.lock() {
            indexes.remove(&key)
        } else {
            return;
        };
        let mut index = index
            .or_else(|| {
                persistence_directory
                    .and_then(|directory| load_persisted_search_index(directory, root))
            })
            .unwrap_or_default();
        let file_snapshot = search_index_file_snapshot(files);

        if !index.disabled
            && self.is_event_driven_root(root)
            && index.file_snapshot.as_ref() == Some(&file_snapshot)
        {
            index.last_used = access;
            if let Ok(mut indexes) = self.search_indexes.lock() {
                indexes.insert(key, index);
                prune_search_indexes(&mut indexes);
            }
            return;
        }

        if !index.disabled {
            let eligible_paths = files
                .iter()
                .filter(|file| {
                    is_supported_text_path(Path::new(&file.path))
                        && file.size <= MAX_SEARCH_FILE_BYTES
                })
                .map(|file| access_path_key(Path::new(&file.path)))
                .collect::<HashSet<_>>();
            let stale_paths = index
                .files
                .keys()
                .filter(|path| !eligible_paths.contains(*path))
                .cloned()
                .collect::<Vec<_>>();
            for path in stale_paths {
                remove_indexed_file(&mut index, &path);
            }

            for file in files.iter().filter(|file| {
                is_supported_text_path(Path::new(&file.path)) && file.size <= MAX_SEARCH_FILE_BYTES
            }) {
                let path = access_path_key(Path::new(&file.path));
                let Ok(metadata) = fs::metadata(&file.path) else {
                    remove_indexed_file(&mut index, &path);
                    continue;
                };
                #[cfg(test)]
                self.metadata_checks.fetch_add(1, Ordering::Relaxed);
                let modified = metadata.modified().ok();
                if index
                    .files
                    .get(&path)
                    .map(|cached| cached.size == metadata.len() && cached.modified == modified)
                    .unwrap_or(false)
                {
                    continue;
                }

                remove_indexed_file(&mut index, &path);
                if let Some(source) = self.read_text(file) {
                    if !add_indexed_file(&mut index, path, metadata.len(), modified, &source) {
                        index.disabled = true;
                        index.files.clear();
                        index.unindexed_files.clear();
                        index.postings.clear();
                        index.posting_count = 0;
                        break;
                    }
                } else {
                    store_unindexed_file(&mut index, path, metadata.len(), modified);
                }
            }
        }

        if !index.disabled {
            index.file_snapshot = Some(file_snapshot);
        }

        index.last_used = access;
        if let Some(directory) = persistence_directory {
            persist_search_index(directory, root, &index);
        }
        if let Ok(mut indexes) = self.search_indexes.lock() {
            indexes.insert(key, index);
            prune_search_indexes(&mut indexes);
        }
    }

    fn content_candidates(&self, root: &Path, query: &str) -> Option<HashSet<String>> {
        if query.chars().count() < 2 {
            return None;
        }

        let key = access_path_key(root);
        let mut indexes = self.search_indexes.lock().ok()?;
        let index = indexes.get_mut(&key)?;
        if index.disabled {
            return None;
        }

        let tokens = source_search_tokens(query)?;
        if tokens.is_empty() {
            return None;
        }

        let mut candidates: Option<HashSet<String>> = None;
        let mut missing_cjk_token = false;
        for token in tokens {
            let paths = if token.is_ascii() {
                if token.chars().count() < 2 {
                    return None;
                }
                let mut paths = HashSet::new();
                for (indexed_token, indexed_paths) in &index.postings {
                    if indexed_token.is_ascii() && indexed_token.contains(&token) {
                        paths.extend(indexed_paths.iter().cloned());
                    }
                }
                paths
            } else if let Some(paths) = index.postings.get(&token) {
                paths.clone()
            } else {
                missing_cjk_token = true;
                continue;
            };
            candidates = Some(match candidates {
                Some(current) => current.intersection(&paths).cloned().collect(),
                None => paths,
            });
        }

        let fallback_paths = index.unindexed_files.clone();
        if missing_cjk_token {
            for path in &fallback_paths {
                touch_indexed_file(index, path);
            }
            return Some(fallback_paths);
        }
        let mut candidates = candidates.unwrap_or_default();
        candidates.extend(fallback_paths);
        for path in &candidates {
            touch_indexed_file(index, path);
        }
        Some(candidates)
    }

    fn invalidate_scopes(&self, scopes: &[String]) {
        if let Ok(mut entries) = self.entries.lock() {
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

        if let Ok(mut file_lists) = self.file_lists.lock() {
            file_lists.retain(|root, _| {
                !scopes.iter().any(|scope| {
                    access_path_contains(Path::new(scope), Path::new(root))
                        || access_path_contains(Path::new(root), Path::new(scope))
                        || access_path_contains(
                            Path::new(&display_path(Path::new(scope))),
                            Path::new(&display_path(Path::new(root))),
                        )
                        || access_path_contains(
                            Path::new(&display_path(Path::new(root))),
                            Path::new(&display_path(Path::new(scope))),
                        )
                })
            });
        }

        if let Ok(mut search_indexes) = self.search_indexes.lock() {
            search_indexes.retain(|root, _| {
                !scopes.iter().any(|scope| {
                    access_path_contains(Path::new(scope), Path::new(root))
                        || access_path_contains(Path::new(root), Path::new(scope))
                        || access_path_contains(
                            Path::new(&display_path(Path::new(scope))),
                            Path::new(&display_path(Path::new(root))),
                        )
                        || access_path_contains(
                            Path::new(&display_path(Path::new(root))),
                            Path::new(&display_path(Path::new(scope))),
                        )
                })
            });
        }
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

    // File-system watchers can report a child path after its parent directory
    // has already been removed. Walk up to the nearest existing ancestor and
    // append the missing suffix so deleted entries can still invalidate the
    // correct workspace scope.
    let mut missing_components = Vec::new();
    let mut ancestor = path;
    while !ancestor.exists() {
        let component = ancestor
            .file_name()
            .ok_or_else(|| "文件名无法解析。".to_string())?;
        missing_components.push(component.to_os_string());
        ancestor = ancestor
            .parent()
            .ok_or_else(|| "文件路径没有可确认的父目录。".to_string())?;
    }

    let mut normalized =
        fs::canonicalize(ancestor).map_err(|error| format!("无法确认文件父目录：{error}"))?;
    for component in missing_components.iter().rev() {
        normalized.push(component);
    }
    Ok(normalized)
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
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDirectory {
    pub path: String,
    pub name: String,
    pub relative_path: String,
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
    pub folder_scope_paths: Vec<String>,
    pub folders: Vec<WorkspaceDirectory>,
    pub files: Vec<WorkspaceFile>,
    pub index: Vec<WorkspaceIndexEntry>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangeEvent {
    pub root: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OpenPathKind {
    Document,
    Workspace,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenPath {
    pub path: String,
    pub kind: OpenPathKind,
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

fn authorize_stored_path_inner(
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
            "json" => ("导出设置备份", "Moyang Reader 设置", &["json"]),
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

fn register_selected_path(
    access: State<'_, AccessRegistry>,
    selected: Option<FilePath>,
    workspace: bool,
) -> Result<Option<String>, String> {
    let Some(selected) = selected else {
        return Ok(None);
    };
    register_selected_file_path(access.inner(), selected, workspace).map(Some)
}

fn register_selected_paths(
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

fn register_selected_file_path(
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

#[tauri::command]
pub fn close_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不可用。".to_string())?;
    window
        .destroy()
        .map_err(|error| format!("关闭窗口失败：{error}"))
}

fn app_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(APP_SETTINGS_FILE_NAME))
        .map_err(|error| format!("无法定位应用配置目录：{error}"))
}

#[tauri::command]
pub fn read_app_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = app_settings_path(&app)?;
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
    write_bytes_file_inner(path, contents.as_bytes(), false)
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

#[derive(Debug, Serialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified_ms: Option<u64>,
}

#[tauri::command]
pub fn file_metadata(
    path: String,
    access: State<'_, AccessRegistry>,
) -> Result<FileMetadata, String> {
    let path = PathBuf::from(path);
    if !access.is_read_allowed(&path) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }

    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| duration.as_millis().try_into().ok());

    Ok(FileMetadata {
        size: metadata.len(),
        modified_ms,
    })
}

#[tauri::command]
pub fn watch_workspace(
    root: String,
    access: State<'_, AccessRegistry>,
    workspace_watcher: State<'_, WorkspaceWatcher>,
    cache: State<'_, WorkspaceSearchCache>,
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
    let event_app = app.clone();
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

            if let Some(cache) = event_app.try_state::<WorkspaceSearchCache>() {
                cache.invalidate_scopes(&paths);
            }
            let _ = event_app.emit(
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
    cache.enable_event_driven_root(&requested_root);
    Ok(())
}

#[tauri::command]
pub fn unwatch_workspace(
    root: String,
    workspace_watcher: State<'_, WorkspaceWatcher>,
    cache: State<'_, WorkspaceSearchCache>,
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
        cache.disable_event_driven_root(Path::new(&root));
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

fn workspace_directory(root: &Path, path: &Path) -> Result<WorkspaceDirectory, String> {
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

fn collect_workspace_directories(
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

fn sorted_workspace_files(root: &Path) -> Result<Vec<WorkspaceFile>, String> {
    if !root.is_dir() {
        return Err("请选择一个有效的工作区文件夹。".to_string());
    }

    let mut files = Vec::new();
    collect_workspace_files(root, root, &mut files)?;
    files.sort_by_key(|file| file.relative_path.to_ascii_lowercase());
    Ok(files)
}

fn sorted_workspace_directories(root: &Path) -> Result<Vec<WorkspaceDirectory>, String> {
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

fn list_workspace_files_inner(root: PathBuf) -> Result<Vec<WorkspaceFile>, String> {
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

#[tauri::command]
pub fn search_workspace(
    root: String,
    query: String,
    access: State<'_, AccessRegistry>,
    cache: State<'_, WorkspaceSearchCache>,
    app: AppHandle,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    if !access.is_read_allowed(Path::new(&root)) {
        return Err("拒绝读取未通过用户选择的工作区。请重新添加文件夹。".to_string());
    }
    let persistence_directory = app.path().app_cache_dir().ok();
    search_workspace_inner_with_cache_and_persistence(
        PathBuf::from(root),
        query,
        &cache,
        persistence_directory.as_deref(),
    )
}

#[cfg(test)]
fn search_workspace_inner(
    root: PathBuf,
    query: String,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    let cache = WorkspaceSearchCache::default();
    search_workspace_inner_with_cache(root, query, &cache)
}

#[cfg(test)]
fn search_workspace_inner_with_cache(
    root: PathBuf,
    query: String,
    cache: &WorkspaceSearchCache,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    search_workspace_inner_with_cache_and_persistence(root, query, cache, None)
}

fn search_workspace_inner_with_cache_and_persistence(
    root: PathBuf,
    query: String,
    cache: &WorkspaceSearchCache,
    persistence_directory: Option<&Path>,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let files = cache.list_files(&root)?;
    cache.refresh_search_index(&root, &files, persistence_directory);
    let content_candidates = cache.content_candidates(&root, &query);
    let mut results = Vec::new();

    for file in files {
        let name_matches = file.name.to_lowercase().contains(&query);
        let content_candidate = content_candidates
            .as_ref()
            .map(|paths| paths.contains(&access_path_key(Path::new(&file.path))))
            .unwrap_or(true);
        let preview = if is_supported_text_path(Path::new(&file.path))
            && file.size <= MAX_SEARCH_FILE_BYTES
            && content_candidate
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

fn validate_workspace_entry_name(raw_name: &str) -> Result<String, String> {
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

fn resolve_workspace_parent(root: &Path, parent_path: &str) -> Result<PathBuf, String> {
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

fn create_workspace_note_inner(
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
        if !markdown_extension(Some(extension)) {
            return Err("新建笔记只能使用 Markdown 扩展名。".to_string());
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
    let contents = format!("# {file_stem}\n\n");
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

fn create_workspace_folder_inner(
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

fn canonical_workspace_root(raw_root: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(PathBuf::from(raw_root))
        .map_err(|error| format!("无法读取工作区目录：{error}"))?;
    if !root.is_dir() {
        return Err("工作区路径不是文件夹。".to_string());
    }
    Ok(root)
}

fn resolve_workspace_entry(root: &Path, raw_entry_path: &str) -> Result<PathBuf, String> {
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

fn rename_workspace_entry_inner(
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
    if fs::symlink_metadata(&destination).is_ok() {
        return Err("目标名称已经存在，请换一个名称。".to_string());
    }

    fs::rename(&source, &destination).map_err(|error| format!("无法重命名工作区条目：{error}"))?;
    Ok(display_path(&destination))
}

fn delete_workspace_entry_inner(root: String, entry_path: String) -> Result<(), String> {
    let root = canonical_workspace_root(&root)?;
    let target = resolve_workspace_entry(&root, &entry_path)?;
    let metadata =
        fs::symlink_metadata(&target).map_err(|error| format!("无法读取工作区条目：{error}"))?;

    if metadata.is_dir() {
        fs::remove_dir_all(&target).map_err(|error| format!("无法删除文件夹：{error}"))?;
    } else {
        fs::remove_file(&target).map_err(|error| format!("无法删除文件：{error}"))?;
    }
    Ok(())
}

fn copy_workspace_directory(source: &Path, destination: &Path) -> Result<(), String> {
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

fn duplicate_workspace_entry_inner(
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

fn transfer_workspace_entry_inner(
    root: String,
    entry_path: String,
    destination_parent_path: String,
    copy: bool,
) -> Result<String, String> {
    let root = canonical_workspace_root(&root)?;
    let source = resolve_workspace_entry(&root, &entry_path)?;
    let source_metadata =
        fs::symlink_metadata(&source).map_err(|error| format!("无法读取工作区条目：{error}"))?;
    let source_is_directory = source_metadata.is_dir();
    let destination_parent = resolve_workspace_parent(&root, &destination_parent_path)?;

    if source_is_directory && destination_parent.starts_with(&source) {
        return Err("不能将文件夹粘贴到自身或其子文件夹中。".to_string());
    }

    let source_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "工作区条目名称无法解析。".to_string())?;
    let destination = destination_parent.join(source_name);
    if destination == source {
        return Err("目标文件夹中已经存在同名内容。".to_string());
    }
    if fs::symlink_metadata(&destination).is_ok() {
        return Err("目标文件夹中已经存在同名内容，请先重命名或删除目标。".to_string());
    }

    if copy {
        if source_is_directory {
            copy_workspace_directory(&source, &destination)?;
        } else {
            fs::copy(&source, &destination).map_err(|error| format!("无法复制文件：{error}"))?;
        }
    } else {
        fs::rename(&source, &destination).map_err(|error| format!("无法移动工作区条目：{error}"))?;
    }

    Ok(display_path(&destination))
}

fn reveal_workspace_entry_inner(root: String, entry_path: String) -> Result<(), String> {
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
    root: String,
    entry_path: String,
    name: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝修改未通过用户文件夹选择的工作区。请重新添加文件夹。".to_string());
    }
    rename_workspace_entry_inner(root, entry_path, name)
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
pub fn copy_workspace_entry(
    root: String,
    entry_path: String,
    destination_parent_path: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝复制未通过用户文件夹选择的工作区内容。请重新添加文件夹。".to_string());
    }
    transfer_workspace_entry_inner(root, entry_path, destination_parent_path, true)
}

#[tauri::command]
pub fn move_workspace_entry(
    root: String,
    entry_path: String,
    destination_parent_path: String,
    access: State<'_, AccessRegistry>,
) -> Result<String, String> {
    if !access.is_write_allowed(Path::new(&root)) {
        return Err("拒绝移动未通过用户文件夹选择的工作区内容。请重新添加文件夹。".to_string());
    }
    transfer_workspace_entry_inner(root, entry_path, destination_parent_path, false)
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
    let mut folder_scope_paths = Vec::new();
    let mut folders = Vec::new();
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

#[tauri::command]
pub fn write_text_file(
    path: String,
    contents: String,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !is_write_allowed_for_new_path(&access, &path) {
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
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }
    write_bytes_file_inner(path, &contents, false)
}

#[tauri::command]
pub fn export_pdf_file(
    path: String,
    html: String,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }
    if html.trim().is_empty() {
        return Err("没有可导出的文档内容。".to_string());
    }
    if html.len() > MAX_PDF_HTML_BYTES {
        return Err("文档内容过大，暂时无法生成 PDF。请先拆分文档后重试。".to_string());
    }

    #[cfg(windows)]
    {
        export_pdf_file_windows(path, &html)
    }
    #[cfg(not(windows))]
    {
        let _ = (path, html);
        Err("PDF 文件导出仅支持 Windows 桌面版。".to_string())
    }
}

fn has_pdf_header(bytes: &[u8]) -> bool {
    bytes.get(..5) == Some(b"%PDF-".as_slice())
}

#[cfg(windows)]
fn find_edge_executable() -> Option<PathBuf> {
    const CHANNELS: [&str; 4] = ["Edge", "Edge Beta", "Edge Dev", "Edge SxS"];
    const ROOT_VARIABLES: [&str; 3] = ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"];

    ROOT_VARIABLES
        .iter()
        .filter_map(std::env::var_os)
        .find_map(|root| {
            CHANNELS
                .iter()
                .map(|channel| {
                    PathBuf::from(&root)
                        .join("Microsoft")
                        .join(channel)
                        .join("Application")
                        .join("msedge.exe")
                })
                .find(|candidate| candidate.is_file())
        })
}

#[cfg(windows)]
fn edge_file_url(path: &Path) -> String {
    const EDGE_FILE_URL_ENCODE_SET: &percent_encoding::AsciiSet = &percent_encoding::CONTROLS
        .add(b' ')
        .add(b'#')
        .add(b'?')
        .add(b'%');
    let normalized = path.to_string_lossy().replace('\\', "/");
    format!(
        "file:///{}",
        percent_encoding::utf8_percent_encode(&normalized, EDGE_FILE_URL_ENCODE_SET)
    )
}

#[cfg(windows)]
fn is_valid_pdf_file(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if metadata.len() < 5 {
        return false;
    }

    let Ok(mut file) = File::open(path) else {
        return false;
    };
    let mut header = [0_u8; 5];
    file.read_exact(&mut header).is_ok() && has_pdf_header(&header)
}

#[cfg(windows)]
fn export_pdf_file_windows(path: PathBuf, html: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let parent = path
        .parent()
        .ok_or_else(|| "PDF 文件路径没有父目录。".to_string())?
        .to_path_buf();
    fs::create_dir_all(&parent).map_err(|error| format!("创建 PDF 文件目录失败：{error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "PDF 文件名无法解析。".to_string())?;
    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_root = std::env::temp_dir();
    let temp_html = temp_root.join(format!(
        "moyang-reader-pdf-{}-{nonce}.html",
        std::process::id()
    ));
    let temp_profile = temp_root.join(format!(
        "moyang-reader-pdf-profile-{}-{nonce}",
        std::process::id()
    ));
    let temp_pdf = parent.join(format!(
        ".{file_name}.moyang-pdf-{}-{nonce}.tmp.pdf",
        std::process::id()
    ));

    let result = (|| {
        let edge = find_edge_executable().ok_or_else(|| {
            "未找到 Microsoft Edge，无法生成 PDF。请安装或修复 Microsoft Edge 后重试。".to_string()
        })?;
        fs::write(&temp_html, html.as_bytes())
            .map_err(|error| format!("准备 PDF 内容失败：{error}"))?;

        let status = Command::new(edge)
            .arg("--headless=new")
            .arg("--disable-gpu")
            .arg("--disable-extensions")
            .arg("--disable-javascript")
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--no-pdf-header-footer")
            .arg("--run-all-compositor-stages-before-draw")
            .arg("--virtual-time-budget=1000")
            .arg(format!("--user-data-dir={}", temp_profile.display()))
            .arg(format!("--print-to-pdf={}", temp_pdf.display()))
            .arg(edge_file_url(&temp_html))
            .creation_flags(0x0800_0000)
            .status()
            .map_err(|error| format!("启动 PDF 渲染器失败：{error}"))?;
        if !status.success() {
            return Err(format!(
                "Microsoft Edge 生成 PDF 失败（退出码 {}）。",
                status
                    .code()
                    .map_or_else(|| "未知".to_string(), |code| code.to_string())
            ));
        }
        let mut valid_pdf = false;
        for _ in 0..50 {
            if is_valid_pdf_file(&temp_pdf) {
                valid_pdf = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        if !valid_pdf {
            return Err("PDF 渲染器未生成有效文件，请稍后重试。".to_string());
        }

        replace_file(&temp_pdf, &path).map_err(|error| format!("保存 PDF 文件失败：{error}"))?;
        Ok(())
    })();

    let _ = fs::remove_file(&temp_html);
    let _ = fs::remove_file(&temp_pdf);
    let _ = fs::remove_dir_all(&temp_profile);
    result
}

fn decode_ipc_path(encoded_path: &str) -> Result<PathBuf, String> {
    percent_encoding::percent_decode_str(encoded_path)
        .decode_utf8()
        .map(|path| PathBuf::from(path.into_owned()))
        .map_err(|_| "IPC 文件路径不是有效的 UTF-8。".to_string())
}

#[tauri::command]
pub fn write_binary_file_raw(
    request: tauri::ipc::Request<'_>,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let encoded_path = request
        .headers()
        .get("path")
        .ok_or_else(|| "IPC 写入缺少文件路径。".to_string())?;
    let path = decode_ipc_path(
        encoded_path
            .to_str()
            .map_err(|_| "IPC 文件路径不是有效的请求头。".to_string())?,
    )?;
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }

    let contents = match request.body() {
        tauri::ipc::InvokeBody::Raw(contents) => contents,
        _ => return Err("IPC 二进制写入需要原始字节请求体。".to_string()),
    };
    write_bytes_file_inner(path, contents, false)
}

fn is_write_allowed_for_new_path(access: &AccessRegistry, path: &Path) -> bool {
    let mut candidate = path;
    loop {
        if access.is_write_allowed(candidate) {
            return true;
        }
        if candidate.exists() {
            return false;
        }
        let Some(parent) = candidate.parent() else {
            return false;
        };
        if parent == candidate {
            return false;
        }
        candidate = parent;
    }
}

fn write_bytes_file_inner(
    path: PathBuf,
    contents: &[u8],
    create_backup: bool,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "文件路径没有父目录。".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建文件目录失败：{error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "文件名无法解析。".to_string())?;

    let backup = if create_backup && path.is_file() {
        let backup = parent.join(format!(".{file_name}.moyang.bak"));
        fs::copy(&path, &backup).map_err(|error| format!("创建备份失败：{error}"))?;
        Some(backup)
    } else {
        None
    };

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
        if let Some(backup) = backup.as_deref() {
            fs::remove_file(backup).map_err(|error| format!("清理备份失败：{error}"))?;
        }
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
    #[cfg(windows)]
    use super::export_pdf_file_windows;
    use super::{
        access_path_key, add_indexed_file_with_limit, authorize_stored_path_inner, clean_tag,
        collect_open_paths, create_markdown_file_inner, create_workspace_folder_inner,
        create_workspace_note_inner, decode_ipc_path, decode_text, delete_workspace_entry_inner,
        duplicate_workspace_entry_inner, extract_markdown_links, extract_tags, extract_title,
        transfer_workspace_entry_inner,
        extract_wiki_links, has_pdf_header, index_workspace_inner, is_supported_document_path,
        is_supported_text_path, is_write_allowed_for_new_path, list_workspace_files_inner,
        path_exists_inner, persistent_search_index_path, prune_search_entries,
        read_text_file_inner, refresh_workspace_inner, rename_workspace_entry_inner,
        search_workspace_inner, search_workspace_inner_with_cache,
        search_workspace_inner_with_cache_and_persistence, should_skip_directory,
        sorted_workspace_directories, source_search_tokens, touch_indexed_file,
        write_bytes_file_inner, write_text_file_inner, AccessRegistry, CachedSearchIndex,
        CachedSearchText, OpenPath, OpenPathKind, WorkspaceFile, WorkspaceSearchCache,
        MAX_READ_FILE_BYTES, MAX_SEARCH_CACHE_BYTES, MAX_SEARCH_CACHE_ENTRIES,
        MAX_SEARCH_INDEX_TOKENS_PER_FILE, MAX_SEARCH_INDEX_TOKEN_CHARS, TEMP_FILE_COUNTER,
    };
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::Ordering;
    use std::time::{Duration, Instant};

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
    fn recognizes_pdf_file_signature() {
        assert!(has_pdf_header(b"%PDF-1.7\n"));
        assert!(!has_pdf_header(b"PDF-1.7\n"));
        assert!(!has_pdf_header(b"%PDF"));
    }

    #[cfg(windows)]
    #[test]
    fn exports_pdf_file_with_the_windows_edge_renderer() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-pdf-test-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let output = root.join("export.pdf");
        fs::create_dir_all(&root).expect("create PDF export test directory");

        export_pdf_file_windows(
            output.clone(),
            "<!doctype html><html><head><meta charset=\"utf-8\"><style>body{font-family:Arial}</style></head><body><h1>PDF smoke</h1><p>Windows export.</p></body></html>",
        )
        .expect("Windows Edge should create a PDF file");

        let bytes = fs::read(&output).expect("read generated PDF");
        assert!(bytes.len() > 100);
        assert!(has_pdf_header(&bytes));
        assert!(bytes.windows(5).any(|window| window == b"%%EOF"));

        fs::remove_dir_all(root).expect("remove PDF export test directory");
    }

    #[test]
    fn tokenizes_ascii_words_and_cjk_bigrams() {
        let tokens =
            source_search_tokens("Alpha alpha 42 中文搜索 文档").expect("tokenize search source");

        assert!(tokens.contains("alpha"));
        assert!(tokens.contains("42"));
        assert!(tokens.contains("中文"));
        assert!(tokens.contains("文搜"));
        assert!(tokens.contains("搜索"));
        assert!(tokens.contains("文档"));
        assert!(!tokens.contains("al"));
    }

    #[test]
    fn bounds_search_token_length_before_indexing() {
        let source = "x".repeat(MAX_SEARCH_INDEX_TOKEN_CHARS + 1);

        assert!(source_search_tokens(&source).is_none());
    }

    #[test]
    fn collects_existing_workspaces_and_supported_documents() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-open-paths-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let workspace = root.join("vault");
        let note = workspace.join("note.md");
        let unsupported = workspace.join("note.doc");
        fs::create_dir_all(&workspace).expect("create open paths workspace");
        fs::write(&note, "note").expect("write open paths note");
        fs::write(&unsupported, "unsupported").expect("write unsupported open path");

        let paths = collect_open_paths(vec![
            workspace.to_string_lossy().into_owned(),
            note.to_string_lossy().into_owned(),
            unsupported.to_string_lossy().into_owned(),
            root.join("missing.md").to_string_lossy().into_owned(),
        ]);

        assert_eq!(paths.len(), 2);
        assert!(paths
            .iter()
            .any(|path| path.path == workspace.to_string_lossy()
                && path.kind == OpenPathKind::Workspace));
        assert!(
            paths
                .iter()
                .any(|path| path.path == note.to_string_lossy()
                    && path.kind == OpenPathKind::Document)
        );

        fs::remove_dir_all(root).expect("remove open paths workspace");
    }

    #[test]
    fn serializes_open_path_kind_for_the_frontend_bridge() {
        let paths = vec![OpenPath {
            path: "C:\\Notes\\vault".to_string(),
            kind: OpenPathKind::Workspace,
        }];
        let value = serde_json::to_value(paths).expect("serialize open paths");

        assert_eq!(value[0]["path"], "C:\\Notes\\vault");
        assert_eq!(value[0]["kind"], "workspace");
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
    fn allows_new_files_below_an_authorized_workspace() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-new-file-access-{}",
            std::process::id()
        ));
        let vault = root.join("vault");
        let asset = vault.join("assets").join("clip.png");
        fs::create_dir_all(&vault).expect("create new file access workspace");

        let access = AccessRegistry::default();
        access
            .register_workspace_path(&vault)
            .expect("register new file access workspace");

        assert!(is_write_allowed_for_new_path(&access, &asset));
        assert!(!is_write_allowed_for_new_path(
            &access,
            &root.join("outside").join("clip.png")
        ));

        fs::remove_dir_all(root).expect("remove new file access workspace");
    }

    #[test]
    fn allows_writes_to_an_explicitly_authorized_new_file() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-explicit-new-file-access-{}",
            std::process::id()
        ));
        let export_dir = root.join("exports");
        let target = export_dir.join("reading-library.html");
        fs::create_dir_all(&export_dir).expect("create explicit new file access directory");

        let access = AccessRegistry::default();
        access
            .register_path(&target)
            .expect("register explicitly selected save path");

        assert!(is_write_allowed_for_new_path(&access, &target));
        assert!(!is_write_allowed_for_new_path(
            &access,
            &export_dir.join("unselected.html")
        ));

        fs::remove_dir_all(root).expect("remove explicit new file access directory");
    }

    #[test]
    fn creates_parent_directories_for_binary_asset_writes() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-binary-parent-{}",
            std::process::id()
        ));
        let path = root.join("assets").join("clip.png");

        write_bytes_file_inner(path.clone(), &[0, 1, 2, 3], false).expect("write binary asset");
        assert_eq!(fs::read(path).expect("read binary asset"), vec![0, 1, 2, 3]);

        fs::remove_dir_all(root).expect("remove binary parent workspace");
    }

    #[test]
    fn authorizes_existing_stored_documents_and_workspaces_only() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-stored-path-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let workspace = root.join("vault");
        let note = workspace.join("note.md");
        let unsupported = workspace.join("note.doc");
        fs::create_dir_all(&workspace).expect("create stored path workspace");
        fs::write(&note, "note").expect("write stored path note");
        fs::write(&unsupported, "unsupported").expect("write unsupported document");

        let access = AccessRegistry::default();
        let authorized_note = authorize_stored_path_inner(note.clone(), false, &access)
            .expect("authorize stored document");
        assert_eq!(
            fs::canonicalize(&authorized_note).expect("canonicalize authorized document"),
            fs::canonicalize(&note).expect("canonicalize expected document")
        );
        assert!(access.is_read_allowed(&note));
        assert!(access.is_write_allowed(&note));
        assert!(authorize_stored_path_inner(unsupported, false, &access).is_err());
        assert!(authorize_stored_path_inner(root.join("missing.md"), false, &access).is_err());

        let authorized_workspace = authorize_stored_path_inner(workspace.clone(), true, &access)
            .expect("authorize stored workspace");
        assert_eq!(
            fs::canonicalize(&authorized_workspace).expect("canonicalize authorized workspace"),
            fs::canonicalize(&workspace).expect("canonicalize expected workspace")
        );
        assert!(access.is_workspace_allowed(&workspace));
        assert!(authorize_stored_path_inner(note, true, &access).is_err());

        fs::remove_dir_all(root).expect("remove stored path workspace");
    }

    #[test]
    fn replaces_existing_file_and_cleans_backup_after_success() {
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
        assert!(!root.join(".note.md.moyang.bak").exists());
        fs::remove_dir_all(root).expect("remove atomic test directory");
    }

    #[test]
    fn decodes_unicode_paths_for_raw_binary_ipc() {
        assert_eq!(
            decode_ipc_path("C%3A%5CNotes%5C%E4%BD%A0%E5%A5%BD.docx").expect("decode encoded path"),
            PathBuf::from("C:\\Notes\\你好.docx")
        );
        assert!(decode_ipc_path("%FF").is_err());
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
    fn ignores_heading_text_and_non_tag_words_in_tag_lines() {
        assert_eq!(
            extract_tags("## 背景\n### 安装步骤\n#tag 说明文字\n##Multi Word\n#topic #second"),
            vec!["tag", "topic", "second"]
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
        cache.enable_event_driven_root(&root);
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
        let root_key = access_path_key(&root);
        assert_eq!(
            cache
                .file_lists
                .lock()
                .expect("lock workspace file cache")
                .get(&root_key)
                .map(|entry| entry.files.len()),
            Some(1)
        );

        let cached_query =
            search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
                .expect("search cached query");
        assert_eq!(cached_query.len(), 1);
        let metadata_checks_after_first_query = cache.metadata_checks.load(Ordering::Relaxed);
        assert_eq!(metadata_checks_after_first_query, 1);
        let directory_stamp_checks_after_first_query =
            cache.directory_stamp_checks.load(Ordering::Relaxed);

        let unchanged_query =
            search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
                .expect("search unchanged index query");
        assert_eq!(unchanged_query.len(), 1);
        assert_eq!(
            cache.metadata_checks.load(Ordering::Relaxed),
            metadata_checks_after_first_query
        );
        assert_eq!(
            cache.directory_stamp_checks.load(Ordering::Relaxed),
            directory_stamp_checks_after_first_query
        );

        let added = root.join("added.md");
        fs::write(&added, "added needle").expect("add search cache note");
        cache.invalidate_scopes(&[root.to_string_lossy().into_owned()]);
        assert!(cache
            .entries
            .lock()
            .expect("lock invalidated search cache")
            .is_empty());
        assert!(cache
            .file_lists
            .lock()
            .expect("lock invalidated workspace file cache")
            .is_empty());

        fs::write(&note, "second needle").expect("update search cache note");
        let updated = search_workspace_inner_with_cache(root.clone(), "second".to_string(), &cache)
            .expect("search updated query");
        assert_eq!(updated.len(), 1);
        assert!(cache.metadata_checks.load(Ordering::Relaxed) > metadata_checks_after_first_query);
        let added_result =
            search_workspace_inner_with_cache(root.clone(), "added".to_string(), &cache)
                .expect("search newly added note");
        assert_eq!(added_result.len(), 1);

        fs::remove_dir_all(root).expect("remove search cache workspace");
    }

    #[test]
    fn uses_search_index_candidates_without_changing_substring_results() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-index-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create search index workspace");
        fs::write(root.join("first.md"), "alpha Needle content").expect("write indexed match");
        fs::write(root.join("second.md"), "unrelated content").expect("write indexed non-match");
        fs::write(root.join("third.md"), "needless content").expect("write substring match");

        let cache = WorkspaceSearchCache::default();
        cache.enable_event_driven_root(&root);
        let indexed = search_workspace_inner_with_cache(root.clone(), "eedl".to_string(), &cache)
            .expect("search indexed substring");
        assert_eq!(
            indexed
                .iter()
                .map(|result| result.file.name.as_str())
                .collect::<Vec<_>>(),
            vec!["first.md", "third.md"]
        );

        cache
            .entries
            .lock()
            .expect("lock search text cache")
            .clear();
        cache.text_reads.store(0, Ordering::Relaxed);
        let repeated_substring =
            search_workspace_inner_with_cache(root.clone(), "eedl".to_string(), &cache)
                .expect("search repeated indexed substring");
        assert_eq!(repeated_substring.len(), 2);
        assert_eq!(cache.text_reads.load(Ordering::Relaxed), 2);

        let exact_candidates = cache
            .content_candidates(&root, "needle")
            .expect("exact ASCII word should use the index");
        assert_eq!(exact_candidates.len(), 2);
        assert!(exact_candidates.contains(&access_path_key(&root.join("first.md"))));
        assert!(exact_candidates.contains(&access_path_key(&root.join("third.md"))));

        let short_query = search_workspace_inner_with_cache(root.clone(), "a".to_string(), &cache)
            .expect("search short query");
        assert!(short_query
            .iter()
            .any(|result| result.file.name == "first.md"));

        fs::remove_dir_all(root).expect("remove search index workspace");
    }

    #[test]
    fn keeps_unreadable_text_files_in_search_fallback() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-unreadable-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create unreadable search workspace");
        fs::write(root.join("indexed.md"), "needle in an indexed note")
            .expect("write indexed unreadable fallback note");
        fs::write(root.join("broken.md"), b"\0\0\0\0").expect("write unreadable fallback note");

        let cache = WorkspaceSearchCache::default();
        let results = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
            .expect("search with unreadable fallback note");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file.name, "indexed.md");

        let root_key = access_path_key(&root);
        let indexes = cache
            .search_indexes
            .lock()
            .expect("lock unreadable fallback index");
        assert!(indexes
            .get(&root_key)
            .expect("search index should exist")
            .unindexed_files
            .contains(&access_path_key(&root.join("broken.md"))));

        fs::remove_dir_all(root).expect("remove unreadable search workspace");
    }

    #[test]
    fn reuses_event_driven_index_for_5000_document_workspace() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-large-workspace-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create large search workspace");
        for index in 0..5_000 {
            let mut source = String::with_capacity(2 * 1024);
            if index == 4_999 {
                source.push_str("needle in the target note\n中文文档阅读器\n");
            } else {
                source.push_str("unrelated document content\n普通阅读文档\n");
            }
            while source.len() < 2 * 1024 {
                source.push_str("mixed English and 中文阅读 content for a realistic note.\n");
            }
            fs::write(root.join(format!("note-{index:04}.md")), source)
                .expect("write large search note");
        }

        let cache = WorkspaceSearchCache::default();
        cache.enable_event_driven_root(&root);
        let first = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
            .expect("search large workspace");
        assert_eq!(first.len(), 1);
        assert_eq!(first[0].file.name, "note-4999.md");
        let metadata_checks_after_first_query = cache.metadata_checks.load(Ordering::Relaxed);
        let directory_stamp_checks_after_first_query =
            cache.directory_stamp_checks.load(Ordering::Relaxed);
        assert_eq!(metadata_checks_after_first_query, 5_000);

        cache
            .entries
            .lock()
            .expect("lock large search text cache")
            .clear();
        cache.text_reads.store(0, Ordering::Relaxed);
        let repeated =
            search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
                .expect("repeat search large workspace");
        assert_eq!(repeated.len(), 1);
        assert_eq!(cache.text_reads.load(Ordering::Relaxed), 1);
        assert_eq!(
            cache.metadata_checks.load(Ordering::Relaxed),
            metadata_checks_after_first_query
        );
        assert_eq!(
            cache.directory_stamp_checks.load(Ordering::Relaxed),
            directory_stamp_checks_after_first_query
        );

        let mut query_durations = Vec::with_capacity(20);
        for _ in 0..20 {
            let started = Instant::now();
            let repeated =
                search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
                    .expect("measure warm search latency");
            query_durations.push(started.elapsed());
            assert_eq!(repeated.len(), 1);
        }
        query_durations.sort_unstable();
        let p95_index = ((query_durations.len() * 95).saturating_add(99) / 100).saturating_sub(1);
        let p95 = query_durations[p95_index];
        eprintln!("5000-document warm search P95: {} ms", p95.as_millis());
        assert!(
            p95 < Duration::from_millis(100),
            "5000-document warm search P95 exceeded the 100 ms target: {} ms",
            p95.as_millis()
        );

        fs::remove_dir_all(root).expect("remove large search workspace");
    }

    #[test]
    fn searches_cjk_queries_with_bigram_candidates() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-cjk-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create CJK search workspace");
        fs::write(root.join("reader.md"), "本地文档阅读器").expect("write CJK match");
        fs::write(root.join("other.md"), "本地工具").expect("write CJK non-match");

        let cache = WorkspaceSearchCache::default();
        let results = search_workspace_inner_with_cache(root.clone(), "文档".to_string(), &cache)
            .expect("search CJK query");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file.name, "reader.md");
        let candidates = cache
            .content_candidates(&root, "文档")
            .expect("CJK query should use the index");
        assert_eq!(candidates.len(), 1);

        fs::remove_dir_all(root).expect("remove CJK search workspace");
    }

    #[test]
    fn falls_back_only_for_files_that_exceed_index_token_limits() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-fallback-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create search fallback workspace");
        fs::write(root.join("indexed.md"), "needle in an indexed note")
            .expect("write indexed fallback note");
        fs::write(
            root.join("unindexed.md"),
            format!("{} needle", "x".repeat(MAX_SEARCH_INDEX_TOKEN_CHARS + 1)),
        )
        .expect("write unindexed fallback note");
        let cache_directory = std::env::temp_dir().join(format!(
            "moyang-reader-search-fallback-cache-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));

        let cache = WorkspaceSearchCache::default();
        let results = search_workspace_inner_with_cache_and_persistence(
            root.clone(),
            "needle".to_string(),
            &cache,
            Some(&cache_directory),
        )
        .expect("search fallback query");
        let names = results
            .into_iter()
            .map(|result| result.file.name)
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["indexed.md", "unindexed.md"]);
        let root_key = access_path_key(&root);
        let indexes = cache
            .search_indexes
            .lock()
            .expect("lock fallback search index");
        let index = indexes.get(&root_key).expect("search index should exist");
        assert_eq!(index.unindexed_files.len(), 1);
        assert!(index
            .unindexed_files
            .contains(&access_path_key(&root.join("unindexed.md"))));

        let persisted_cache = WorkspaceSearchCache::default();
        let persisted_results = search_workspace_inner_with_cache_and_persistence(
            root.clone(),
            "needle".to_string(),
            &persisted_cache,
            Some(&cache_directory),
        )
        .expect("search persisted fallback query");
        assert_eq!(persisted_results.len(), 2);
        assert_eq!(
            persisted_cache
                .search_indexes
                .lock()
                .expect("lock persisted fallback index")
                .get(&root_key)
                .map(|index| index.unindexed_files.len()),
            Some(1)
        );

        fs::remove_dir_all(root).expect("remove search fallback workspace");
        fs::remove_dir_all(cache_directory).expect("remove search fallback cache");
    }

    #[test]
    fn keeps_high_token_count_documents_in_fallback_without_disabling_index() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-long-document-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create long document workspace");
        let long_source = (0..=MAX_SEARCH_INDEX_TOKENS_PER_FILE)
            .map(|index| format!("token-{index}"))
            .collect::<Vec<_>>()
            .join(" ");
        fs::write(root.join("long.md"), format!("needle {long_source}"))
            .expect("write long document");
        fs::write(root.join("short.md"), "needle in a short document")
            .expect("write short document");

        let cache = WorkspaceSearchCache::default();
        let results = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
            .expect("search long document workspace");
        let names = results
            .into_iter()
            .map(|result| result.file.name)
            .collect::<Vec<_>>();
        assert_eq!(names, vec!["long.md", "short.md"]);

        let index = cache
            .search_indexes
            .lock()
            .expect("lock long document search index")
            .remove(&access_path_key(&root))
            .expect("long document search index should exist");
        assert!(!index.disabled);
        assert!(index
            .unindexed_files
            .contains(&access_path_key(&root.join("long.md"))));
        assert!(!index
            .unindexed_files
            .contains(&access_path_key(&root.join("short.md"))));
        assert!(index
            .postings
            .get("needle")
            .map(|paths| paths.contains(&access_path_key(&root.join("short.md"))))
            .unwrap_or(false));

        fs::remove_dir_all(root).expect("remove long document workspace");
    }

    #[test]
    fn evicts_the_least_recently_used_file_before_falling_back() {
        let mut index = CachedSearchIndex::default();
        let first_tokens = ["alpha"].into_iter().map(str::to_string).collect();

        assert!(add_indexed_file_with_limit(
            &mut index,
            "first.md".to_string(),
            1,
            None,
            first_tokens,
            2,
        ));
        assert_eq!(index.posting_count, 1);

        let second_tokens = ["beta"].into_iter().map(str::to_string).collect();
        assert!(add_indexed_file_with_limit(
            &mut index,
            "second.md".to_string(),
            1,
            None,
            second_tokens,
            2,
        ));
        assert_eq!(index.posting_count, 2);

        touch_indexed_file(&mut index, "first.md");

        let third_tokens = ["gamma"].into_iter().map(str::to_string).collect();
        assert!(add_indexed_file_with_limit(
            &mut index,
            "third.md".to_string(),
            1,
            None,
            third_tokens,
            2,
        ));

        assert_eq!(index.posting_count, 2);
        assert_eq!(
            index.files.get("second.md").map(|file| file.tokens.len()),
            Some(0)
        );
        assert!(index.unindexed_files.contains("second.md"));
        assert_eq!(
            index.files.get("third.md").map(|file| file.tokens.len()),
            Some(1)
        );
        assert!(!index.postings.contains_key("beta"));
        assert!(index.postings.contains_key("gamma"));
        assert!(index.postings.contains_key("alpha"));
    }

    #[test]
    fn keeps_indexed_results_consistent_with_a_linear_scan() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-consistency-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create consistency search workspace");

        let words = [
            "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "theta",
        ];
        let mut seed = 0x9e37_79b9_u64;
        for index in 0..96 {
            let word_count = 3 + (seed as usize % 6);
            let mut source = String::new();
            for _ in 0..word_count {
                seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
                source.push_str(words[(seed as usize) % words.len()]);
                source.push(' ');
            }
            if index % 7 == 0 {
                source.push_str("中文文档 ");
            }
            if index % 11 == 0 {
                source.push_str("阅读器 ");
            }
            fs::write(root.join(format!("note-{index:03}.md")), source)
                .expect("write consistency search note");
        }

        let queries = [
            "alpha", "beta", "gamma", "delta", "epsilon", "中文", "文档", "阅读", "eedl",
            "note-001",
        ];
        let cache = WorkspaceSearchCache::default();
        for query in queries {
            let actual = search_workspace_inner_with_cache(root.clone(), query.to_string(), &cache)
                .expect("search consistency query")
                .into_iter()
                .map(|result| result.file.relative_path)
                .collect::<Vec<_>>();
            let normalized_query = query.to_lowercase();
            let expected = list_workspace_files_inner(root.clone())
                .expect("list consistency search files")
                .into_iter()
                .filter(|file| {
                    file.name.to_lowercase().contains(&normalized_query)
                        || fs::read_to_string(&file.path)
                            .map(|source| {
                                source
                                    .lines()
                                    .any(|line| line.to_lowercase().contains(&normalized_query))
                            })
                            .unwrap_or(false)
                })
                .map(|file| file.relative_path)
                .collect::<Vec<_>>();

            assert_eq!(actual, expected, "search result mismatch for {query}");
        }

        fs::remove_dir_all(root).expect("remove consistency search workspace");
    }

    #[test]
    fn persists_search_index_and_rebuilds_when_snapshot_is_corrupt() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-index-persist-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let cache_directory = std::env::temp_dir().join(format!(
            "moyang-reader-search-index-cache-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create persistent search workspace");
        fs::write(root.join("note.md"), "persistent needle").expect("write persistent search note");

        let first_cache = WorkspaceSearchCache::default();
        let first = search_workspace_inner_with_cache_and_persistence(
            root.clone(),
            "needle".to_string(),
            &first_cache,
            Some(&cache_directory),
        )
        .expect("search and persist index");
        assert_eq!(first.len(), 1);
        let snapshot_path = persistent_search_index_path(&cache_directory, &root);
        assert!(snapshot_path.is_file());

        let second_cache = WorkspaceSearchCache::default();
        let reused = search_workspace_inner_with_cache_and_persistence(
            root.clone(),
            "needle".to_string(),
            &second_cache,
            Some(&cache_directory),
        )
        .expect("reuse persisted index");
        assert_eq!(reused.len(), 1);
        assert_eq!(
            second_cache
                .search_indexes
                .lock()
                .expect("lock persisted search index")
                .get(&access_path_key(&root))
                .map(|index| index.files.len()),
            Some(1)
        );

        fs::write(&snapshot_path, b"not valid json").expect("corrupt persisted index");
        let rebuilt_cache = WorkspaceSearchCache::default();
        let rebuilt = search_workspace_inner_with_cache_and_persistence(
            root.clone(),
            "needle".to_string(),
            &rebuilt_cache,
            Some(&cache_directory),
        )
        .expect("rebuild corrupt persisted index");
        assert_eq!(rebuilt.len(), 1);

        fs::remove_dir_all(root).expect("remove persistent search workspace");
        fs::remove_dir_all(cache_directory).expect("remove persistent search cache");
    }

    #[test]
    fn refreshes_search_index_when_file_metadata_changes() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-index-refresh-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create search index refresh workspace");
        let note = root.join("note.md");
        fs::write(&note, "first needle").expect("write initial indexed note");

        let cache = WorkspaceSearchCache::default();
        assert_eq!(
            search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
                .expect("search initial index")
                .len(),
            1
        );
        std::thread::sleep(std::time::Duration::from_millis(25));
        fs::write(&note, "second needle").expect("write updated indexed note");

        assert!(
            search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
                .expect("search removed indexed term")
                .is_empty()
        );
        assert_eq!(
            search_workspace_inner_with_cache(root.clone(), "second".to_string(), &cache)
                .expect("search updated indexed term")
                .len(),
            1
        );

        fs::remove_dir_all(root).expect("remove search index refresh workspace");
    }

    #[test]
    fn refreshes_file_list_cache_when_a_nested_directory_changes() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-search-cache-watch-fallback-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create watch fallback workspace");
        fs::write(root.join("initial.md"), "initial needle").expect("write initial note");

        let cache = WorkspaceSearchCache::default();
        let initial =
            search_workspace_inner_with_cache(root.clone(), "initial".to_string(), &cache)
                .expect("search initial note");
        assert_eq!(initial.len(), 1);

        std::thread::sleep(std::time::Duration::from_millis(25));
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("create nested directory");
        fs::write(nested.join("added.md"), "added needle").expect("write added note");

        let added = search_workspace_inner_with_cache(root.clone(), "added".to_string(), &cache)
            .expect("search added note after directory change");
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].file.relative_path, "nested/added.md");

        fs::remove_dir_all(root).expect("remove watch fallback workspace");
    }

    #[test]
    fn bounds_search_cache_entries_and_memory_with_lru_eviction() {
        let cache = WorkspaceSearchCache::default();
        let mut entries = cache.entries.lock().expect("lock search cache");
        for index in 0..MAX_SEARCH_CACHE_ENTRIES {
            entries.insert(
                format!("note-{index}"),
                CachedSearchText {
                    size: 1,
                    modified: None,
                    source: "x".to_string(),
                    memory_bytes: 1,
                    last_used: index as u64,
                },
            );
        }
        entries.insert(
            "large".to_string(),
            CachedSearchText {
                size: MAX_SEARCH_CACHE_BYTES,
                modified: None,
                source: "large".to_string(),
                memory_bytes: MAX_SEARCH_CACHE_BYTES,
                last_used: MAX_SEARCH_CACHE_ENTRIES as u64,
            },
        );

        prune_search_entries(&mut entries);

        assert_eq!(entries.len(), 1);
        assert!(entries.contains_key("large"));
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
        assert_eq!(delta.folders.len(), 1);
        assert_eq!(delta.folders[0].relative_path, "notes");
        assert_eq!(delta.folder_scope_paths.len(), 1);

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

    #[test]
    fn refreshes_deleted_entries_when_a_watcher_reports_a_child_after_parent_removal() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-refresh-deleted-child-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let removed_directory = root.join("removed");
        let removed_file = removed_directory.join("nested.md");
        fs::create_dir_all(&removed_directory).expect("create removable directory");
        fs::write(&removed_file, "# Removed").expect("write removable document");

        let initial = refresh_workspace_inner(
            root.clone(),
            vec![removed_directory.to_string_lossy().into_owned()],
        )
        .expect("refresh removable directory before deletion");
        assert_eq!(initial.folders.len(), 1);

        fs::remove_dir_all(&removed_directory).expect("remove removable directory");
        let removed = refresh_workspace_inner(
            root.clone(),
            vec![removed_file.to_string_lossy().into_owned()],
        )
        .expect("refresh deleted child after parent removal");

        assert_eq!(removed.scope_paths.len(), 1);
        assert_eq!(removed.folder_scope_paths.len(), 1);
        assert!(removed.files.is_empty());
        assert!(removed.folders.is_empty());

        fs::remove_dir_all(root).expect("remove deleted-child refresh workspace");
    }

    #[test]
    fn creates_workspace_entries_without_path_traversal_or_placeholder_files() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-create-entry-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let projects = root.join("Projects");
        fs::create_dir_all(&projects).expect("create projects directory");
        let root_string = root.to_string_lossy().into_owned();

        let created_folder = create_workspace_folder_inner(
            root_string.clone(),
            "Projects".to_string(),
            "Archive".to_string(),
        )
        .expect("create nested workspace folder");
        assert_eq!(
            fs::canonicalize(&created_folder).expect("canonicalize created folder"),
            fs::canonicalize(projects.join("Archive")).expect("canonicalize expected folder")
        );

        let created_note = create_workspace_note_inner(
            root_string.clone(),
            "Projects/Archive".to_string(),
            "Plan".to_string(),
        )
        .expect("create nested workspace note");
        assert_eq!(
            fs::read_to_string(&created_note).expect("read created workspace note"),
            "# Plan\n\n"
        );
        assert_eq!(
            sorted_workspace_directories(&root)
                .expect("list workspace directories")
                .len(),
            2
        );
        assert!(create_workspace_folder_inner(
            root_string.clone(),
            "Projects".to_string(),
            "../Outside".to_string(),
        )
        .is_err());
        assert!(create_workspace_note_inner(
            root_string,
            "Projects".to_string(),
            "CON".to_string()
        )
        .is_err());

        fs::remove_dir_all(root).expect("remove create entry workspace");
    }

    #[test]
    fn renames_and_deletes_workspace_entries_without_leaving_workspace() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-manage-entry-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let archive = root.join("Archive");
        let note = root.join("Today.md");
        fs::create_dir_all(&archive).expect("create management workspace");
        fs::write(&note, "# Today").expect("write management note");
        fs::write(archive.join("Nested.md"), "# Nested").expect("write nested management note");
        let root_string = root.to_string_lossy().into_owned();

        let renamed_note = rename_workspace_entry_inner(
            root_string.clone(),
            "Today.md".to_string(),
            "Reading".to_string(),
        )
        .expect("rename workspace note while preserving extension");
        assert!(renamed_note.ends_with("Reading.md"));
        assert!(Path::new(&renamed_note).is_file());
        assert!(!note.exists());

        let renamed_archive = rename_workspace_entry_inner(
            root_string.clone(),
            "Archive".to_string(),
            "Saved".to_string(),
        )
        .expect("rename workspace folder");
        assert!(Path::new(&renamed_archive).is_dir());
        assert!(Path::new(&renamed_archive).join("Nested.md").is_file());

        assert!(rename_workspace_entry_inner(
            root_string.clone(),
            "../outside".to_string(),
            "Nope".to_string(),
        )
        .is_err());
        assert!(delete_workspace_entry_inner(root_string.clone(), "".to_string()).is_err());

        delete_workspace_entry_inner(root_string.clone(), "Reading.md".to_string())
            .expect("delete workspace note");
        assert!(!Path::new(&renamed_note).exists());
        delete_workspace_entry_inner(root_string, "Saved".to_string())
            .expect("delete workspace folder recursively");
        assert!(!Path::new(&renamed_archive).exists());

        fs::remove_dir_all(root).expect("remove management workspace");
    }

    #[test]
    fn duplicates_workspace_files_and_folders_inside_the_workspace() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-duplicate-entry-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let source_folder = root.join("Projects");
        let source_file = source_folder.join("Plan.md");
        fs::create_dir_all(&source_folder).expect("create duplicate workspace");
        fs::write(&source_file, "# Plan\n\ncontent").expect("write duplicate source");
        let root_string = root.to_string_lossy().into_owned();

        let copied_file = duplicate_workspace_entry_inner(
            root_string.clone(),
            "Projects/Plan.md".to_string(),
            "Plan copy".to_string(),
        )
        .expect("duplicate workspace file");
        assert!(copied_file.ends_with("Plan copy.md"));
        assert_eq!(
            fs::read_to_string(&copied_file).expect("read copied file"),
            "# Plan\n\ncontent"
        );

        let copied_folder = duplicate_workspace_entry_inner(
            root_string.clone(),
            "Projects".to_string(),
            "Projects copy".to_string(),
        )
        .expect("duplicate workspace folder");
        assert!(Path::new(&copied_folder).join("Plan.md").is_file());
        assert!(duplicate_workspace_entry_inner(
            root_string.clone(),
            "Projects/Plan.md".to_string(),
            "../outside".to_string(),
        )
        .is_err());
        assert!(duplicate_workspace_entry_inner(
            root_string,
            "Projects/Plan.md".to_string(),
            "Plan".to_string(),
        )
        .is_err());

        fs::remove_dir_all(root).expect("remove duplicate workspace");
    }
    #[test]
    fn copies_and_moves_workspace_entries_between_folders() {
        let root = std::env::temp_dir().join(format!(
            "moyang-reader-transfer-entry-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let source = root.join("Source");
        let archive = root.join("Archive");
        let source_file = source.join("Plan.md");
        fs::create_dir_all(source.join("Nested")).expect("create transfer source");
        fs::create_dir_all(&archive).expect("create transfer destination");
        fs::write(&source_file, "# Plan").expect("write transfer source file");
        let root_string = root.to_string_lossy().into_owned();

        let copied = transfer_workspace_entry_inner(
            root_string.clone(),
            "Source/Plan.md".to_string(),
            "Archive".to_string(),
            true,
        )
        .expect("copy workspace file into destination folder");
        assert!(copied.ends_with("Archive\\Plan.md"));
        assert!(source_file.is_file());
        assert_eq!(
            fs::read_to_string(&copied).expect("read copied workspace file"),
            "# Plan"
        );

        assert!(transfer_workspace_entry_inner(
            root_string.clone(),
            "Source".to_string(),
            "Source/Nested".to_string(),
            false,
        )
        .is_err());

        let moved = transfer_workspace_entry_inner(
            root_string,
            "Source".to_string(),
            "Archive".to_string(),
            false,
        )
        .expect("move workspace folder into destination folder");
        assert!(Path::new(&moved).join("Plan.md").is_file());
        assert!(!source.exists());

        fs::remove_dir_all(root).expect("remove transfer workspace");
    }


}
