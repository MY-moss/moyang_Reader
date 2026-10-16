use super::*;
use std::io::{Read, Write};
fn profile(s: &Store, url: &str) {
    services::provider_request(&s.services_directory().unwrap(),"save_provider",json!({"id":"test","name":"测试服务","protocol":"openai","baseUrl":url,"model":"organizer","apiKey":"isolated-secret"})).unwrap();
}
fn config(s: &mut Store, budget: i64) {
    s.configure_organization(OrganizationConfig {
        enabled: true,
        provider: "test".into(),
        model: "organizer".into(),
        daily_tokens: budget,
        auto_merge: false,
    })
    .unwrap();
}
fn memory(s: &mut Store, body: &str) -> Record {
    s.save(serde_json::from_value(json!({"kind":"memory","title":"中文表达","body":body,"sharing":"project","project":"reader","source":"用户明确要求"})).unwrap()).unwrap()
}
fn server(
    after: impl FnOnce() + Send + 'static,
    usage: Option<i64>,
) -> (String, std::thread::JoinHandle<()>) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        loop {
            let mut bytes = [0; 4096];
            let n = socket.read(&mut bytes).unwrap();
            assert!(n > 0);
            request.extend_from_slice(&bytes[..n]);
            if let Some(end) = request.windows(4).position(|v| v == b"\r\n\r\n") {
                let length: usize = String::from_utf8_lossy(&request[..end])
                    .lines()
                    .find_map(|l| {
                        l.to_lowercase()
                            .strip_prefix("content-length:")
                            .map(|s| s.trim().parse().unwrap())
                    })
                    .unwrap_or(0);
                if request.len() >= end + 4 + length {
                    break;
                }
            }
        }
        after();
        let content =
            json!({"purpose":"表达偏好","overview":"使用简洁中文；保留来源。","merge_with":null})
                .to_string();
        let mut response = json!({"choices":[{"message":{"content":content}}]});
        if let Some(tokens) = usage {
            response["usage"] = json!({"total_tokens":tokens});
        }
        let body = response.to_string();
        write!(socket,"HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
    });
    (address, worker)
}
#[test]
fn explicit_configuration_budget_reservation_missing_usage_and_dedup() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let r = memory(&mut s, "偏好简洁中文");
    assert!(!s.organization_tick().unwrap());
    let (address, worker) = server(|| {}, None);
    profile(&s, &address);
    config(&mut s, 1);
    assert!(s.organization_tick().unwrap());
    assert_eq!(s.organization_status().unwrap()["used"], 0);
    config(&mut s, 10000);
    s.organization_action("retry").unwrap();
    assert!(s.organization_tick().unwrap());
    worker.join().unwrap();
    let status = s.organization_status().unwrap();
    assert_eq!(status["counts"]["done"], 1);
    assert!(status["used"].as_i64().unwrap() > 0);
    assert_eq!(status["used"], status["estimated"]);
    assert_eq!(status["reserved"], 0);
    s.patch(
        serde_json::from_value(json!({"id":r.id,"expected_revision":1,"fields":{"tags":["样式"]}}))
            .unwrap(),
    )
    .unwrap();
    assert!(!s.organization_tick().unwrap());
    assert!(!serde_json::to_string(&s.backup().unwrap())
        .unwrap()
        .contains("isolated-secret"));
}
#[test]
fn stale_response_is_charged_but_cannot_overwrite_new_content() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let r = memory(&mut s, "旧结论");
    let path = dir.path().to_path_buf();
    let id = r.id.clone();
    let (address, worker) = server(
        move || {
            let mut other = Store::open(path).unwrap();
            assert!(!other.organization_tick().unwrap());
            other
                .patch(
                    serde_json::from_value(
                        json!({"id":id,"expected_revision":1,"fields":{"body":"新的明确结论"}}),
                    )
                    .unwrap(),
                )
                .unwrap();
        },
        Some(123),
    );
    profile(&s, &address);
    config(&mut s, 10000);
    assert!(s.organization_tick().unwrap());
    worker.join().unwrap();
    assert_eq!(s.organization_status().unwrap()["used"], 123);
    assert_eq!(s.get(&r.id).unwrap().fields.body, "新的明确结论");
    let count: i64 = s
        .conn
        .query_row("SELECT COUNT(*) FROM derived_context", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);
    assert_eq!(s.organization_status().unwrap()["counts"]["pending"], 1);
}
#[test]
fn interrupted_reservation_is_estimated_and_job_survives_restart() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let r = memory(&mut s, "保留明确结论");
    profile(&s, "http://127.0.0.1:1");
    config(&mut s, 10000);
    s.conn
        .execute(
            "UPDATE organization_queue SET state='running' WHERE id=?",
            [r.id],
        )
        .unwrap();
    s.conn.execute("INSERT INTO organization_usage VALUES('request','job',?,2400,0,1,'reserved',?,'test','organizer')",params![now()/86_400_000,now()]).unwrap();
    drop(s);
    let mut reopened = Store::open(dir.path()).unwrap();
    reopened.organization_action("pause").unwrap();
    assert!(!reopened.organization_tick().unwrap());
    let status = reopened.organization_status().unwrap();
    assert_eq!(status["estimated"], 2400);
    assert_eq!(status["reserved"], 0);
    assert_eq!(status["counts"]["pending"], 1);
}

#[test]
fn organizer_child_process() {
    let Ok(path) = std::env::var("MOYANG_ORGANIZER_FIXTURE") else {
        return;
    };
    let worked = Store::open(&path).unwrap().organization_tick().unwrap();
    let output = std::env::var("MOYANG_ORGANIZER_RESULT").unwrap();
    std::fs::write(output, worked.to_string()).unwrap();
}
#[test]
fn independent_processes_share_one_organizer_request_and_ledger() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    memory(&mut s, "简洁中文回答");
    let (started, waiting) = std::sync::mpsc::channel();
    let (release, receive) = std::sync::mpsc::channel();
    let (address, worker) = server(
        move || {
            started.send(()).unwrap();
            receive.recv_timeout(Duration::from_secs(10)).unwrap();
        },
        Some(73),
    );
    profile(&s, &address);
    config(&mut s, 10000);
    let spawn = |name: &str| {
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "organizer::tests::organizer_child_process",
                "--nocapture",
            ])
            .env("MOYANG_ORGANIZER_FIXTURE", dir.path())
            .env("MOYANG_ORGANIZER_RESULT", dir.path().join(name))
            .stdout(std::process::Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        command.spawn().unwrap()
    };
    let mut first = spawn("first");
    waiting.recv_timeout(Duration::from_secs(10)).unwrap();
    let mut second = spawn("second");
    assert!(second.wait().unwrap().success());
    assert_eq!(
        std::fs::read_to_string(dir.path().join("second")).unwrap(),
        "false"
    );
    release.send(()).unwrap();
    assert!(first.wait().unwrap().success());
    worker.join().unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.path().join("first")).unwrap(),
        "true"
    );
    assert_eq!(s.organization_status().unwrap()["used"], 73);
    assert_eq!(
        s.conn
            .query_row("SELECT COUNT(*) FROM organization_usage", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        1
    );
}
