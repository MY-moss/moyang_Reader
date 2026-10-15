//! search: extracted from the verified local working copy.
use super::*;

pub(super) fn collect_workspace_directory_stamps(
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

pub(super) fn workspace_directory_stamps(root: &Path) -> Result<Vec<CachedDirectoryStamp>, String> {
    let mut stamps = Vec::new();
    collect_workspace_directory_stamps(root, &mut stamps)?;
    Ok(stamps)
}

pub(super) fn prune_search_entries(entries: &mut HashMap<String, CachedSearchText>) {
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

pub(super) fn prune_file_lists(file_lists: &mut HashMap<String, CachedWorkspaceFileList>) {
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

pub(super) fn prune_search_indexes(search_indexes: &mut HashMap<String, CachedSearchIndex>) {
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

pub(super) fn is_cjk_search_char(character: char) -> bool {
    matches!(
        character,
        '\u{3400}'..='\u{4DBF}'
            | '\u{4E00}'..='\u{9FFF}'
            | '\u{F900}'..='\u{FAFF}'
            | '\u{20000}'..='\u{2FA1F}'
    )
}

pub(super) fn is_ascii_search_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

pub(super) fn insert_search_token(tokens: &mut HashSet<String>, token: String) -> bool {
    if token.is_empty() {
        return true;
    }
    if token.chars().count() > MAX_SEARCH_INDEX_TOKEN_CHARS {
        return false;
    }
    tokens.insert(token);
    tokens.len() <= MAX_SEARCH_INDEX_TOKENS_PER_FILE
}

pub(super) fn source_search_tokens(source: &str) -> Option<HashSet<String>> {
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

pub(super) fn search_index_file_snapshot(files: &[WorkspaceFile]) -> Vec<SearchIndexFileStamp> {
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

pub(super) fn system_time_marker(modified: Option<SystemTime>) -> Option<u64> {
    modified
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| duration.as_nanos().try_into().ok())
}

pub(super) fn marker_system_time(marker: Option<u64>) -> Option<SystemTime> {
    marker.and_then(|value| UNIX_EPOCH.checked_add(Duration::from_nanos(value)))
}

pub(super) fn persistent_search_index_key(root: &Path) -> String {
    let mut hash = 14_695_981_039_346_656_037_u64;
    for byte in access_path_key(root).as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1_099_511_628_211_u64);
    }
    format!("{hash:016x}")
}

pub(super) fn persistent_search_index_path(cache_directory: &Path, root: &Path) -> PathBuf {
    cache_directory
        .join("search-index")
        .join(format!("{}.json", persistent_search_index_key(root)))
}

pub(super) fn next_indexed_file_access(index: &mut CachedSearchIndex) -> u64 {
    let access = index.file_access_counter;
    index.file_access_counter = index.file_access_counter.saturating_add(1);
    access
}

pub(super) fn store_unindexed_file(
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

pub(super) fn oldest_indexed_file(index: &CachedSearchIndex) -> Option<String> {
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

pub(super) fn demote_indexed_file(index: &mut CachedSearchIndex, path: &str) -> bool {
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

pub(super) fn touch_indexed_file(index: &mut CachedSearchIndex, path: &str) {
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

pub(super) fn add_indexed_file_with_tokens(
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

pub(super) fn add_indexed_file_with_limit(
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

pub(super) fn load_persisted_search_index(
    cache_directory: &Path,
    root: &Path,
) -> Option<CachedSearchIndex> {
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

pub(super) fn persist_search_index(cache_directory: &Path, root: &Path, index: &CachedSearchIndex) {
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

pub(super) fn remove_indexed_file(index: &mut CachedSearchIndex, path: &str) {
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

pub(super) fn add_indexed_file(
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
    pub(super) fn enable_event_driven_root(&self, root: &Path) {
        let root_key = access_path_key(root);
        self.invalidate_scopes(std::slice::from_ref(&root_key));
        if let Ok(mut roots) = self.event_driven_roots.lock() {
            roots.clear();
            roots.insert(root_key);
        }
    }

    pub(super) fn disable_event_driven_root(&self, root: &Path) {
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

    pub(super) fn content_candidates(&self, root: &Path, query: &str) -> Option<HashSet<String>> {
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

    pub(super) fn invalidate_scopes(&self, scopes: &[String]) {
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
    let persistence_directory = crate::data_paths::cache_directory(&app).ok();
    search_workspace_inner_with_cache_and_persistence(
        PathBuf::from(root),
        query,
        &cache,
        persistence_directory.as_deref(),
    )
}

#[cfg(test)]
pub(super) fn search_workspace_inner(
    root: PathBuf,
    query: String,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    let cache = WorkspaceSearchCache::default();
    search_workspace_inner_with_cache(root, query, &cache)
}

#[cfg(test)]
pub(super) fn search_workspace_inner_with_cache(
    root: PathBuf,
    query: String,
    cache: &WorkspaceSearchCache,
) -> Result<Vec<WorkspaceSearchResult>, String> {
    search_workspace_inner_with_cache_and_persistence(root, query, cache, None)
}

pub(super) fn search_workspace_inner_with_cache_and_persistence(
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
