use crate::*;
use std::{io::Read, time::Duration};
pub fn local_model_status(endpoint: &str) -> serde_json::Value {
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .ok()
        .and_then(|c| c.get(format!("{endpoint}/api/tags")).send().ok())
        .and_then(|r| r.json::<serde_json::Value>().ok());
    let ready = response
        .as_ref()
        .and_then(|v| v["models"].as_array())
        .is_some_and(|models| models.iter().any(|m| m["name"] == "qwen3-embedding:0.6b"));
    serde_json::json!({"running":response.is_some(),"model_ready":ready,"model":"qwen3-embedding:0.6b"})
}
pub fn install_embedding_model(endpoint: &str) -> Result<()> {
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(1200))
        .build()
        .map_err(|e| invalid(&e.to_string()))?
        .post(format!("{endpoint}/api/pull"))
        .json(&serde_json::json!({"model":"qwen3-embedding:0.6b","stream":false}))
        .send()
        .map_err(|e| invalid(&format!("模型下载未完成：{e}。可重试继续下载。")))?;
    let value: serde_json::Value = response.json().map_err(|e| invalid(&e.to_string()))?;
    if value["status"] != "success" {
        return Err(invalid(&format!("模型安装未完成：{}", value["error"])));
    }
    Ok(())
}
pub fn fetch_web_source(uri: &str) -> Result<serde_json::Value> {
    let url = reqwest::Url::parse(uri).map_err(|_| invalid("请输入完整的网址。"))?;
    if !["http", "https"].contains(&url.scheme()) {
        return Err(invalid("网页来源需要 http 或 https 地址。"));
    }
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("MoyangReader/0.10 (+local personal knowledge import)")
        .build()
        .map_err(|e| invalid(&e.to_string()))?
        .get(url)
        .send()
        .map_err(|e| {
            invalid(&format!(
                "网页暂时无法访问：{e}。可以粘贴正文或导入保存的文件。"
            ))
        })?;
    if !response.status().is_success() {
        return Err(invalid(&format!(
            "网页返回 {}。需要登录的页面请粘贴正文或导入保存文件。",
            response.status()
        )));
    }
    let final_url = response.url().to_string();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if !content_type.contains("text/") {
        return Err(invalid("这个地址不是网页正文，请使用文件导入。"));
    }
    let mut bytes = Vec::new();
    response.take(20_000_001).read_to_end(&mut bytes)?;
    if bytes.len() > 20_000_000 {
        return Err(invalid("网页超过 20 MB，请保存正文后导入。"));
    }
    let html = String::from_utf8(bytes)
        .map_err(|_| invalid("网页不是 UTF-8 编码，请复制正文或保存为 UTF-8 文件后导入。"))?;
    Ok(serde_json::json!({"uri":final_url,"html":html,"content_type":content_type}))
}
