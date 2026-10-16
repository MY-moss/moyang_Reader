use crate::*;
use serde_json::json;

#[test]
fn source_inventory_keeps_legacy_agent_scope() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(dir.path()).unwrap();
    for (agent, sharing) in [
        ("codex", "legacy"),
        ("claude", "legacy"),
        ("claude", "project"),
    ] {
        store.save(serde_json::from_value(json!({"kind":"knowledge","title":format!("{agent} {sharing}"),"body":format!("{agent} {sharing}"),"project":"p","agent":agent,"sharing":sharing,"snapshot":{"uri":"D:/source.md","format":"markdown","fingerprint":"old","imported_at":1,"locations":[]}})).unwrap()).unwrap();
    }
    let result = store
        .source_inventory(serde_json::from_value(json!({"project":"p","agent":"codex"})).unwrap())
        .unwrap();
    assert_eq!(result.total, 2);
    assert!(result
        .items
        .iter()
        .all(|r| r.sharing != "legacy" || r.agent == "codex"));
}

#[test]
fn source_inventory_is_scoped_paginated_metadata_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let mut records = Vec::new();
    for (title, project, kind, imported) in [
        ("项目来源一", "p", "knowledge", true),
        ("项目来源二", "p", "knowledge", true),
        ("其他项目", "other", "knowledge", true),
        ("全局资料", "", "knowledge", true),
        ("手工知识", "p", "knowledge", false),
        ("长期偏好", "p", "memory", true),
        ("归档来源", "p", "knowledge", true),
    ] {
        records.push(s.save(serde_json::from_value(json!({"kind":kind,"title":title,"body":format!("私人正文 {title}"),"project":project,"source":"D:/source.md","snapshot":if imported {json!({"uri":"D:/source.md","format":"markdown","fingerprint":"before","imported_at":1,"locations":[]})}else{json!(null)}})).unwrap()).unwrap());
    }
    s.change_state(
        serde_json::from_value(
            json!({"id":records[6].id,"expected_revision":1,"state":"archived"}),
        )
        .unwrap(),
    )
    .unwrap();
    let before = serde_json::to_value(s.backup().unwrap()).unwrap();
    let first = s
        .source_inventory(serde_json::from_value(json!({"project":"p","limit":1})).unwrap())
        .unwrap();
    assert_eq!(first.total, 2);
    assert_eq!(first.items.len(), 1);
    let next = s
        .source_inventory(
            serde_json::from_value(json!({"project":"p","limit":1,"cursor":first.next_cursor}))
                .unwrap(),
        )
        .unwrap();
    assert_eq!(next.total, 2);
    assert!(next.next_cursor.is_none());
    assert_ne!(first.items[0].id, next.items[0].id);
    let both = s
        .source_inventory(
            serde_json::from_value(json!({"project":"p","include_global":true})).unwrap(),
        )
        .unwrap();
    assert_eq!(both.total, 3);
    assert!(both
        .items
        .iter()
        .all(|r| r.project == "p" || r.project.is_empty()));
    let global = s
        .source_inventory(serde_json::from_value(json!({"project":""})).unwrap())
        .unwrap();
    assert_eq!(global.total, 1);
    let all = dispatch(&mut s, "source_inventory", json!({})).unwrap();
    assert_eq!(all["total"], 4);
    let text = all.to_string();
    assert!(!text.contains("私人正文"));
    assert!(!text.contains("assets"));
    let after = serde_json::to_value(s.backup().unwrap()).unwrap();
    assert_eq!(before["records"], after["records"]);
    assert_eq!(before["history"], after["history"]);
}
