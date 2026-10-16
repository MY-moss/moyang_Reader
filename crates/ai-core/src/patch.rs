use crate::{
    store::{check_revision, read_record, save_in, validate},
    *,
};
use rusqlite::TransactionBehavior;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchRequest {
    pub id: String,
    pub expected_revision: i64,
    /// Only supplied fields change: title, summary, body, project, agent, sharing,
    /// tags, source, snapshot, memory_type, importance, pinned, expires_at, links, skill_meta, assets.
    /// Null clears optional fields; [] clears arrays. Other fields/resources are retained.
    pub fields: Map<String, Value>,
    #[serde(default)]
    pub reason: String,
}
impl Store {
    pub fn patch(&mut self, q: PatchRequest) -> Result<Value> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let record = read_record(&tx, &q.id)?;
        check_revision(&record, Some(q.expected_revision))?;
        let original = serde_json::to_value(&record.fields)?;
        let mut merged = original.clone();
        for (key, value) in q.fields {
            if key == "kind" || !original.as_object().unwrap().contains_key(&key) {
                return Err(invalid(&format!("不能局部更新字段：{key}")));
            }
            merged[&key] = value;
        }
        let mut fields: RecordFields = serde_json::from_value(merged)?;
        validate(&mut fields)?;
        if serde_json::to_value(&fields)? == original {
            return Ok(json!({"id":record.id,"revision":record.revision,"unchanged":true}));
        }
        let result = save_in(
            &tx,
            SaveRequest {
                id: Some(q.id),
                expected_revision: Some(q.expected_revision),
                fields,
                reason: q.reason,
            },
        )?;
        tx.commit()?;
        Ok(json!({"id":result.id,"revision":result.revision,"unchanged":false}))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn patch_preserves_resources_scope_and_concurrent_changes_and_ignores_noops() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(dir.path()).unwrap();
        let r=store.save(serde_json::from_value(json!({"kind":"skill","title":"review","summary":"检查资料","body":"保留正文","project":"项目甲","agent":"私有来源","assets":[{"path":"check.txt","encoding":"utf8","content":"资源"}]})).unwrap()).unwrap();
        let request = |fields: Value, revision: i64| {
            serde_json::from_value::<PatchRequest>(
                json!({"id":r.id,"expected_revision":revision,"fields":fields}),
            )
            .unwrap()
        };
        assert_eq!(
            store
                .patch(request(json!({"summary":"检查资料"}), 1))
                .unwrap()["unchanged"],
            true
        );
        assert_eq!(store.history(&r.id).unwrap().len(), 1);
        let changed = store
            .patch(request(
                json!({"summary":"检查来源及历史","expires_at":null}),
                1,
            ))
            .unwrap();
        assert_eq!(changed["revision"], 2);
        let record = store.get(&r.id).unwrap();
        assert_eq!(record.fields.assets[0].content, "资源");
        assert_eq!(record.fields.project, "项目甲");
        assert_eq!(record.fields.sharing, Sharing::Legacy);
        assert!(store.patch(request(json!({"body":"迟到覆盖"}), 1)).is_err());
        assert!(store.patch(request(json!({"misspelt":"bad"}), 2)).is_err());
        assert_eq!(store.get(&r.id).unwrap().fields.body, "保留正文");
        store.patch(request(json!({"assets":[]}), 2)).unwrap();
        assert!(store.get(&r.id).unwrap().fields.assets.is_empty());
        assert_eq!(
            store
                .revision_detail(&r.id, 1)
                .unwrap()
                .record
                .fields
                .assets[0]
                .content,
            "资源"
        );
    }
}
