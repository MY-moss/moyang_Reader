use super::*;
fn request(title: &str, body: &str) -> SaveRequest {
    serde_json::from_value(
        serde_json::json!({"kind":"memory","title":title,"body":body,"source":"unit fixture"}),
    )
    .unwrap()
}
fn query(text: &str) -> SearchQuery {
    SearchQuery {
        query: text.into(),
        ..Default::default()
    }
}
fn setup() -> (tempfile::TempDir, Store) {
    let d = tempfile::tempdir().unwrap();
    let s = Store::open(d.path()).unwrap();
    (d, s)
}

#[test]
fn restart_keeps_records_and_history() {
    let (d, mut s) = setup();
    let r = s.save(request("偏好", "喜欢中文回答")).unwrap();
    drop(s);
    let s = Store::open(d.path()).unwrap();
    assert_eq!(s.get(&r.id).unwrap().fields.body, "喜欢中文回答");
    assert_eq!(s.history(&r.id).unwrap().len(), 1);
}

#[test]
fn conditional_get_omits_unchanged_payload_and_observes_updates_and_deletion() {
    let (directory, mut writer) = setup();
    let mut fields = request("refresh-check", "Original body");
    fields.fields.kind = Kind::Skill;
    fields.fields.summary = "Check refreshes".into();
    fields.fields.assets = vec![Asset {
        path: "sample.txt".into(),
        encoding: "utf8".into(),
        content: "large fixture ".repeat(20000),
    }];
    let original = writer.save(fields).unwrap();
    let mut reader = Store::open(directory.path()).unwrap();
    let payload = serde_json::json!({"id":original.id,"revision":original.revision});
    assert!(dispatch(&mut reader, "get_if_changed", payload.clone())
        .unwrap()
        .is_null());
    assert_eq!(
        reader.get(&original.id).unwrap().fields.assets[0]
            .content
            .len(),
        280000
    );
    let mut fields = original.fields;
    fields.body = "Changed body".into();
    fields.assets[0].content = "Changed resource".into();
    let updated = writer
        .save(SaveRequest {
            id: Some(original.id.clone()),
            expected_revision: Some(original.revision),
            fields,
            reason: "change fixture".into(),
        })
        .unwrap();
    let changed = dispatch(&mut reader, "get_if_changed", payload).unwrap();
    assert_eq!(changed["revision"], updated.revision);
    assert_eq!(changed["body"], "Changed body");
    assert_eq!(changed["assets"][0]["content"], "Changed resource");
    assert!(reader
        .get_if_changed(&updated.id, updated.revision)
        .unwrap()
        .is_none());
    writer.delete(&updated.id, updated.revision).unwrap();
    assert!(reader
        .get_if_changed(&updated.id, updated.revision)
        .unwrap_err()
        .to_string()
        .contains("记录不存在"));
}
#[test]
fn pinned_preferences_are_recalled_across_task_vocabulary_without_crossing_scope() {
    let (_, mut s) = setup();
    let mut q = request("表达偏好", "简洁中文，先给结论");
    q.fields.pinned = true;
    q.fields.project = "book".into();
    s.save(q).unwrap();
    let context = s
        .context(ContextRequest {
            query: "Rust lifetime".into(),
            project: Some("book".into()),
            agent: None,
            max_chars: Some(1000),
        })
        .unwrap();
    assert!(context["text"].as_str().unwrap().contains("简洁中文"));
    let other = s
        .context(ContextRequest {
            query: "Rust lifetime".into(),
            project: Some("other".into()),
            agent: None,
            max_chars: Some(1000),
        })
        .unwrap();
    assert!(!other["text"].as_str().unwrap().contains("简洁中文"));
}
#[test]
fn expired_duplicate_does_not_hide_a_renewed_memory() {
    let (_, mut s) = setup();
    let mut q = request("安排", "每周复盘");
    q.fields.expires_at = Some(1);
    let old = s.save(q).unwrap();
    let new = s.save(request("安排", "每周复盘")).unwrap();
    assert_ne!(old.id, new.id);
    assert_eq!(s.search(&query("复盘")).unwrap().total, 1);
}
#[test]
fn independent_writers_cannot_overwrite_a_new_revision() {
    let (d, mut a) = setup();
    let r = a.save(request("偏好", "中文")).unwrap();
    let mut b = Store::open(d.path()).unwrap();
    let mut q = request("偏好", "简洁中文");
    q.id = Some(r.id.clone());
    q.expected_revision = Some(1);
    a.save(q.clone()).unwrap();
    q.fields.body = "过期修改".into();
    assert!(b.save(q).is_err());
    assert_eq!(a.get(&r.id).unwrap().fields.body, "简洁中文");
}
#[test]
fn deduplicates_only_same_kind_scope_and_content() {
    let (_, mut s) = setup();
    let a = s.save(request("一", "长期偏好")).unwrap();
    let b = s.save(request("二", "长期偏好")).unwrap();
    assert_eq!(a.id, b.id);
    let mut q = request("三", "长期偏好");
    q.fields.project = "project-b".into();
    assert_ne!(a.id, s.save(q).unwrap().id);
}
#[test]
fn chinese_english_search_scope_and_pagination() {
    let (_, mut s) = setup();
    s.save(request("默认偏好", "回答使用中文，代码用 TypeScript"))
        .unwrap();
    let mut q = request("另一个项目", "中文资料 TypeScript");
    q.fields.project = "other".into();
    s.save(q).unwrap();
    let mut q = request("当前项目", "中文写作 TypeScript");
    q.fields.project = "book".into();
    s.save(q).unwrap();
    let mut search = query("中文 TypeScript");
    search.project = Some("book".into());
    search.limit = 1;
    let one = s.search(&search).unwrap();
    assert_eq!(one.total, 2);
    assert_eq!(one.items.len(), 1);
    search.offset = 1;
    let two = s.search(&search).unwrap();
    assert_ne!(one.items[0].id, two.items[0].id);
    search.offset = 0;
    search.include_global = false;
    assert_eq!(s.search(&search).unwrap().total, 1);
    assert_eq!(s.search(&query("\" OR * : ()")).unwrap().total, 0);
}
#[test]
fn archive_expiration_and_restore_are_explicit() {
    let (_, mut s) = setup();
    let r = s.save(request("永久", "阅读偏好")).unwrap();
    let mut expired = request("过期", "阅读短期计划");
    expired.fields.expires_at = Some(1);
    s.save(expired).unwrap();
    assert_eq!(s.search(&query("阅读")).unwrap().total, 1);
    let archived = s
        .change_state(StateRequest {
            id: r.id.clone(),
            expected_revision: 1,
            state: RecordState::Archived,
        })
        .unwrap();
    assert_eq!(s.search(&query("阅读")).unwrap().total, 0);
    s.restore(RestoreRequest {
        id: r.id.clone(),
        expected_revision: archived.revision,
        revision: 1,
    })
    .unwrap();
    assert_eq!(s.search(&query("阅读")).unwrap().total, 1);
    assert_eq!(s.history(&r.id).unwrap().len(), 3);
}
#[test]
fn failed_merge_is_atomic_and_success_retains_sources() {
    let (_, mut s) = setup();
    let a = s.save(request("甲", "中文偏好")).unwrap();
    let b = s.save(request("乙", "短句偏好")).unwrap();
    let mut q = MergeRequest {
        ids: vec![a.id.clone(), b.id.clone()],
        revisions: vec![1, 99],
        title: "表达偏好".into(),
        body: "请用简洁中文".into(),
    };
    assert!(s.merge(q.clone()).is_err());
    assert_eq!(s.get(&a.id).unwrap().state, RecordState::Active);
    q.revisions[1] = 1;
    let merged = s.merge(q).unwrap();
    assert_eq!(merged.fields.links.len(), 2);
    assert_eq!(s.get(&a.id).unwrap().state, RecordState::Archived);
    assert_eq!(s.search(&SearchQuery::default()).unwrap().total, 1);
}
#[test]
fn deletion_removes_history_chunks_vectors_and_feedback() {
    let (_, mut s) = setup();
    let r = s.save(request("可删除", "独特检索内容")).unwrap();
    s.feedback(FeedbackRequest {
        id: r.id.clone(),
        useful: true,
    })
    .unwrap();
    s.delete(&r.id, 1).unwrap();
    assert!(s.get(&r.id).is_err());
    assert_eq!(s.search(&query("独特")).unwrap().total, 0);
    assert_eq!(s.stats().unwrap().indexed_chunks, 0);
}
#[test]
fn full_backup_roundtrip_and_conflict_skip() {
    let (_, mut a) = setup();
    let r = a.save(request("回忆", "保存全部版本")).unwrap();
    let mut q = request("回忆", "修订内容");
    q.id = Some(r.id.clone());
    q.expected_revision = Some(1);
    a.save(q).unwrap();
    let backup = a.backup().unwrap();
    let (_, mut b) = setup();
    let result = b.import(backup.clone()).unwrap();
    assert_eq!(result["imported"], 1);
    assert_eq!(b.history(&r.id).unwrap().len(), 2);
    assert_eq!(b.get(&r.id).unwrap().fields.body, "修订内容");
    assert_eq!(b.import(backup).unwrap()["skipped"], 1);
}
#[test]
fn bad_archive_import_never_partially_writes() {
    let (_, mut a) = setup();
    a.save(request("合法", "正文")).unwrap();
    let mut backup = a.backup().unwrap();
    let mut invalid = backup.records[0].clone();
    invalid.id = "bad".into();
    invalid.fields.title = "".into();
    backup.records.push(invalid);
    let (_, mut b) = setup();
    assert!(b.import(backup).is_err());
    assert_eq!(b.stats().unwrap().memory, 0);
}
#[test]
fn skills_keep_resources_and_validate_portable_paths() {
    let (_, mut s) = setup();
    let mut q = request("write-clean-code", "具体步骤");
    q.fields.kind = Kind::Skill;
    q.fields.summary = "写代码时使用".into();
    q.fields.assets = vec![Asset {
        path: "scripts/check.py".into(),
        encoding: "utf8".into(),
        content: "print('ok')".into(),
    }];
    let r = s.save(q.clone()).unwrap();
    assert_eq!(
        s.asset(AssetRequest {
            id: r.id,
            path: "scripts/check.py".into(),
            revision: None,
        })
        .unwrap()
        .content,
        "print('ok')"
    );
    q.fields.assets[0].path = "../outside".into();
    assert!(s.save(q).is_err());
}
#[test]
fn context_is_bounded_and_skill_is_progressive() {
    let (_, mut s) = setup();
    let mut q = request("writing-guide", &"步骤示例".repeat(2000));
    q.fields.kind = Kind::Skill;
    q.fields.summary = "写作流程".into();
    s.save(q).unwrap();
    let context = s
        .context(ContextRequest {
            query: "写作".into(),
            project: None,
            agent: None,
            max_chars: Some(1000),
        })
        .unwrap();
    let text = context["text"].as_str().unwrap();
    assert!(text.contains("技能摘要"));
    assert!(!text.contains("步骤示例"));
    assert!(text.chars().count() <= 1000);
}
#[test]
fn pinned_memory_keeps_task_relevant_evidence_beyond_its_opening() {
    let (_, mut store) = setup();
    let body = format!(
        "{}\n月石发布要求：完成数据库备份后，再执行桌面重启验证。",
        "常规背景材料，不涉及本轮问题。\n".repeat(300)
    );
    let mut fields = request("文档维护约定", &body);
    fields.fields.pinned = true;
    fields.fields.project = "moonstone".into();
    let memory = store.save(fields).unwrap();
    let context = store
        .context(ContextRequest {
            query: "月石发布".into(),
            project: Some("moonstone".into()),
            agent: None,
            max_chars: Some(8000),
        })
        .unwrap();
    let text = context["text"].as_str().unwrap();
    assert!(text.contains("月石发布要求：完成数据库备份后，再执行桌面重启验证。"));
    assert!(text.contains("片段"));
    assert_eq!(context["ids"], serde_json::json!([memory.id]));
    assert!(text.chars().count() <= 8000);
}
#[test]
fn chunking_preserves_unicode_and_finds_late_content() {
    let (_, mut s) = setup();
    let body = format!("{}\n最后的独角鲸结论", "中文😀\n".repeat(5000));
    s.save(request("长资料", &body)).unwrap();
    let result = s.search(&query("独角鲸")).unwrap();
    assert_eq!(result.total, 1);
    assert!(result.items[0].excerpt.contains("独角鲸"));
}
#[test]
fn semantic_service_indexes_retrieves_and_falls_back() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let server = std::thread::spawn(move || {
        for _ in 0..2 {
            let (mut stream, _) = listener.accept().unwrap();
            let mut data = Vec::new();
            let mut buf = [0u8; 4096];
            loop {
                let n = stream.read(&mut buf).unwrap();
                if n == 0 {
                    break;
                }
                data.extend_from_slice(&buf[..n]);
                if let Some(p) = data.windows(4).position(|w| w == b"\r\n\r\n") {
                    let header = String::from_utf8_lossy(&data[..p]);
                    let len: usize = header
                        .lines()
                        .find_map(|l| {
                            l.to_lowercase()
                                .strip_prefix("content-length:")
                                .map(|v| v.trim().parse().unwrap())
                        })
                        .unwrap();
                    if data.len() >= p + 4 + len {
                        let q: serde_json::Value = serde_json::from_slice(&data[p + 4..]).unwrap();
                        let vectors: Vec<_> = q["input"]
                            .as_array()
                            .unwrap()
                            .iter()
                            .map(|_| vec![1.0, 0.5, 0.0])
                            .collect();
                        let body = serde_json::json!({"embeddings":vectors}).to_string();
                        write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
                        break;
                    }
                }
            }
        }
    });
    let (_, mut s) = setup();
    let mut record = request("猫咪", &"猫咪喜欢安静的生活。\n".repeat(500));
    record.fields.project = "book".into();
    record.fields.snapshot = Some(SourceSnapshot {
        uri: "file:///fixture.md".into(),
        format: "markdown".into(),
        fingerprint: "fixture-source-fingerprint".into(),
        imported_at: 1,
        checked_at: None,
        locations: vec![],
    });
    s.save(record).unwrap();
    let mut unrelated = request("其他项目", "同一向量不应跨越项目边界");
    unrelated.fields.project = "other".into();
    s.save(unrelated).unwrap();
    s.configure_semantic(SemanticConfig {
        enabled: true,
        endpoint: format!("http://{addr}"),
        model: "test".into(),
    })
    .unwrap();
    assert_eq!(s.index_semantic().unwrap()["remaining"], 0);
    let mut later = request("未索引的其他项目", "不应阻止当前项目使用已完成的语义索引");
    later.fields.project = "other".into();
    s.save(later).unwrap();
    let mut q = query("quiet feline");
    q.semantic = true;
    q.project = Some("book".into());
    let results = s.search(&q).unwrap();
    assert_eq!(results.items.len(), 1);
    assert_eq!(results.items[0].fragments.len(), 4);
    assert!(results.items[0].fragments.iter().all(|fragment| {
        fragment.location.uri == "file:///fixture.md"
            && fragment.location.fingerprint == "fixture-source-fingerprint"
    }));
    server.join().unwrap();
    q.query = "猫咪".into();
    let fallback = s.search(&q).unwrap();
    assert_eq!(fallback.items.len(), 1);
    assert!(fallback.warning.is_some());
}

