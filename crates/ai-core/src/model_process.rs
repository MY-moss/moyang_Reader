//! Verify the exact runtime process across application restarts before stopping it.
use crate::*;
use serde_json::{json, Value};
use std::path::Path;
#[cfg(windows)]
fn process_command(pid: u32, stop: Option<&str>) -> Result<Value> {
    let script = if let Some(start) = stop {
        let ticks: i64 = start
            .parse()
            .map_err(|_| invalid("本地模型进程记录无效。"))?;
        format!("$p=Get-Process -Id {pid} -ErrorAction SilentlyContinue; if($p -and $p.StartTime.ToUniversalTime().Ticks -eq {ticks}) {{$p.Kill(); $p.WaitForExit(); '{{\"stopped\":true}}'}} else {{'{{\"stopped\":false}}'}}")
    } else {
        format!("$p=Get-Process -Id {pid} -ErrorAction SilentlyContinue; if($p) {{@{{path=$p.Path; started=$p.StartTime.ToUniversalTime().Ticks.ToString()}} | ConvertTo-Json -Compress}} else {{'null'}}")
    };
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(0x08000000)
        .output()?;
    if !output.status.success() {
        return Err(invalid(
            "无法核对本地模型进程，请在任务管理器中关闭本应用启动的 Ollama。",
        ));
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}
pub(crate) fn remember(root: &Path, pid: u32, directory: &Path, _executable: &Path) -> Result<()> {
    #[cfg(windows)]
    let identity = process_command(pid, None)?;
    #[cfg(windows)]
    let executable = identity["path"]
        .as_str()
        .map(Path::new)
        .ok_or_else(|| invalid("模型运行程序启动后已退出。"))?;
    #[cfg(not(windows))]
    let identity = Value::Null;
    #[cfg(not(windows))]
    let executable = _executable;
    let value =
        json!({"pid":pid,"directory":directory,"executable":executable,"identity":identity});
    use std::io::Write;
    let mut tmp = tempfile::NamedTempFile::new_in(root)?;
    tmp.write_all(&serde_json::to_vec(&value)?)?;
    tmp.as_file().sync_all()?;
    tmp.persist(root.join("model-runtime.json"))
        .map_err(|e| e.error)?;
    Ok(())
}
pub(crate) fn ownership(root: &Path) -> Option<Value> {
    std::fs::read(root.join("model-runtime.json"))
        .ok()
        .and_then(|v| serde_json::from_slice(&v).ok())
}
pub(crate) fn owns_running(root: &Path, directory: &Path) -> bool {
    let Some(owner) = ownership(root) else {
        return false;
    };
    if owner["directory"] != json!(directory) {
        return false;
    }
    #[cfg(windows)]
    {
        let Some(pid) = owner["pid"].as_u64().and_then(|n| u32::try_from(n).ok()) else {
            return false;
        };
        return process_command(pid, None)
            .is_ok_and(|current| !current.is_null() && current == owner["identity"]);
    }
    #[cfg(not(windows))]
    {
        false
    }
}
pub(crate) fn stop(root: &Path) -> Result<()> {
    let value = ownership(root)
        .ok_or_else(|| invalid("此模型服务没有本应用的启动记录，请关闭该 Ollama 服务后重试。"))?;
    #[cfg(windows)]
    {
        let pid = value["pid"]
            .as_u64()
            .and_then(|n| u32::try_from(n).ok())
            .ok_or_else(|| invalid("进程记录无效。"))?;
        let actual = process_command(pid, None)?;
        if actual.is_null() {
            return Ok(());
        }
        if actual != value["identity"]
            || actual["path"].as_str().map(|p| p.to_lowercase())
                != value["executable"].as_str().map(|p| p.to_lowercase())
        {
            return Err(invalid(
                "模型进程身份已变化，不会关闭其他程序。请手动检查该端口。",
            ));
        }
        let stopped = process_command(pid, actual["started"].as_str())?;
        if stopped["stopped"] != true {
            return Err(invalid("模型进程已变化，请刷新状态。"));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = value;
        Err(invalid("请关闭原 Ollama 进程后重试。"))
    }
}
