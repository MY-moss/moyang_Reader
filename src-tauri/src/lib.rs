mod commands;

use tauri::{Emitter, Url, WindowEvent};

#[cfg(not(feature = "wdio"))]
use tauri::Manager;

const DEV_SERVER_PORT: u16 = 1420;

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
    let builder = tauri::Builder::default()
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
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

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
            commands::initial_paths,
            commands::resolve_open_paths,
            commands::choose_document_paths,
            commands::choose_workspace_path,
            commands::authorize_stored_path,
            commands::choose_save_path,
            commands::close_window,
            commands::read_app_settings,
            commands::write_app_settings,
            commands::read_text_file,
            commands::read_binary_file,
            commands::path_exists,
            commands::file_size,
            commands::file_metadata,
            commands::watch_workspace,
            commands::unwatch_workspace,
            commands::write_text_file,
            commands::write_binary_file,
            commands::write_binary_file_raw,
            commands::export_pdf_file,
            commands::create_markdown_file,
            commands::create_workspace_note,
            commands::create_workspace_folder,
            commands::rename_workspace_entry,
            commands::delete_workspace_entry,
            commands::duplicate_workspace_entry,
            commands::copy_workspace_entry,
            commands::move_workspace_entry,
            commands::reveal_workspace_entry,
            commands::list_workspace_files,
            commands::list_workspace_directories,
            commands::search_workspace,
            commands::index_workspace,
            commands::refresh_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running Moyang Reader");
}

#[cfg(test)]
mod tests {
    use super::is_allowed_app_navigation;
    use tauri::Url;

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
