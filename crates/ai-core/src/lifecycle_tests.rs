use super::*;
fn save(title: &str, body: &str) -> SaveRequest {
    serde_json::from_value(
        serde_json::json!({"kind":"memory","title":title,"body":body,"source":"test evidence"}),
    )
    .unwrap()
}
fn checkpoint(s: &mut Store, turn: &str, follow: bool) -> serde_json::Value {
    s.checkpoint(CheckpointRequest {
        client: "codex".into(),
        session: "session-1".into(),
        turn: turn.into(),
        project: "book".into(),
        agent: "codex".into(),
        request_followup: follow,
    })
    .unwrap()
}
fn conclude(
    id: &str,
    request: SaveRequest,
    action: DecisionAction,
    explicit: bool,
) -> ConcludeRequest {
    ConcludeRequest {
        checkpoint_id: id.into(),
        reason: "用户给出了明确偏好".into(),
        decisions: vec![MemoryDecision {
            action,
            record: request,
            evidence: "用户原话：请以后使用中文".into(),
            explicit_correction: explicit,
            outcome: String::new(),
        }],
    }
}
#[test]
fn original_turn_is_idempotent_and_hook_continues_at_most_once() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let c = checkpoint(&mut s, "turn-1", true);
    assert_eq!(c["should_continue"], true);
    assert_eq!(checkpoint(&mut s, "turn-1", true)["should_continue"], false);
    let q = conclude(
        c["checkpoint"]["id"].as_str().unwrap(),
        save("语言", "请使用中文"),
        DecisionAction::Save,
        false,
    );
    let first = s.conclude(q.clone()).unwrap();
    drop(s);
    let mut s = Store::open(d.path()).unwrap();
    let second = s.conclude(q).unwrap();
    assert_eq!(first.record_ids, second.record_ids);
    assert_eq!(
        s.activity_feed().unwrap()["activities"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        s.get(&first.record_ids[0]).unwrap().fields.sharing,
        Sharing::Global
    );
    let empty = checkpoint(&mut s, "turn-2", false);
    let r = s
        .conclude(ConcludeRequest {
            checkpoint_id: empty["checkpoint"]["id"].as_str().unwrap().into(),
            reason: "只是汇报进度，没有新信息".into(),
            decisions: vec![],
        })
        .unwrap();
    assert_eq!(r.status, "no_new_information");
    assert_eq!(s.stats().unwrap().memory, 1);
}
#[test]
fn corrections_keep_history_inferences_wait_and_changes_can_be_undone() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let c = checkpoint(&mut s, "1", false);
    let id = c["checkpoint"]["id"].as_str().unwrap();
    let created = s
        .conclude(conclude(
            id,
            save("语言", "中文"),
            DecisionAction::Save,
            false,
        ))
        .unwrap();
    let r = s.get(&created.record_ids[0]).unwrap();
    let mut q = SaveRequest {
        id: Some(r.id.clone()),
        expected_revision: Some(r.revision),
        reason: String::new(),
        fields: r.fields,
    };
    q.fields.body = "简洁中文".into();
    let c = checkpoint(&mut s, "2", false);
    let pending = s
        .conclude(conclude(
            c["checkpoint"]["id"].as_str().unwrap(),
            q.clone(),
            DecisionAction::Correct,
            false,
        ))
        .unwrap();
    assert_eq!(s.get(&r.id).unwrap().fields.body, "中文");
    assert_eq!(pending.conflict_ids.len(), 1);
    s.resolve_conflict(ResolveConflictRequest {
        id: pending.conflict_ids[0].clone(),
        resolution: "accept".into(),
        expected_revision: Some(1),
        body: None,
    })
    .unwrap();
    assert_eq!(s.history(&r.id).unwrap().len(), 2);
    let feed = s.activity_feed().unwrap();
    let activity = feed["activities"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["after_revision"] == 2)
        .unwrap();
    let aid = activity["id"].as_str().unwrap();
    s.undo_activity(ActivityRequest {
        id: aid.into(),
        restore: false,
    })
    .unwrap();
    assert_eq!(s.get(&r.id).unwrap().fields.body, "中文");
    s.undo_activity(ActivityRequest {
        id: aid.into(),
        restore: true,
    })
    .unwrap();
    assert_eq!(s.get(&r.id).unwrap().fields.body, "简洁中文");
    q.expected_revision = Some(4);
    q.fields.body = "英文".into();
    let c = checkpoint(&mut s, "3", false);
    s.conclude(conclude(
        c["checkpoint"]["id"].as_str().unwrap(),
        q,
        DecisionAction::Correct,
        true,
    ))
    .unwrap();
    assert_eq!(s.get(&r.id).unwrap().fields.body, "英文");
}
#[test]
fn shared_records_cross_agents_but_legacy_scope_does_not_expand() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let mut old = save("旧规则", "旧规则专属来源");
    old.fields.agent = "codex".into();
    old.fields.project = "book".into();
    s.save(old).unwrap();
    let mut shared = save("新规则", "共享规则来源");
    shared.fields.agent = "codex".into();
    shared.fields.project = "book".into();
    shared.fields.sharing = Sharing::Project;
    s.save(shared).unwrap();
    let q = SearchQuery {
        agent: Some("claude".into()),
        project: Some("book".into()),
        ..Default::default()
    };
    let found = s.search(&q).unwrap();
    assert_eq!(found.total, 1);
    assert_eq!(found.items[0].title, "新规则");
    assert_eq!(
        s.search(&SearchQuery {
            project: Some("elsewhere".into()),
            ..q
        })
        .unwrap()
        .total,
        0
    );
}
#[test]
fn unchanged_body_keeps_chunk_ids_and_vectors_and_returns_multiple_sources() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let body = (0..8)
        .map(|i| format!("第 {i} 节 检索证据\n{}\n\n", "中文长文内容。".repeat(150)))
        .collect::<String>();
    let r = s.save(save("多证据", &body)).unwrap();
    s.conn
        .execute(
            "INSERT INTO embeddings(chunk_id,model,vector) SELECT id,'fixture','[1,0]' FROM chunks",
            [],
        )
        .unwrap();
    let before: i64 = s
        .conn
        .query_row("SELECT COUNT(*) FROM embeddings", [], |r| r.get(0))
        .unwrap();
    let mut q = SaveRequest {
        id: Some(r.id.clone()),
        expected_revision: Some(1),
        reason: "标题调整".into(),
        fields: r.fields,
    };
    q.fields.title = "新标题".into();
    q.fields.tags = vec!["标签".into()];
    s.save(q).unwrap();
    let after: i64 = s
        .conn
        .query_row("SELECT COUNT(*) FROM embeddings", [], |r| r.get(0))
        .unwrap();
    assert_eq!(before, after);
    let found = s
        .search(&SearchQuery {
            query: "检索证据".into(),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(found.total, 1);
    assert_eq!(found.items[0].fragments.len(), 4);
    assert!(!found.items[0].fragments[0].location.fingerprint.is_empty());
}
#[test]
fn v1_migration_is_backed_up_and_preserves_ids_revisions_and_agent_scope() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let mut q = save("历史记忆", "旧版本数据");
    q.fields.agent = "codex".into();
    let r = s.save(q).unwrap();
    s.conn.execute_batch("DROP TABLE resources; DROP TABLE organization_queue; DROP TABLE organization_usage; DROP TABLE memory_merges; DROP TABLE derived_context; DROP INDEX records_sharing; ALTER TABLE records DROP COLUMN sharing; DROP TABLE checkpoints; DROP TABLE conflicts; DROP TABLE activities; UPDATE records SET payload=json_remove(payload,'$.sharing','$.snapshot'); UPDATE revisions SET payload=json_remove(payload,'$.sharing','$.snapshot'); PRAGMA user_version=1;").unwrap();
    drop(s);
    let s = Store::open(d.path()).unwrap();
    let restored = s.get(&r.id).unwrap();
    assert_eq!(restored.fields.sharing, Sharing::Legacy);
    assert_eq!(restored.revision, 1);
    assert_eq!(s.history(&r.id).unwrap().len(), 1);
    let snapshot = std::fs::read_dir(d.path().join("snapshots"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("upgrade-")
        })
        .unwrap();
    let db = rusqlite::Connection::open(snapshot).unwrap();
    let version: i64 = db
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(version, 1);
    assert_eq!(
        s.search(&SearchQuery {
            agent: Some("claude".into()),
            ..Default::default()
        })
        .unwrap()
        .total,
        0
    );
}
#[test]
fn backup_round_trip_keeps_pending_checkpoints_and_rejects_invalid_activity_atomically() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    checkpoint(&mut s, "interrupted", true);
    s.save(save("知识", "备份内容")).unwrap();
    let backup = s.backup().unwrap();
    let dest = tempfile::tempdir().unwrap();
    let mut target = Store::open(dest.path()).unwrap();
    target.import(backup.clone()).unwrap();
    assert_eq!(
        target.activity_feed().unwrap()["pending"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    let mut broken = backup;
    broken
        .activities
        .push(serde_json::json!({"id":"broken","updated_at":"invalid"}));
    let dest = tempfile::tempdir().unwrap();
    let mut target = Store::open(dest.path()).unwrap();
    assert!(target.import(broken).is_err());
    assert_eq!(target.stats().unwrap().memory, 0);
}
#[test]
fn cancelling_a_search_drops_the_in_flight_embedding_request() {
    use std::{
        io::Read,
        net::TcpListener,
        time::{Duration, Instant},
    };
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    s.save(save("取消测试", "有内容用于检索")).unwrap();
    let server = TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!("http://{}", server.local_addr().unwrap());
    let config = SemanticConfig {
        enabled: true,
        endpoint,
        model: "cancellation-fixture".into(),
        ..Default::default()
    };
    s.configure_semantic(config.clone()).unwrap();
    let key = crate::semantic::model_key(&config);
    s.conn
        .execute(
            "INSERT INTO embeddings(chunk_id,model,vector) SELECT id,?,'[1,0]' FROM chunks",
            [key],
        )
        .unwrap();
    let request_id = uuid::Uuid::new_v4().to_string();
    let cancel_id = request_id.clone();
    let worker = std::thread::spawn(move || {
        let (mut socket, _) = server.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let mut bytes = [0; 4096];
        let _ = socket.read(&mut bytes);
        cancel_search(&cancel_id);
        let start = Instant::now();
        loop {
            match socket.read(&mut bytes) {
                Ok(0) => break,
                Ok(_) => {}
                Err(_) => break,
            }
        }
        start.elapsed()
    });
    let start = Instant::now();
    let result = s.search(&SearchQuery {
        query: "unique-cancel-query".into(),
        semantic: true,
        request_id: Some(request_id),
        ..Default::default()
    });
    assert!(result.unwrap_err().to_string().contains("取消"));
    assert!(start.elapsed() < Duration::from_secs(2));
    assert!(worker.join().unwrap() < Duration::from_secs(1));
}
