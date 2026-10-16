use crate::*;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::VecDeque,
    sync::{Mutex, OnceLock},
};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct RecallRequest {
    #[serde(flatten)]
    pub query: ContextRequest,
    #[serde(default)]
    pub kinds: Vec<Kind>,
    pub layer: Option<ContextLayer>,
    /// Fresh identifier after compaction, restart, project change or handoff. Omit for stateless recall.
    pub context_id: Option<String>,
    /// Echo only while previous results are still in your current context. Unknown/expired receipts reset safely.
    pub receipt: Option<String>,
    #[serde(default)]
    pub reset: bool,
    pub request_id: Option<String>,
}
#[derive(Clone)]
struct Seen {
    id: String,
    revision: i64,
    digest: String,
}
#[derive(Clone)]
struct Receipt {
    token: String,
    scope: String,
    created: i64,
    seen: VecDeque<Seen>,
}
fn receipts() -> &'static Mutex<VecDeque<Receipt>> {
    static LEDGER: OnceLock<Mutex<VecDeque<Receipt>>> = OnceLock::new();
    LEDGER.get_or_init(|| Mutex::new(VecDeque::new()))
}
fn size(v: &Value) -> usize {
    v.to_string().chars().count()
}
impl Store {
    pub fn recall(&self, mut q: RecallRequest) -> Result<Value> {
        q.query.project.get_or_insert_with(String::new);
        if q.context_id.as_ref().is_some_and(|s| s.len() > 512) {
            return Err(invalid("上下文编号过长。"));
        }
        let layer = q.layer.unwrap_or_default();
        let budget = q.query.max_chars.unwrap_or(8000).clamp(1000, 30000);
        let scope = serde_json::to_string(&json!([
            self.path,
            q.query.project,
            q.query.agent,
            q.kinds,
            layer,
            q.context_id
        ]))?;
        let old = if !q.reset && q.context_id.is_some() {
            receipts().lock().ok().and_then(|mut entries| {
                entries.retain(|e| now() - e.created < 30 * 60 * 1000);
                entries
                    .iter()
                    .find(|e| Some(&e.token) == q.receipt.as_ref() && e.scope == scope)
                    .cloned()
            })
        } else {
            None
        };
        let (mut hits, warning) =
            self.context_hits(q.query.clone(), q.request_id.clone(), &q.kinds)?;
        hits.retain(|h| q.kinds.is_empty() || q.kinds.contains(&h.kind));
        let mut seen = old.as_ref().map(|r| r.seen.clone()).unwrap_or_default();
        let token = q
            .context_id
            .as_ref()
            .map(|_| uuid::Uuid::new_v4().to_string());
        let mut out = json!({"items":[],"changes":[],"receipt":token,"context_reset":old.is_none(),"unchanged":0,"truncated":false,"max_chars":budget,"warning":warning});
        for entry in seen.clone() {
            crate::cancellation::check_cancelled(q.request_id.as_deref())?;
            let record = crate::layers::projected_record(self, &entry.id, None);
            let state = match &record {
                Err(Error::Message(_)) => Some("deleted"),
                Err(error) => return Err(invalid(&error.to_string())),
                Ok(r) if r.state != RecordState::Active => Some("archived"),
                Ok(r) if r.fields.expires_at.is_some_and(|t| t <= now()) => Some("expired"),
                Ok(r)
                    if !crate::search::allowed(
                        r,
                        &SearchQuery {
                            project: q.query.project.clone(),
                            agent: q.query.agent.clone(),
                            ..Default::default()
                        },
                    ) =>
                {
                    Some("scope_changed")
                }
                _ => None,
            };
            if let Some(state) = state {
                let change = json!({"id":entry.id,"state":state});
                if size(&out) + size(&change) + 100 <= budget {
                    out["changes"].as_array_mut().unwrap().push(change);
                    seen.retain(|s| s.id != entry.id);
                } else {
                    out["truncated"] = json!(true);
                }
            } else if let Ok(r) = record {
                if r.revision != entry.revision
                    && !hits.iter().any(|h| h.id == entry.id)
                    && (q.kinds.is_empty() || q.kinds.contains(&r.fields.kind))
                {
                    hits.insert(
                        0,
                        Hit::from_record(&r, r.fields.body.chars().take(1200).collect(), 0.0),
                    );
                }
            }
        }
        let mut unchanged = 0;
        for hit in hits.iter().take(12) {
            crate::cancellation::check_cancelled(q.request_id.as_deref())?;
            let remaining = budget.saturating_sub(size(&out) + 100);
            if remaining < 600 {
                out["truncated"] = json!(true);
                break;
            }
            let quota = (budget / hits.len().clamp(1, 4)).max(1000).min(remaining);
            let mut item = self.read_layer(
                &ContextRead {
                    id: hit.id.clone(),
                    layer,
                    ..Default::default()
                },
                quota,
            )?;
            let project = item["scope"]["project"].as_str().unwrap_or("");
            let agent = item["scope"]["agent"].as_str().unwrap_or("");
            if item["state"] != "active"
                || item["expired"] == true
                || (!project.is_empty() && Some(project) != q.query.project.as_deref())
                || (item["scope"]["sharing"] == "legacy"
                    && !agent.is_empty()
                    && q.query.agent.as_deref().is_some_and(|a| a != agent))
            {
                continue;
            }
            if layer == ContextLayer::L1
                && item["fallback"] == "original_excerpt"
                && item["revision"] == hit.revision
                && !hit.fragments.is_empty()
            {
                let text = hit
                    .fragments
                    .iter()
                    .take(2)
                    .map(|f| crate::context_pack::evidence(&f.text, &q.query.query, 350).0)
                    .collect::<Vec<_>>()
                    .join("\n");
                item["content"] = json!(text);
                item["fingerprint"] = json!(hex(Sha256::digest(text.as_bytes())));
                item.as_object_mut().unwrap().remove("continuation");
                item["locations"]=json!(hit.fragments.iter().take(2).map(|f|json!({"ordinal":f.ordinal,"page":f.location.page,"paragraph":f.location.paragraph})).collect::<Vec<_>>());
                if size(&item) > quota {
                    item.as_object_mut().unwrap().remove("navigation");
                }
            }
            let digest = hex(Sha256::digest(item.to_string().as_bytes()));
            let revision = item["revision"].as_i64().unwrap();
            if seen
                .iter()
                .any(|s| s.id == hit.id && s.revision == revision && s.digest == digest)
            {
                unchanged += 1;
                continue;
            }
            if size(&out) + size(&item) + 20 > budget {
                out["truncated"] = json!(true);
                break;
            }
            seen.retain(|s| s.id != hit.id);
            seen.push_back(Seen {
                id: hit.id.clone(),
                revision,
                digest,
            });
            out["items"].as_array_mut().unwrap().push(item);
        }
        out["unchanged"] = json!(unchanged);
        if let Some(token) = token {
            while seen.len() > 64 {
                seen.pop_front();
            }
            if let Ok(mut ledger) = receipts().lock() {
                if let Some(previous) = q.receipt {
                    ledger.retain(|r| r.token != previous);
                }
                ledger.push_back(Receipt {
                    token,
                    scope,
                    created: now(),
                    seen,
                });
                while ledger.len() > 128 {
                    ledger.pop_front();
                }
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn receipts_skip_only_retained_evidence_and_observe_corrections_archives_and_resets() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let r=s.save(serde_json::from_value(json!({"kind":"memory","title":"缩进偏好","body":"使用两个空格","sharing":"project","project":"甲"})).unwrap()).unwrap();
        let query = |receipt: Value, project: &str| {
            serde_json::from_value::<RecallRequest>(json!({"query":"缩进","project":project,"context_id":"turn-context","receipt":receipt,"max_chars":3000})).unwrap()
        };
        let first = s.recall(query(Value::Null, "甲")).unwrap();
        let again = s.recall(query(first["receipt"].clone(), "甲")).unwrap();
        assert_eq!(again["items"], json!([]));
        assert_eq!(again["unchanged"], 1);
        s.patch(
            serde_json::from_value(
                json!({"id":r.id,"expected_revision":1,"fields":{"body":"改用四个空格"}}),
            )
            .unwrap(),
        )
        .unwrap();
        let changed = s.recall(query(again["receipt"].clone(), "甲")).unwrap();
        assert_eq!(changed["items"][0]["content"], "改用四个空格");
        let switched = s.recall(query(changed["receipt"].clone(), "乙")).unwrap();
        assert_eq!(switched["items"], json!([]));
        assert_eq!(switched["context_reset"], true);
        let reset = s
            .recall(query(json!("unknown-after-compaction"), "甲"))
            .unwrap();
        assert_eq!(reset["items"][0]["content"], "改用四个空格");
        s.change_state(StateRequest {
            id: r.id.clone(),
            expected_revision: 2,
            state: RecordState::Archived,
        })
        .unwrap();
        let archived = s.recall(query(reset["receipt"].clone(), "甲")).unwrap();
        assert_eq!(archived["changes"][0]["state"], "archived");
        assert_eq!(archived["items"], json!([]));
    }
}
