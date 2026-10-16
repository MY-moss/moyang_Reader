mod ai;
mod ai_model;
mod chat;
mod commands;
mod data_paths;
mod extensions;
mod online_update;
mod storage;

use tauri::{Emitter, Url, WindowEvent};

#[cfg(not(feature = "wdio"))]
use tauri::Manager;

const DEV_SERVER_PORT: u16 = 1420;

fn updater_is_configured(value: Option<&serde_json::Value>) -> bool {
    value.is_some_and(|config| {
        config
            .get("pubkey")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|key| !key.trim().is_empty())
            && config
                .get("endpoints")
                .and_then(serde_json::Value::as_array)
                .is_some_and(|endpoints| !endpoints.is_empty())
    })
}

fn is_allowed_app_navigation(url: &Url) -> bool {
    match url.scheme() {
        // Tauri's production asset protocol is local to the application.
        "asset" => true,
        // macOS/Linux builds may use the legacy custom protocol origin.
        "tauri" => url.host_str() == Some("localhost"),
        // Windows production builds use https://tauri.localhost; development
        // uses the Vite server configured in tauri.conf.json.
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => url.port().is_none(),
            Some("127.0.0.1") | Some("localhost") => url.port() == Some(DEV_SERVER_PORT),
            _ => false,
        },
        _ => false,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if online_update::forward_to_current() {
        return;
    }
    let context = tauri::generate_context!();
    let enable_updater = updater_is_configured(context.config().plugins.0.get("updater"));
    let builder = tauri::Builder::default()
        .manage(chat::ChatRequests::default())
        .manage(online_update::OnlineUpdate::default())
        .manage(storage::StorageMigration::default())
        .manage(commands::AccessRegistry::default())
        .manage(commands::WorkspaceWatcher::default())
        .manage(commands::WorkspaceSearchCache::default());

    #[cfg(not(feature = "wdio"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        let paths = commands::collect_open_paths(argv.into_iter().skip(1));

        if !paths.is_empty() {
            let access = app.state::<commands::AccessRegistry>();
            for path in &paths {
                let _ = commands::register_open_path(access.inner(), path);
            }
            let _ = app.emit("open-paths", paths);
        }

        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("navigation-guard")
                .on_navigation(|window, url| {
                    let allowed = window.label() != "main" || is_allowed_app_navigation(url);
                    if !allowed {
                        eprintln!("blocked navigation in main window: {url}");
                    }
                    allowed
                })
                .build(),
        );

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    let builder = if enable_updater {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };

    #[cfg(feature = "wdio")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.emit("close-requested", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            chat::chat_request,
            chat::chat_models,
            chat::chat_stream,
            chat::chat_cancel,
            online_update::online_update_check,
            online_update::online_update_download,
            online_update::online_update_activate,
            online_update::online_update_failure,
            storage::storage_info,
            storage::storage_choose_target,
            storage::storage_prepare,
            storage::storage_start,
            commands::bookroom::bookroom_request,
            ai::ai_request,
            extensions::extension_request,
            ai::ai_connection_info,
            commands::dialogs::initial_paths,
            commands::dialogs::resolve_open_paths,
            commands::dialogs::choose_document_paths,
            commands::dialogs::choose_workspace_path,
            commands::dialogs::authorize_stored_path,
            commands::dialogs::choose_save_path,
            commands::settings::close_window,
            commands::settings::read_app_settings,
            commands::settings::write_app_settings,
            commands::files::read_text_file,
            commands::files::read_binary_file,
            commands::files::path_exists,
            commands::files::file_size,
            commands::files::file_metadata,
            commands::watcher::watch_workspace,
            commands::watcher::unwatch_workspace,
            commands::files::write_text_file,
            commands::files::write_binary_file,
            commands::files::write_binary_file_raw,
            commands::pdf::export_pdf_file,
            commands::entries::create_markdown_file,
            commands::entries::create_workspace_note,
            commands::entries::create_workspace_folder,
            commands::entries::rename_workspace_entry,
            commands::entries::delete_workspace_entry,
            commands::entries::duplicate_workspace_entry,
            commands::entries::reveal_workspace_entry,
            commands::workspace::list_workspace_files,
            commands::workspace::list_workspace_directories,
            commands::search::search_workspace,
            commands::index::index_workspace,
            commands::index::refresh_workspace
        ])
        .run(context)
        .expect("error while running Moyang Reader");
}

#[cfg(test)]
mod tests {
    use super::is_allowed_app_navigation;
    use super::updater_is_configured;
    use tauri::Url;

    #[test]
    fn starts_without_a_release_update_channel() {
        assert!(!updater_is_configured(None));
        assert!(!updater_is_configured(Some(&serde_json::json!({}))));
        assert!(!updater_is_configured(Some(
            &serde_json::json!({"pubkey": "key", "endpoints": []})
        )));
    }

    #[test]
    fn enables_a_configured_release_update_channel() {
        assert!(updater_is_configured(Some(&serde_json::json!({
            "pubkey": "release-verification-key",
            "endpoints": ["https://updates.example.test/latest.json"]
        }))));
    }

    #[test]
    fn allows_app_origins_and_dev_server() {
        for raw in [
            "asset://localhost/assets/index.js",
            "tauri://localhost/index.html",
            "https://tauri.localhost/",
            "http://127.0.0.1:1420/",
            "http://localhost:1420/settings",
        ] {
            let url = Url::parse(raw).expect("test URL should parse");
            assert!(
                is_allowed_app_navigation(&url),
                "expected allowed URL: {raw}"
            );
        }
    }

    #[test]
    fn blocks_external_and_unsupported_navigation() {
        for raw in [
            "https://example.com/",
            "http://127.0.0.1:3000/",
            "file:///C:/secret.txt",
            "mailto:someone@example.com",
            "javascript:alert(1)",
            "moyang-wiki:Next",
        ] {
            let url = Url::parse(raw).expect("test URL should parse");
            assert!(
                !is_allowed_app_navigation(&url),
                "expected blocked URL: {raw}"
            );
        }
    }
}
