use rmcp::{model::CallToolRequestParams, transport::TokioChildProcess, ServiceExt};
use serde_json::{json, Value};
use tokio::process::Command;

#[tokio::test]
async fn source_inventory_through_stdio_is_scoped_and_metadata_only() {
    let dir = tempfile::tempdir().unwrap();
    let c = client(dir.path()).await;
    let imported = call(&c,"save_record",json!({"kind":"knowledge","title":"来源目录","body":"不得放入清单的完整正文","project":"sources","snapshot":{"uri":"D:/source.md","format":"markdown","fingerprint":"fingerprint","imported_at":1,"locations":[]}})).await;
    call(&c,"save_record",json!({"kind":"knowledge","title":"其他范围","body":"其他项目正文","project":"other","snapshot":{"uri":"D:/other.md","format":"markdown","fingerprint":"other","imported_at":1,"locations":[]}})).await;
    let list = call(&c,"list_knowledge_sources",json!({"project":"sources","limit":1})).await;
    assert_eq!(list["total"],1);
    assert_eq!(list["items"][0]["id"],imported["id"]);
    assert!(list["items"][0].get("body").is_none());
    assert!(list["items"][0].get("assets").is_none());
    assert_eq!(call(&c,"get_record",json!({"id":imported["id"]})).await["revision"],1);
    c.cancel().await.unwrap();
}

#[test]
fn request_mode_supports_semantic_search_and_web_fetch_without_runtime_panics() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        for _ in 0..3 {
            let (mut socket, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            loop {
                let mut bytes = [0; 4096];
                let n = socket.read(&mut bytes).unwrap();
                assert!(n > 0);
                request.extend_from_slice(&bytes[..n]);
                if let Some(end) = request.windows(4).position(|v| v == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]);
                    let length: usize = headers
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .map(|v| v.trim().parse().unwrap())
                        })
                        .unwrap_or(0);
                    if request.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let (mime, body) = if request.starts_with(b"GET ") {
                ("text/html", "<html><body>Isolated source</body></html>")
            } else {
                ("application/json", r#"{"embeddings":[[1.0,0.0]]}"#)
            };
            write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    let directory = tempfile::tempdir().unwrap();
    let mut store = moyang_ai_core::Store::open(directory.path()).unwrap();
    store
        .save(
            serde_json::from_value(
                json!({"kind":"knowledge","title":"fixture","body":"Local evidence"}),
            )
            .unwrap(),
        )
        .unwrap();
    store
        .configure_semantic(moyang_ai_core::SemanticConfig {
            enabled: true,
            endpoint: endpoint.clone(),
            model: "fixture".into(),
        })
        .unwrap();
    store.index_semantic().unwrap();
    let request = |operation: &str, payload: Value| {
        let mut child = std::process::Command::new(env!("CARGO_BIN_EXE_moyang-ai-mcp"))
            .arg("--data-dir")
            .arg(directory.path())
            .arg("--request")
            .arg(operation)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(payload.to_string().as_bytes())
            .unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice::<Value>(&output.stdout).unwrap()
    };
    assert_eq!(
        request(
            "search",
            json!({"query":"different wording","semantic":true})
        )["total"],
        1
    );
    assert!(request("fetch_web", json!({"uri":endpoint}))["html"]
        .as_str()
        .unwrap()
        .contains("Isolated source"));
    worker.join().unwrap();
}

