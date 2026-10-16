use crate::*;
use std::path::PathBuf;
pub fn runtime() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("MOYANG_OLLAMA_PATH") {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(root) = exe.parent() {
            candidates.push(root.join("ollama/runtime/ollama.exe"));
            candidates.push(root.join("ollama/ollama.exe"));
            if let Ok(bytes) = std::fs::read(root.join("online-update.json")) {
                if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    if let Some(path) = value["runtime"].as_str() {
                        candidates.push(PathBuf::from(path));
                    }
                }
            }
        }
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(PathBuf::from(local).join("Programs/Ollama/ollama.exe"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.local/ollama/runtime/ollama.exe"),
    );
    candidates.into_iter().find(|p| p.is_file())
}
pub fn local_model(
    store: &mut Store,
    action: &str,
) -> std::result::Result<serde_json::Value, String> {
    let endpoint = "http://127.0.0.1:11434";
    let mut status = local_model_status(endpoint);
    let executable = runtime();
    if action == "status" {
        status["runtime_available"] = serde_json::json!(executable.is_some());
        return Ok(status);
    }
    if !["start", "install"].contains(&action) {
        return Err("未知模型操作。".into());
    }
    if status["running"] != true {
        let executable = executable
            .ok_or("没有找到 Ollama。请安装 Ollama，或将便携运行程序放到 ollama/runtime 目录。")?;
        let mut command = std::process::Command::new(&executable);
        command
            .arg("serve")
            .env("OLLAMA_HOST", "127.0.0.1:11434")
            .env("OLLAMA_NO_CLOUD", "true")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        if let Some(root) = executable.parent().filter(|p| {
            std::env::var_os("OLLAMA_MODELS").is_none()
                && p.file_name().is_some_and(|n| n == "runtime")
        }) {
            command.env("OLLAMA_MODELS", root.parent().unwrap().join("models"));
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        command.spawn().map_err(|e| e.to_string())?;
        for _ in 0..30 {
            std::thread::sleep(std::time::Duration::from_millis(200));
            status = local_model_status(endpoint);
            if status["running"] == true {
                break;
            }
        }
    }
    if status["running"] != true {
        return Err("本地模型服务尚未启动，请重试。".into());
    }
    if action == "install" && status["model_ready"] != true {
        install_embedding_model(endpoint).map_err(|e| e.to_string())?;
    }
    status = local_model_status(endpoint);
    if status["model_ready"] == true {
        store
            .configure_semantic(SemanticConfig {
                enabled: true,
                endpoint: endpoint.into(),
                model: "qwen3-embedding:0.6b".into(),
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(status)
}

/// Start only an already-configured local runtime, then incrementally fill missing vectors.
/// No download or unrelated model is introduced by this background task.
pub fn maintain_semantic(directory: &std::path::Path) {
    use std::sync::{Mutex, OnceLock};
    static ACTIVE: OnceLock<Mutex<std::collections::HashSet<PathBuf>>> = OnceLock::new();
    let active = ACTIVE.get_or_init(|| Mutex::new(Default::default()));
    let Ok(mut entries) = active.lock() else {
        return;
    };
    if !entries.insert(directory.to_path_buf()) {
        return;
    }
    let directory = directory.to_path_buf();
    drop(entries);
    std::thread::spawn(move || {
        let run = || -> Result<()> {
            let mut store = Store::open(&directory)?;
            let config = store.semantic_config()?;
            if !config.enabled || store.semantic_paused()? {
                return Ok(());
            }
            if config.endpoint.trim_end_matches('/') == "http://127.0.0.1:11434"
                && local_model_status(&config.endpoint)["running"] != true
            {
                local_model(&mut store, "start").map_err(|e| invalid(&e))?;
                // Starting the service must not replace a user's model selection.
                store.configure_semantic(config)?;
            }
            loop {
                let result = store.index_semantic()?;
                store.set_setting_value(
                    "semantic_background",
                    &serde_json::json!({"at":now(),"remaining":result["remaining"]}),
                )?;
                if result["remaining"].as_u64().unwrap_or(0) == 0
                    || result["paused"] == true
                    || result["busy"] == true
                    || result["changed"] == true
                {
                    break;
                }
            }
            Ok(())
        };
        if let Err(error) = run() {
            if let Ok(store) = Store::open(&directory) {
                let _ = store.set_setting_value(
                    "semantic_background",
                    &serde_json::json!({"at":now(),"error":error.to_string()}),
                );
            }
        }
        if let Ok(mut entries) = active.lock() {
            entries.remove(&directory);
        }
    });
}
