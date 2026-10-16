//! access: extracted from the verified local working copy.
use super::*;

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

pub(super) fn register_access_entry(
    entries: &Mutex<Vec<PathBuf>>,
    path: &Path,
) -> Result<(), String> {
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

pub(super) fn is_access_allowed(entries: &Mutex<Vec<PathBuf>>, path: &Path) -> bool {
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

pub(super) fn normalize_access_path(path: &Path) -> Result<PathBuf, String> {
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

pub(super) fn access_path_contains(root: &Path, candidate: &Path) -> bool {
    let root = access_path_key(root);
    let candidate = access_path_key(candidate);
    candidate == root || candidate.starts_with(&(root.trim_end_matches('/').to_string() + "/"))
}

pub(super) fn access_path_key(path: &Path) -> String {
    let value = path.to_string_lossy().replace('\\', "/");
    if cfg!(windows) {
        let value = value.to_ascii_lowercase();
        if let Some(unc) = value.strip_prefix("//?/unc/") {
            format!("//{unc}")
        } else {
            value.strip_prefix("//?/").unwrap_or(&value).to_string()
        }
    } else {
        value
    }
}