async fn client(path: &std::path::Path) -> rmcp::service::RunningService<rmcp::RoleClient, ()> {
    let mut command = Command::new(env!("CARGO_BIN_EXE_moyang-ai-mcp"));
    command.arg("--data-dir").arg(path);
    ().serve(TokioChildProcess::new(command).unwrap())
        .await
        .unwrap()
}
async fn call(
    c: &rmcp::service::RunningService<rmcp::RoleClient, ()>,
    name: &str,
    args: Value,
) -> Value {
    let result = c
        .call_tool(
            CallToolRequestParams::new(name.to_string())
                .with_arguments(args.as_object().unwrap().clone()),
        )
        .await
        .unwrap();
    let value = serde_json::to_value(result).unwrap();
    assert_ne!(value["isError"], true, "{value}");
    serde_json::from_str(value["content"][0]["text"].as_str().unwrap()).unwrap()
}
#[tokio::test]
async fn real_stdio_client_roundtrip_restart_and_cross_process_revision() {
    let dir = tempfile::tempdir().unwrap();
    let c = client(dir.path()).await;
    let tools = c.list_all_tools().await.unwrap();
    assert!(tools.iter().any(|t| t.name == "recall_context"));
    assert!(tools.iter().any(|t| t.name == "read_skill_resource"));
    assert!(tools.iter().any(|t| t.name == "library_health"));
    assert!(tools.iter().any(|t| t.name == "list_knowledge_sources"));
    let memory=call(&c,"save_record",json!({"kind":"memory","title":"写作偏好","body":"偏好简洁中文回答","project":"book","source":"用户确认"})).await;
    let id = memory["id"].as_str().unwrap();
    let found = call(&c, "search", json!({"query":"中文","project":"book"})).await;
    assert_eq!(found["total"], 1);
    let hidden = call(
        &c,
        "search",
        json!({"query":"中文","project":"other","include_global":false}),
    )
    .await;
    assert_eq!(hidden["total"], 0);
    let health = call(&c, "library_health", json!({"project":"book"})).await;
    assert_eq!(health["scanned"], 1);
    assert_eq!(health["total"], 0);
    let unrelated = call(&c, "library_health", json!({"project":"other"})).await;
    assert_eq!(unrelated["scanned"], 0);
    let mut direct = moyang_ai_core::Store::open(dir.path()).unwrap();
    let fields = direct.get(id).unwrap().fields;
    direct
        .save(moyang_ai_core::SaveRequest {
            id: Some(id.into()),
            expected_revision: Some(1),
            reason: "桌面编辑".into(),
            fields,
        })
        .unwrap();
    let error=c.call_tool(CallToolRequestParams::new("save_record").with_arguments(json!({"id":id,"expected_revision":1,"kind":"memory","title":"陈旧修改","body":"不应覆盖"}).as_object().unwrap().clone())).await.unwrap();
    assert_eq!(serde_json::to_value(error).unwrap()["isError"], true);
    let skill=call(&c,"save_record",json!({"kind":"skill","title":"review-writing","summary":"写作复盘","body":"检查事实和表达","assets":[{"path":"references/check.md","encoding":"utf8","content":"核对来源"}]})).await;
    let skill_id = skill["id"].as_str().unwrap();
    let skill_detail = call(&c, "get_record", json!({"id":skill_id})).await;
    assert!(skill_detail["resources"][0].get("content").is_none());
    let mut updated_skill = skill_detail.clone();
    updated_skill["expected_revision"] = json!(1);
    updated_skill["body"] = json!("先检查事实，再审阅表达");
    call(&c, "save_record", updated_skill).await;
    let resource = call(
        &c,
        "read_skill_resource",
        json!({"id":skill_id,"path":"references/check.md"}),
    )
    .await;
    assert_eq!(resource["content"], "核对来源");
    let history = call(&c, "record_history", json!({"id":skill_id,"limit":1})).await;
    assert_eq!(history["items"].as_array().unwrap().len(), 1);
    assert_eq!(history["next_before"], 2);
    assert!(history["items"][0].get("body").is_none());
    assert!(history["items"][0].get("record").is_none());
    let old_resource = call(
        &c,
        "read_skill_resource",
        json!({"id":skill_id,"path":"references/check.md","revision":1}),
    )
    .await;
    assert_eq!(old_resource["content"], "核对来源");
    let archived = call(
        &c,
        "set_record_state",
        json!({"id":skill_id,"state":"archived","expected_revision":2}),
    )
    .await;
    assert!(archived.get("assets").is_none());
    assert_eq!(
        archived["resources"][0]["fingerprint"]
            .as_str()
            .unwrap()
            .len(),
        64
    );
    let restored = call(
        &c,
        "restore_revision",
        json!({"id":skill_id,"revision":1,"expected_revision":3}),
    )
    .await;
    assert!(restored.get("assets").is_none());
    assert!(restored["resources"][0].get("content").is_none());
    c.cancel().await.unwrap();
    let restarted = client(dir.path()).await;
    let read = call(&restarted, "get_record", json!({"id":id})).await;
    assert_eq!(read["revision"], 2);
    assert_eq!(read["body"], "偏好简洁中文回答");
    let context = call(
        &restarted,
        "recall_context",
        json!({"query":"写作中文","project":"book","max_chars":1000}),
    )
    .await;
    assert!(context["text"].as_str().unwrap().chars().count() <= 1000);
    restarted.cancel().await.unwrap();
}
