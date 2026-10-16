//! Explicit data isolation for validation and portable environments; defaults stay unchanged.
use std::{ffi::OsString, path::PathBuf};
use tauri::Manager;

fn select_directory(
    override_root: Option<OsString>,
    suffix: &str,
    fallback: impl FnOnce() -> Result<PathBuf, String>,
) -> Result<PathBuf, String> {
    match override_root {
        Some(root) => Ok(PathBuf::from(root).join(suffix)),
        None => fallback(),
    }
}

pub(crate) fn data_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    select_directory(std::env::var_os("MOYANG_DATA_DIR"), "", || {
        app.path().app_data_dir().map_err(|e| e.to_string())
    })
}

pub(crate) fn config_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    select_directory(std::env::var_os("MOYANG_DATA_DIR"), "", || {
        app.path().app_config_dir().map_err(|e| e.to_string())
    })
}

pub(crate) fn cache_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    select_directory(std::env::var_os("MOYANG_DATA_DIR"), "cache", || {
        app.path().app_cache_dir().map_err(|e| e.to_string())
    })
}

pub(crate) fn ai_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    select_directory(std::env::var_os("MOYANG_AI_DATA_DIR"), "", || {
        data_directory(app).map(|root| root.join("ai-space"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_directories_are_kept_when_no_override_is_set() {
        for directory in ["original-config", "original-data", "original-cache"] {
            assert_eq!(
                select_directory(None, "cache", || Ok(PathBuf::from(directory))).unwrap(),
                PathBuf::from(directory)
            );
        }
    }

    #[test]
    fn explicit_root_isolates_data_settings_cache_and_default_ai() {
        let root = PathBuf::from("isolated-root");
        for suffix in ["", "cache", "ai-space"] {
            assert_eq!(
                select_directory(Some(root.clone().into_os_string()), suffix, || {
                    panic!("an explicit override must not resolve a personal directory")
                })
                .unwrap(),
                root.join(suffix)
            );
        }
    }

    #[test]
    fn ai_specific_override_takes_priority_over_the_shared_root() {
        let resolve = |ai_override| {
            select_directory(ai_override, "", || {
                select_directory(Some(OsString::from("shared-root")), "ai-space", || {
                    panic!("default directory should not be accessed")
                })
            })
            .unwrap()
        };
        assert_eq!(resolve(None), PathBuf::from("shared-root").join("ai-space"));
        assert_eq!(
            resolve(Some(OsString::from("explicit-ai"))),
            PathBuf::from("explicit-ai")
        );
    }
}
