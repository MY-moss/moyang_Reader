use crate::*;
use serde_json::json;
fn save(s: &mut Store, title: &str, body: &str, scope: &str, agent: &str, sharing: &str) -> Record {
    s.save(serde_json::from_value(json!({"kind":"memory","title":title,"body":body,"project":scope,"agent":agent,"sharing":sharing})).unwrap()).unwrap()
}
#[test]
fn health_scopes_duplicates_without_models_or_mutations() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let a = save(
        &mut s,
        "原始要求",
        "使用中文\n保留出处",
        "alpha",
        "codex",
        "project",
    );
    let b = save(
        &mut s,
        "另一标题",
        "使用中文\r\n保留出处",
        "alpha",
        "claude",
        "project",
    );
    save(
        &mut s,
        "另一项目",
        "使用中文\n保留出处",
        "beta",
        "codex",
        "project",
    );
    save(
        &mut s,
        "旧私有范围",
        "使用中文\n保留出处",
        "alpha",
        "codex",
        "legacy",
    );
    save(
        &mut s,
        "另一个私有范围",
        "使用中文\n保留出处",
        "alpha",
        "claude",
        "legacy",
    );
    save(&mut s, "全局", "使用中文\n保留出处", "", "", "global");
    s.configure_semantic(SemanticConfig {
        enabled: true,
        endpoint: "http://127.0.0.1:1".into(),
        model: "unavailable".into(),
    })
    .unwrap();
    let before = serde_json::to_value(s.backup().unwrap()).unwrap();
    let q = || {
        serde_json::from_value(json!({"project":"alpha","agent":"codex","issue":"duplicate"}))
            .unwrap()
    };
    let report = s.health(q()).unwrap();
    assert_eq!(report.scanned, 3);
    assert_eq!(report.total, 2);
    assert_eq!(report.counts["missing_source"], 3);
    assert!(report.items.iter().all(|i| i.duplicate_count == 2));
    assert_eq!(
        report
            .items
            .iter()
            .map(|i| &i.id)
            .collect::<std::collections::HashSet<_>>(),
        [&a.id, &b.id].into_iter().collect()
    );
    let global = s
        .health(serde_json::from_value(json!({"project":""})).unwrap())
        .unwrap();
    assert_eq!(global.scanned, 1);
    assert_eq!(global.counts["duplicate"], 0);
    let after = serde_json::to_value(s.backup().unwrap()).unwrap();
    assert_eq!(before["records"], after["records"]);
    assert_eq!(before["history"], after["history"]);
    assert_eq!(s.stats().unwrap().embedded_chunks, 0);
}
#[test]
fn health_reports_expiry_missing_sources_and_deleted_relations_with_paging_and_restore() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    let target = save(&mut s, "关联目标", "原来存在的资料", "p", "", "project");
    let archived = save(&mut s, "归档目标", "归档不代表失效关联", "p", "", "project");
    s.change_state(StateRequest {
        id: archived.id.clone(),
        expected_revision: 1,
        state: RecordState::Archived,
    })
    .unwrap();
    let mut req: SaveRequest = serde_json::from_value(json!({"kind":"knowledge","title":"过期资料","body":"待核对内容","project":"p","sharing":"project","expires_at":1,"links":[target.id,archived.id],"snapshot":{"uri":"file:///source.md","format":"md","fingerprint":"fixture","imported_at":1,"locations":[]}})).unwrap();
    let r = s.save(req.clone()).unwrap();
    s.delete(&target.id, 1).unwrap();
    let report = s
        .health(serde_json::from_value(json!({"kind":"knowledge","limit":1})).unwrap())
        .unwrap();
    assert_eq!(report.scanned, 1);
    assert_eq!(report.counts["expired"], 1);
    assert_eq!(report.counts["missing_source"], 0);
    assert_eq!(report.counts["broken_links"], 1);
    assert_eq!(report.items[0].broken_link_ids, vec![target.id]);
    assert_eq!(report.items[0].source, "file:///source.md");
    let next = s
        .change_state(StateRequest {
            id: r.id.clone(),
            expected_revision: r.revision,
            state: RecordState::Archived,
        })
        .unwrap();
    assert_eq!(s.health(HealthQuery::default()).unwrap().total, 0);
    s.change_state(StateRequest {
        id: r.id.clone(),
        expected_revision: next.revision,
        state: RecordState::Active,
    })
    .unwrap();
    req.id = Some(r.id);
    req.expected_revision = Some(3);
    req.fields.body = "已核对内容".into();
    req.fields.links = vec![archived.id];
    s.save(req).unwrap();
    let error = s
        .change_state(StateRequest {
            id: next.id,
            expected_revision: 3,
            state: RecordState::Archived,
        })
        .unwrap_err();
    assert!(error.to_string().contains("更新"));
    let page = s
        .health(serde_json::from_value(json!({"offset":1,"limit":1})).unwrap())
        .unwrap();
    assert_eq!(page.total, 1);
    assert!(page.items.is_empty());
}

#[test]
fn bounded_context_keeps_multiple_documents_and_late_chinese_evidence() {
    let d = tempfile::tempdir().unwrap();
    let mut s = Store::open(d.path()).unwrap();
    for (n, conclusion) in [
        "先核对来源再保存",
        "使用本机缓存",
        "保留修订历史",
        "只处理本项目",
    ]
    .iter()
    .enumerate()
    {
        let request = serde_json::from_value(json!({"kind":"knowledge","title":format!("月石维护 {n}"),"body":format!("{}\n月石维护：{conclusion}。", "背景资料，不包含任务结论。".repeat(60)),"source":"冗长的原始来源路径；".repeat(80),"project":"moonstone","sharing":"project"})).unwrap();
        s.save(request).unwrap();
    }
    save(
        &mut s,
        "不能跨项目",
        "月石维护：另一个项目专用。",
        "other",
        "",
        "project",
    );
    let result = s
        .context(ContextRequest {
            query: "月石维护".into(),
            project: Some("moonstone".into()),
            agent: None,
            max_chars: Some(1600),
        })
        .unwrap();
    let text = result["text"].as_str().unwrap();
    assert!(text.chars().count() <= 1600);
    assert_eq!(result["ids"].as_array().unwrap().len(), 4);
    for conclusion in [
        "先核对来源再保存",
        "使用本机缓存",
        "保留修订历史",
        "只处理本项目",
    ] {
        assert!(text.contains(conclusion), "{text}");
    }
    assert!(!text.contains("另一个项目专用"));
    assert_eq!(result["truncated"], true);
}

#[test]
fn small_context_reserves_question_evidence_alongside_unrelated_pins() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(directory.path()).unwrap();
    for n in 0..4 {
        store.save(serde_json::from_value(json!({"kind":"memory","title":format!("长期约定 {n}"),"body":"长期工作背景与约定。".repeat(100),"pinned":true,"project":"book","sharing":"project"})).unwrap()).unwrap();
    }
    let wanted = save(
        &mut store,
        "月石发布流程",
        "月石发布必须先备份，再验证重启。",
        "book",
        "",
        "project",
    );
    let result = store
        .context(ContextRequest {
            query: "月石发布".into(),
            project: Some("book".into()),
            agent: None,
            max_chars: Some(1000),
        })
        .unwrap();
    let text = result["text"].as_str().unwrap();
    assert_eq!(result["ids"][0], wanted.id);
    assert!(text.contains("先备份，再验证重启"));
    assert!(text.contains("长期约定"));
    assert!(text.chars().count() <= 1000);
}
