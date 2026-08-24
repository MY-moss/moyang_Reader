mod commands;

use std::path::Path;

use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(commands::AccessRegistry::default())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = argv
                .into_iter()
                .skip(1)
                .filter(|argument| {
                    Path::new(argument).is_file()
                        && commands::is_supported_document_path(Path::new(argument))
                })
                .collect::<Vec<_>>();

            if !paths.is_empty() {
                let access = app.state::<commands::AccessRegistry>();
                for path in &paths {
                    let _ = access.register_document_path(Path::new(path));
                }
                let _ = app.emit("open-paths", paths);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

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
            commands::choose_document_path,
            commands::choose_workspace_path,
            commands::choose_save_path,
            commands::close_window,
            commands::read_text_file,
            commands::read_binary_file,
            commands::path_exists,
            commands::file_size,
            commands::write_text_file,
            commands::write_binary_file,
            commands::create_markdown_file,
            commands::list_workspace_files,
            commands::search_workspace,
            commands::index_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running Moyang Reader");
}
