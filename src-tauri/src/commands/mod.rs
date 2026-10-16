mod reader_drafts;
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

pub(crate) mod search;
#[allow(unused_imports)]
pub(crate) use search::*;
pub(crate) mod access;
#[allow(unused_imports)]
pub(crate) use access::*;
pub(crate) mod dialogs;
#[allow(unused_imports)]
pub(crate) use dialogs::*;
pub(crate) mod settings;
#[allow(unused_imports)]
pub(crate) use settings::*;
pub(crate) mod files;
#[allow(unused_imports)]
pub(crate) use files::*;
pub(crate) mod watcher;
#[allow(unused_imports)]
pub(crate) use watcher::*;
pub(crate) mod workspace;
#[allow(unused_imports)]
pub(crate) use workspace::*;
pub(crate) mod index;
#[allow(unused_imports)]
pub(crate) use index::*;
pub(crate) mod entries;
mod rename;
#[allow(unused_imports)]
pub(crate) use entries::*;
pub(crate) mod pdf;
#[allow(unused_imports)]
pub(crate) use pdf::*;

#[cfg(test)]
mod tests;

pub(crate) mod bookroom;

pub(crate) mod recycle;
