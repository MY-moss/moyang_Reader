use crate::data_paths::ai_directory as directory;
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub async fn ai_request(
    app: tauri::AppHandle,
    operation: String,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let path = directory(&app)?;
    let services = crate::data_paths::config_directory(&app)?.join("chat");
    tauri::async_runtime::spawn_blocking(move || {
        if operation=="model_choose_directory" {
            return app.dialog().file().set_title("选择本地模型保存目录").blocking_pick_folder().map(|p|p.into_path().map(|p|serde_json::json!(p)).map_err(|e|e.to_string())).transpose().map(|p|p.unwrap_or(serde_json::Value::Null));
        }
        if operation == "change_token" {
            return crate::ai_changes::token(&path).map(serde_json::Value::String);
        }
        let mut store = moyang_ai_core::Store::open(&path).map_err(|e| e.to_string())?;
        store.bind_services(&services).map_err(|e| e.to_string())?;
        moyang_ai_core::maintain_organization(&path);
        if operation == "local_model" {
            return crate::ai_model::local_model(
                &mut store,
                payload["action"].as_str().unwrap_or("status"),
            );
        }
        if operation == "client_connection" {
            let executable = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .with_file_name(if cfg!(windows) {
                    "moyang-ai-mcp.exe"
                } else {
                    "moyang-ai-mcp"
                });
            return moyang_ai_core::configure_client(
                &store,
                &moyang_ai_core::ClientPaths::user().map_err(|e| e.to_string())?,
                &executable,
                payload["client"].as_str().unwrap_or(""),
                payload["action"].as_str().unwrap_or("status"),
            )
            .map_err(|e| e.to_string());
        }
        let result =
            moyang_ai_core::dispatch(&mut store, &operation, payload).map_err(|e| e.to_string());
        if result.is_ok()
            && [
                "save",
                "patch",
                "import",
                "restore",
                "conclude",
                "semantic_config",
                "semantic_resume",
                "model_action",
                "merge",
                "state",
                "resolve_conflict",
                "undo_activity",
            ]
            .contains(&operation.as_str())
        {
            moyang_ai_core::maintain_semantic(&path);
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn ai_connection_info(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = directory(&app)?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let server = exe
        .parent()
        .ok_or("程序目录不可用")?
        .join(if cfg!(windows) {
            "moyang-ai-mcp.exe"
        } else {
            "moyang-ai-mcp"
        });
    Ok(
        serde_json::json!({"directory":path,"executable":server,"available":server.exists(),"native":true}),
    )
}