#[test]
fn incomplete_semantic_index_preserves_keyword_results_and_pagination() {
    let (_, mut s) = setup();
    for i in 0..125 {
        s.save(request(
            &format!("Note {i}"),
            &format!("alpha reference {i}"),
        ))
        .unwrap();
    }
    let config = SemanticConfig {
        enabled: true,
        endpoint: "http://127.0.0.1:9".into(),
        model: "incomplete-fixture".into(),
    };
    s.configure_semantic(config.clone()).unwrap();
    let mut q = query("alpha bravo charlie delta echo");
    q.limit = 7;
    q.offset = 105;
    let lexical = s.search(&q).unwrap();
    assert_eq!(lexical.total, 125);
    assert_eq!(lexical.items.len(), 7);
    q.semantic = true;
    for partial in [false, true] {
        if partial {
            s.conn.execute("INSERT INTO embeddings(chunk_id,model,vector) SELECT id,?,'[1.0,0.0]' FROM chunks LIMIT 1", [crate::semantic::model_key(&config)]).unwrap();
        }
        let result = s.search(&q).unwrap();
        assert_eq!(result.total, lexical.total);
        assert_eq!(
            result.items.iter().map(|h| &h.id).collect::<Vec<_>>(),
            lexical.items.iter().map(|h| &h.id).collect::<Vec<_>>()
        );
        assert!(result.warning.unwrap().contains("尚未"));
    }
}
