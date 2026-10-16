use crate::*;
use serde_json::{json, Value};

/// Retain legacy field names, with each evidence string represented only once.
pub fn compact_search(result: SearchResult) -> Value {
    let items: Vec<_> = result
        .items
        .into_iter()
        .map(|mut hit| {
            if !hit.fragments.is_empty() {
                hit.excerpt.clear();
                for f in &mut hit.fragments {
                    f.location.quote.clear();
                }
            }
            let mut value = serde_json::to_value(hit).expect("serializable search hit");
            // Empty aliases preserve older clients' ability to read the same fields.
            if value["summary"].as_str().is_some_and(|s| {
                !s.is_empty()
                    && value["fragments"].as_array().is_some_and(|fs| {
                        fs.iter()
                            .any(|f| f["text"].as_str().is_some_and(|t| t.contains(s)))
                    })
            }) {
                value["summary"] = json!("");
            }
            value
        })
        .collect();
    json!({"items":items,"total":result.total,"warning":result.warning})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn evidence_is_returned_once_with_source_positions() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        s.save(serde_json::from_value(json!({"kind":"knowledge","title":"索引","body":"中国资料检索保留准确出处","summary":"中国资料检索","source":"notes.txt"})).unwrap()).unwrap();
        let result = compact_search(
            s.search(&SearchQuery {
                query: "资料检索".into(),
                ..Default::default()
            })
            .unwrap(),
        );
        assert_eq!(
            result
                .to_string()
                .matches("中国资料检索保留准确出处")
                .count(),
            1
        );
        assert_eq!(
            result["items"][0]["fragments"][0]["location"]["uri"],
            "notes.txt"
        );
        assert_eq!(result["items"][0]["excerpt"], "");
    }
}
