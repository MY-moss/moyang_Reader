use super::*;
use std::io::{BufRead, Read, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;

fn child(directory: &std::path::Path, action: &str) -> Command {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args([
            "--exact",
            "semantic::tests::index_child_process",
            "--nocapture",
        ])
        .env("MOYANG_INDEX_TEST_DIRECTORY", directory)
        .env("MOYANG_INDEX_TEST_ACTION", action);
    command
}

#[test]
fn index_child_process() {
    let Some(directory) = std::env::var_os("MOYANG_INDEX_TEST_DIRECTORY") else {
        return;
    };
    let mut store = Store::open(directory).unwrap();
    match std::env::var("MOYANG_INDEX_TEST_ACTION").unwrap().as_str() {
        "busy" => {
            let result = store.index_semantic().unwrap();
            assert_eq!(result["busy"], true);
            assert_eq!(result["processed"], 0);
        }
        "paused" => {
            let result = store.index_semantic().unwrap();
            assert_eq!(result["paused"], true);
            assert_eq!(result["processed"], 0);
        }
        "hold" => {
            let _guard = index_lock(&store.path).unwrap().unwrap();
            println!("LOCK_HELD");
            std::io::stdout().flush().unwrap();
            let mut line = String::new();
            std::io::stdin().read_line(&mut line).unwrap();
        }
        _ => panic!("unknown child action"),
    }
}

fn fixture() -> (tempfile::TempDir, Store) {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(directory.path()).unwrap();
    for i in 0..20 {
        store.save(serde_json::from_value(serde_json::json!({
            "kind":"memory","title":format!("Note {i}"),"body":format!("alpha reference {i}")
        })).unwrap()).unwrap();
    }
    (directory, store)
}

// Deliberately hold each HTTP response so another process must observe the lock,
// and a pause issued in the middle of the batch is exercised deterministically.
fn server() -> (
    String,
    mpsc::Receiver<usize>,
    mpsc::Sender<()>,
    std::thread::JoinHandle<()>,
) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let (arrived, arrivals) = mpsc::channel();
    let (release, releases) = mpsc::channel();
    let handle = std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(20);
        for _ in 0..2 {
            let mut stream = loop {
                match listener.accept() {
                    Ok((stream, _)) => break stream,
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(Instant::now() < deadline, "embedding request timed out");
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    Err(e) => panic!("{e}"),
                }
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let count = loop {
                let mut buffer = [0; 4096];
                let n = stream.read(&mut buffer).unwrap();
                assert_ne!(n, 0);
                bytes.extend_from_slice(&buffer[..n]);
                if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    let length: usize = String::from_utf8_lossy(&bytes[..end])
                        .lines()
                        .find_map(|l| {
                            l.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .map(|s| s.trim().parse().unwrap())
                        })
                        .unwrap();
                    if bytes.len() >= end + 4 + length {
                        let request: serde_json::Value =
                            serde_json::from_slice(&bytes[end + 4..]).unwrap();
                        break request["input"].as_array().unwrap().len();
                    }
                }
            };
            arrived.send(count).unwrap();
            releases.recv_timeout(Duration::from_secs(10)).unwrap();
            let body = serde_json::json!({"embeddings":vec![vec![1.0,0.0];count]}).to_string();
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        }
    });
    (endpoint, arrivals, release, handle)
}

#[test]
fn all_processes_share_one_batch_and_pause_survives_automatic_maintenance() {
    let (directory, mut store) = fixture();
    let (endpoint, arrivals, release, server) = server();
    store
        .configure_semantic(SemanticConfig {
            enabled: true,
            endpoint,
            model: "locked-fixture".into(),
        })
        .unwrap();
    let worker = std::thread::spawn(move || store.index_semantic().unwrap());
    assert_eq!(arrivals.recv_timeout(Duration::from_secs(5)).unwrap(), 16);
    let output = child(directory.path(), "busy").output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let store = Store::open(directory.path()).unwrap();
    store.pause_semantic(true).unwrap();
    assert!(store.stats().unwrap().semantic_paused);
    release.send(()).unwrap();
    assert_eq!(worker.join().unwrap()["processed"], 16);
    // Simulate a stats refresh or MCP request trying to restart maintenance.
    maintain_semantic(directory.path());
    let output = child(directory.path(), "paused").output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    assert!(arrivals.recv_timeout(Duration::from_millis(200)).is_err());
    assert_eq!(store.stats().unwrap().embedded_chunks, 16);
    store.pause_semantic(false).unwrap();
    assert!(!store.stats().unwrap().semantic_paused);
    let path = directory.path().to_owned();
    let worker = std::thread::spawn(move || Store::open(path).unwrap().index_semantic().unwrap());
    assert_eq!(arrivals.recv_timeout(Duration::from_secs(5)).unwrap(), 4);
    release.send(()).unwrap();
    assert_eq!(worker.join().unwrap()["remaining"], 0);
    server.join().unwrap();
    assert_eq!(store.stats().unwrap().embedded_chunks, 20);
}

#[test]
fn terminated_process_releases_index_lock_without_expiring_a_lease() {
    let (directory, store) = fixture();
    let mut process = child(directory.path(), "hold")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let stdout = process.stdout.take().unwrap();
    let (ready, received) = mpsc::channel();
    std::thread::spawn(move || {
        for line in std::io::BufReader::new(stdout).lines() {
            if line.unwrap().contains("LOCK_HELD") {
                ready.send(()).unwrap();
                break;
            }
        }
    });
    let acquired = received.recv_timeout(Duration::from_secs(5));
    if acquired.is_err() {
        let _ = process.kill();
    }
    acquired.unwrap();
    assert!(index_lock(&store.path).unwrap().is_none());
    process.kill().unwrap();
    process.wait().unwrap();
    assert!(index_lock(&store.path).unwrap().is_some());
}

#[test]
fn model_switch_discards_the_old_in_flight_batch() {
    let (directory, mut store) = fixture();
    let (endpoint, arrivals, release, server) = server();
    let mut config = SemanticConfig {
        enabled: true,
        endpoint,
        model: "old-model".into(),
    };
    store.configure_semantic(config.clone()).unwrap();
    let worker = std::thread::spawn(move || store.index_semantic().unwrap());
    assert_eq!(arrivals.recv_timeout(Duration::from_secs(5)).unwrap(), 16);
    let mut store = Store::open(directory.path()).unwrap();
    config.model = "new-model".into();
    store.configure_semantic(config).unwrap();
    release.send(()).unwrap();
    assert_eq!(worker.join().unwrap()["changed"], true);
    assert_eq!(
        store
            .conn
            .query_row("SELECT COUNT(*) FROM embeddings", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    let worker = std::thread::spawn(move || store.index_semantic().unwrap());
    assert_eq!(arrivals.recv_timeout(Duration::from_secs(5)).unwrap(), 16);
    release.send(()).unwrap();
    assert_eq!(worker.join().unwrap()["processed"], 16);
    server.join().unwrap();
}
