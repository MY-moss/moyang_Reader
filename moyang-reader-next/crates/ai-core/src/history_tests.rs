use crate::*;
use serde_json::json;

#[test]
fn history_is_bounded_and_cursor_is_stable_when_a_new_revision_arrives() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(dir.path()).unwrap();
    let mut record = store.save(serde_json::from_value(json!({"kind":"skill","title":"review","summary":"Review source evidence","body":"很长的正文".repeat(10000),"assets":[{"path":"check.txt","encoding":"utf8","content":"old"}]})).unwrap()).unwrap();
    for i in 2..=24 {
        record.fields.assets[0].content = if i == 2 {"new".into()} else {format!("revision {i}")};
        record = store.save(SaveRequest{id:Some(record.id.clone()),expected_revision:Some(record.revision),reason:format!("change {i}"),fields:record.fields}).unwrap();
    }
    let page = store.history_page(HistoryRequest{id:record.id.clone(),before_revision:None,limit:Some(20)}).unwrap();
    assert_eq!(page.items.len(),20);
    assert_eq!(page.next_before,Some(5));
    let serialized = serde_json::to_string(&page).unwrap();
    assert!(!serialized.contains("很长的正文"));
    assert!(!serialized.contains("check.txt"));
    assert!(serialized.len()<5000);
    record = store.save(SaveRequest{id:Some(record.id.clone()),expected_revision:Some(record.revision),reason:"newer".into(),fields:record.fields}).unwrap();
    let older = store.history_page(HistoryRequest{id:record.id.clone(),before_revision:page.next_before,limit:Some(20)}).unwrap();
    assert_eq!(older.items.iter().map(|r|r.revision).collect::<Vec<_>>(),vec![4,3,2,1]);
    assert_eq!(older.next_before,None);
    let original = view_record(store.revision_detail(&record.id,1).unwrap().record).unwrap();
    let modified = view_record(store.revision_detail(&record.id,2).unwrap().record).unwrap();
    assert_eq!(original["resources"][0]["size"],modified["resources"][0]["size"]);
    assert_ne!(original["resources"][0]["fingerprint"],modified["resources"][0]["fingerprint"]);
    assert!(original.get("assets").is_none());
    let old = store.asset(AssetRequest{id:record.id.clone(),path:"check.txt".into(),revision:Some(1)}).unwrap();
    assert_eq!(old.content,"old");
    assert_eq!(store.asset(AssetRequest{id:record.id,path:"check.txt".into(),revision:None}).unwrap().content,"revision 24");
}
