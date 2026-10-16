//! Managed local embedding runtime and resumable model downloads.
use crate::*;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};
pub const MANAGED_ENDPOINT: &str = "http://127.0.0.1:11435";
pub fn model_presets() -> Value {
    json!([
        {"id":"qwen3-embedding:0.6b","name":"轻量 · 0.6B","bytes":639_000_000u64,"description":"适合先尝试，下载小、资源需求较低。","url":"https://ollama.com/library/qwen3-embedding:0.6b"},
        {"id":"qwen3-embedding:4b","name":"均衡 · 4B","bytes":2_500_000_000u64,"description":"适合有较充足内存的设备；速度取决于 CPU / GPU。","url":"https://ollama.com/library/qwen3-embedding:4b"},
        {"id":"qwen3-embedding:8b","name":"较大 · 8B","bytes":4_700_000_000u64,"description":"资源需求更高，建议有独立显卡时按需选择。","url":"https://ollama.com/library/qwen3-embedding:8b"}
    ])
}
struct Download {
    cancel: Arc<AtomicBool>,
    status: Value,
}
fn downloads() -> &'static Mutex<HashMap<PathBuf, Download>> {
    static VALUE: OnceLock<Mutex<HashMap<PathBuf, Download>>> = OnceLock::new();
    VALUE.get_or_init(Default::default)
}
fn process() -> &'static Mutex<Option<(PathBuf, std::process::Child)>> {
    static VALUE: OnceLock<Mutex<Option<(PathBuf, std::process::Child)>>> = OnceLock::new();
    VALUE.get_or_init(Default::default)
}
fn status(endpoint: &str, model: &str) -> Value {
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .ok()
        .and_then(|c| c.get(format!("{endpoint}/api/tags")).send().ok())
        .filter(|r| r.status().is_success())
        .and_then(|r| r.json::<Value>().ok());
    let models = response
        .as_ref()
        .and_then(|r| r["models"].as_array())
        .cloned()
        .unwrap_or_default();
    json!({"running":response.is_some(),"model_ready":models.iter().any(|m|m["name"]==model),"installed":models.iter().map(|m|json!({"name":m["name"],"size":m["size"]})).collect::<Vec<_>>()})
}
impl Store {
    pub fn model_directory(&self) -> Result<PathBuf> {
        let config = self.setting_value("local_model")?;
        if let Some(path) = config["directory"].as_str() {
            return Ok(PathBuf::from(path));
        }
        if let Some(runtime) = crate::local_model_runtime()
            .and_then(|p| {
                p.parent()
                    .filter(|p| p.file_name().is_some_and(|n| n == "runtime"))
                    .map(|p| p.parent().unwrap().join("models"))
            })
            .filter(|p| p.is_dir())
        {
            return Ok(runtime);
        }
        Ok(self.path.parent().unwrap().join("models"))
    }
    pub fn model_status(&self) -> Result<Value> {
        let config = self.setting_value("local_model")?;
        let model = config["model"].as_str().unwrap_or("qwen3-embedding:0.6b");
        let mut out = status(MANAGED_ENDPOINT, model);
        out["directory"] = json!(self.model_directory()?);
        out["model"] = json!(model);
        out["endpoint"] = json!(MANAGED_ENDPOINT);
        out["presets"] = model_presets();
        out["runtime_available"] = json!(crate::local_model_runtime().is_some());
        out["download"] = downloads()
            .lock()
            .map_err(|_| invalid("模型下载状态不可用。"))?
            .get(&self.path)
            .map(|v| v.status.clone())
            .unwrap_or(json!({"state":"idle"}));
        out["can_stop"] = json!(process().lock().is_ok_and(|p| p.is_some()));
        if let Some(owner) = crate::model_process::ownership(self.path.parent().unwrap()) {
            out["runtime_directory"] = owner["directory"].clone();
            out["can_stop"] = json!(true);
        }
        Ok(out)
    }
    pub fn configure_model(&self, model: &str, directory: &Path) -> Result<Value> {
        if model.trim().is_empty() || model.len() > 200 || model.chars().any(char::is_whitespace) {
            return Err(invalid("模型名称无效。"));
        }
        if !directory.is_absolute() {
            return Err(invalid("请选择模型保存的完整目录。"));
        }
        if downloads()
            .lock()
            .map_err(|_| invalid("模型状态不可用。"))?
            .get(&self.path)
            .is_some_and(|d| d.status["state"] == "downloading")
        {
            return Err(invalid("请先取消当前下载，再更改保存位置或模型。"));
        }
        let old = self.model_directory()?;
        if old != directory && status(MANAGED_ENDPOINT, model)["running"] == true {
            return Err(invalid(
                "请先停止本应用的模型服务，再更改下载目录；已有模型可从存储页迁移。",
            ));
        }
        std::fs::create_dir_all(directory)?;
        // Probe only a new temporary file. Existing model contents are never overwritten here.
        let probe = tempfile::NamedTempFile::new_in(directory)?;
        probe.as_file().sync_all()?;
        self.set_setting_value("local_model", &json!({"model":model,"directory":directory}))?;
        self.model_status()
    }
    pub fn start_managed_model(&self) -> Result<()> {
        let directory = self.model_directory()?;
        if status(MANAGED_ENDPOINT, "")["running"] == true {
            let owner = crate::model_process::ownership(self.path.parent().unwrap());
            if owner
                .as_ref()
                .is_some_and(|v| v["directory"] == json!(directory))
            {
                return Ok(());
            }
            return Err(invalid(
                "模型端口已由其他目录或服务使用，请先停止原服务；本次不会下载到未知位置。",
            ));
        }
        let executable = crate::local_model_runtime().ok_or_else(|| {
            invalid("未找到 Ollama 运行程序。请安装 Ollama 或使用含运行程序的便携包。")
        })?;
        std::fs::create_dir_all(&directory)?;
        let mut owned = process()
            .lock()
            .map_err(|_| invalid("本地模型进程状态不可用。"))?;
        if status(MANAGED_ENDPOINT, "")["running"] == true {
            if crate::model_process::ownership(self.path.parent().unwrap())
                .is_some_and(|v| v["directory"] == json!(directory))
            {
                return Ok(());
            }
            return Err(invalid("模型端口已被其他服务占用，请停止原服务后重试。"));
        }
        let mut command = std::process::Command::new(&executable);
        command
            .arg("serve")
            .env("OLLAMA_HOST", "127.0.0.1:11435")
            .env("OLLAMA_MODELS", &directory)
            .env("OLLAMA_NO_CLOUD", "true")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn()?;
        if let Err(error) = crate::model_process::remember(
            self.path.parent().unwrap(),
            child.id(),
            &directory,
            &executable,
        ) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        *owned = Some((directory, child));
        drop(owned);
        for _ in 0..25 {
            if status(MANAGED_ENDPOINT, "")["running"] == true {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        Err(invalid("本应用的模型服务尚未就绪，请稍后重试。"))
    }
    pub fn model_action(&mut self, action: &str) -> Result<Value> {
        if action == "status" {
            return self.model_status();
        }
        if action == "cancel" {
            if let Some(d) = downloads()
                .lock()
                .map_err(|_| invalid("模型状态不可用。"))?
                .get(&self.path)
            {
                d.cancel.store(true, Ordering::Relaxed);
            }
            return self.model_status();
        }
        if action == "stop" {
            if self.semantic_config()?.endpoint == MANAGED_ENDPOINT {
                self.pause_semantic(true)?;
            }
            if let Some(d) = downloads()
                .lock()
                .map_err(|_| invalid("模型状态不可用。"))?
                .get(&self.path)
            {
                d.cancel.store(true, Ordering::Relaxed);
            }
            let mut owned = process()
                .lock()
                .map_err(|_| invalid("模型进程状态不可用。"))?;
            if let Some((_, mut child)) = owned.take() {
                child.kill()?;
                child.wait()?;
            } else if status(MANAGED_ENDPOINT, "")["running"] == true {
                crate::model_process::stop(self.path.parent().unwrap())?;
            }
            drop(owned);
            return self.model_status();
        }
        if !["start", "install", "download", "use"].contains(&action) {
            return Err(invalid("未知模型操作。"));
        }
        self.start_managed_model()?;
        let current = self.model_status()?;
        let model = current["model"].as_str().unwrap().to_owned();
        if action == "use" || (action == "start" && current["model_ready"] == true) {
            if current["model_ready"] != true {
                return Err(invalid("请先下载选中的模型。"));
            }
            self.configure_semantic(SemanticConfig {
                enabled: true,
                endpoint: MANAGED_ENDPOINT.into(),
                model,
                protocol: "ollama".into(),
                provider: String::new(),
            })?;
            self.pause_semantic(false)?;
        } else if action == "install" || action == "download" {
            let mut entries = downloads()
                .lock()
                .map_err(|_| invalid("模型下载状态不可用。"))?;
            if entries
                .get(&self.path)
                .is_some_and(|d| d.status["state"] == "downloading")
            {
                return Err(invalid("已有模型下载正在进行。"));
            }
            let cancel = Arc::new(AtomicBool::new(false));
            entries.insert(self.path.clone(),Download{cancel:cancel.clone(),status:json!({"state":"downloading","status":"正在连接模型目录","model":model})});
            let path = self.path.clone();
            drop(entries);
            std::thread::spawn(move || {
                let result = pull(&path, MANAGED_ENDPOINT, &model, cancel.clone());
                let out = match result {
                    Ok(()) => {
                        json!({"state":"ready","model":model,"status":"下载完成，点击使用此模型建立索引"})
                    }
                    Err(e) => {
                        json!({"state":if cancel.load(Ordering::Relaxed){"cancelled"}else{"failed"},"model":model,"status":e.to_string()})
                    }
                };
                if let Ok(mut entries) = downloads().lock() {
                    if let Some(d) = entries.get_mut(&path) {
                        d.status = out;
                    }
                }
            });
        }
        self.model_status()
    }
}
fn pull(path: &Path, endpoint: &str, model: &str, cancel: Arc<AtomicBool>) -> Result<()> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;
    rt.block_on(async{
        let fetch=async{
            let client=reqwest::Client::builder().timeout(Duration::from_secs(7200)).build().map_err(|_|invalid("下载初始化失败。"))?;
            let mut response=client.post(format!("{endpoint}/api/pull")).json(&json!({"model":model,"stream":true})).send().await.map_err(|_|invalid("下载连接失败，可重试继续。"))?;
            if !response.status().is_success(){return Err(invalid("模型目录暂不可用，请检查网络与模型名称。"));}
            let mut pending=Vec::new();let mut complete=false;
            while let Some(chunk)=response.chunk().await.map_err(|_|invalid("下载连接中断，可重试继续。"))? {
                pending.extend_from_slice(&chunk);
                while let Some(end)=pending.iter().position(|b|*b==b'\n') {
                    let line=pending.drain(..=end).collect::<Vec<_>>();
                    if line.iter().all(u8::is_ascii_whitespace){continue;}
                    let value:Value=serde_json::from_slice(&line)?;
                    if let Some(error)=value["error"].as_str(){return Err(invalid(error));}
                    complete|=value["status"]=="success";
                    if let Ok(mut entries)=downloads().lock(){if let Some(d)=entries.get_mut(path){d.status=json!({"state":"downloading","model":model,"status":value["status"],"total":value["total"],"completed":value["completed"]});}}
                }
                if pending.len()>65536{return Err(invalid("下载进度响应异常。"));}
            }
            if !pending.is_empty(){let v:Value=serde_json::from_slice(&pending)?;complete|=v["status"]=="success";}
            if !complete{return Err(invalid("下载未完成，可重试继续。"));}Ok(())
        };
        tokio::pin!(fetch);
        loop {tokio::select!{result=&mut fetch=>return result,_=tokio::time::sleep(Duration::from_millis(80))=>if cancel.load(Ordering::Relaxed){return Err(invalid("已停止下载请求；已下载的分块可供重试使用。"));}}}
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    #[test]
    fn model_download_streams_progress_and_cancellation_closes_request() {
        for cancelled in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("test.sqlite");
            let flag = Arc::new(AtomicBool::new(false));
            downloads().lock().unwrap().insert(
                path.clone(),
                Download {
                    cancel: flag.clone(),
                    status: json!({"state":"downloading"}),
                },
            );
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let url = format!("http://{}", listener.local_addr().unwrap());
            let cancel = flag.clone();
            let worker = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut bytes = [0; 4096];
                assert!(socket.read(&mut bytes).unwrap() > 0);
                if cancelled {
                    cancel.store(true, Ordering::Relaxed);
                    loop {
                        match socket.read(&mut bytes) {
                            Ok(0) => break,
                            Ok(_) => {}
                            Err(e) => panic!("cancel failed: {e}"),
                        }
                    }
                } else {
                    let body="{\"status\":\"downloading\",\"total\":10,\"completed\":5}\n{\"status\":\"success\"}\n";
                    write!(
                        socket,
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                        body.len()
                    )
                    .unwrap();
                }
            });
            let result = pull(&path, &url, "test-embedding", flag);
            assert_eq!(result.is_err(), cancelled);
            worker.join().unwrap();
            downloads().lock().unwrap().remove(&path);
        }
    }
}
