use crate::data_paths::ai_directory as directory;
#[tauri::command]
pub async fn ai_request(
    app: tauri::AppHandle,
    operation: String,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let path = directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if operation == "change_token" {
            return crate::ai_changes::token(&path).map(serde_json::Value::String);
        }
        let mut store = moyang_ai_core::Store::open(&path).map_err(|e| e.to_string())?;
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
                "import",
                "restore",
                "conclude",
                "semantic_config",
                "semantic_resume",
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
