use crate::*;
use serde_json::{json, Value};
#[test]
fn section_navigation_ignores_code_and_rejects_ambiguous_headings() {
    let body =
        "# 正文\n例子\n```md\n# 正文\n```\n~~~\n# 结束\n~~~\n## 子节 ###\n证据\n# 结束\n尾声";
    let selected = crate::layers::select_text(
        body,
        &ContextRead {
            section: Some("正文".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(selected.ends_with("证据\n"));
    assert!(selected.contains("# 结束\n~~~"));
    assert!(crate::layers::select_text(
        "# 重名\na\n# 重名\nb",
        &ContextRead {
            section: Some("重名".into()),
            ..Default::default()
        }
    )
    .is_err());
}
fn request(s: &Store, items: Value, budget: usize) -> Value {
    s.read_context(serde_json::from_value(json!({"items":items,"max_chars":budget})).unwrap())
        .unwrap()
}
#[test]
fn layers_preserve_unicode_ranges_continuation_and_history_without_assets() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let body = format!(
        "# 第一节\n{}\n# 第二节\n不要漏掉末尾证据。\n",
        "中文证据与换行\n".repeat(220)
    );
    let r=s.save(serde_json::from_value(json!({"kind":"skill","title":"reference","summary":"需要原文时读取","body":body,"assets":[{"path":"secret.bin","encoding":"base64","content":"AQID"}]})).unwrap()).unwrap();
    let metadata = request(&s, json!([{"id":r.id,"layer":"l0"}]), 2000);
    assert!(!metadata.to_string().contains("AQID"));
    let section = request(
        &s,
        json!([{"id":r.id,"layer":"l2","section":"第二节"}]),
        2000,
    );
    assert_eq!(
        section["items"][0]["content"],
        "# 第二节\n不要漏掉末尾证据。\n"
    );
    let mut next = json!({"id":r.id,"layer":"l2"});
    let mut gathered = String::new();
    loop {
        let result = request(&s, json!([next]), 1400);
        assert!(result.to_string().chars().count() <= 1400);
        assert!(result["items"][0].get("error").is_none(), "{result}");
        gathered.push_str(result["items"][0]["content"].as_str().unwrap());
        let Some(continuation) = result["items"][0].get("continuation") else {
            break;
        };
        next = continuation.clone();
    }
    assert_eq!(gathered, body);
    s.patch(
        serde_json::from_value(
            json!({"id":r.id,"expected_revision":1,"fields":{"body":"已明确更正"}}),
        )
        .unwrap(),
    )
    .unwrap();
    let changed = request(
        &s,
        json!([{"id":r.id,"layer":"l1","if_revision":1},{"id":r.id,"layer":"l2","revision":1,"start_line":1,"end_line":1}]),
        3000,
    );
    assert_eq!(changed["items"][0]["content"], "已明确更正");
    assert_eq!(changed["items"][1]["content"], "# 第一节\n");
    assert_eq!(
        request(&s, json!([{"id":r.id,"layer":"l2","if_revision":2}]), 2000)["items"][0]
            ["unchanged"],
        true
    );
    let history = request(&s, json!([{"id":r.id,"layer":"l3"}]), 3000);
    assert_eq!(
        history["items"][0]["history"]["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(!history.to_string().contains("已明确更正"));
}

#[test]
fn stale_generated_overviews_never_override_human_summaries_or_original_search() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let mut r=s.save(serde_json::from_value(json!({"kind":"knowledge","title":"说明","summary":"手写摘要","body":"很长的原文\n".repeat(220)})).unwrap()).unwrap();
    let before = request(&s, json!([{"id":r.id}]), 3000);
    let etag = before["items"][0]["etag"].clone();
    assert_eq!(
        request(&s, json!([{"id":r.id,"if_etag":etag}]), 3000)["items"][0]["unchanged"],
        true
    );
    s.conn
        .execute(
            "INSERT INTO derived_context VALUES(?,?,?,?,?)",
            rusqlite::params![
                r.id,
                crate::layers::input_fingerprint(&r.fields),
                "自动概览",
                "用途",
                now()
            ],
        )
        .unwrap();
    let after = request(
        &s,
        json!([{"id":r.id,"if_revision":1,"if_etag":etag}]),
        3000,
    );
    assert_eq!(after["items"][0]["content"], "自动概览");
    assert_ne!(after["items"][0]["etag"], etag);
    assert_eq!(
        request(&s, json!([{"id":r.id}]), 3000)["items"][0]["content"],
        "自动概览"
    );
    r.fields.body.push_str("独特的修改证据");
    s.save(SaveRequest {
        id: Some(r.id.clone()),
        expected_revision: Some(1),
        reason: "更改原文".into(),
        fields: r.fields,
    })
    .unwrap();
    let result = request(&s, json!([{"id":r.id}]), 3000);
    assert_eq!(result["items"][0]["overview_status"], "stale");
    assert_eq!(result["items"][0]["content"], "手写摘要");
    assert_eq!(
        s.search(&SearchQuery {
            query: "独特的修改证据".into(),
            ..Default::default()
        })
        .unwrap()
        .total,
        1
    );
}

#[test]
fn small_budget_conditional_overview_does_not_return_oversized_navigation() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let body = (0..12)
        .map(|i| format!("# {i}{}\n{}\n", "长标题".repeat(30), "证据".repeat(30)))
        .collect::<String>();
    let r = s
        .save(
            serde_json::from_value(json!({"kind":"knowledge","title":"目录","body":body})).unwrap(),
        )
        .unwrap();
    let first = request(&s, json!([{"id":r.id}]), 1000);
    let etag = first["items"][0]["etag"].clone();
    assert!(etag.is_string());
    let next = request(&s, json!([{"id":r.id,"if_etag":etag}]), 1000);
    assert_eq!(next["items"][0]["unchanged"], true, "{next}");
}
