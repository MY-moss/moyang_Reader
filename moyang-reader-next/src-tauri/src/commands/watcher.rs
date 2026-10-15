//! watcher: extracted from the verified local working copy.
use super::*;

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
    let watch_root = normalized_root.clone();
    let event_app = app.clone();
    let watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| {
            let Ok(event) = result else {
                return;
            };

            let mut paths = event
                .paths
                .into_iter()
                .filter(|path| {
                    !path.strip_prefix(&watch_root).is_ok_and(|relative| {
                        relative
                            .components()
                            .any(|part| should_skip_directory(Path::new(part.as_os_str())))
                    })
                })
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
