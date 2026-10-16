use crate::*;
use serde_json::Value;
pub fn dispatch(s: &mut Store, operation: &str, payload: Value) -> Result<Value> {
    Ok(match operation {
        "search" => serde_json::to_value(s.search(&serde_json::from_value(payload)?)?)?,
        "cancel_search" => {
            cancel_search(
                payload["request_id"]
                    .as_str()
                    .ok_or_else(|| invalid("缺少查询编号。"))?,
            );
            Value::Null
        }
        "get" => serde_json::to_value(
            s.get(
                payload["id"]
                    .as_str()
                    .ok_or_else(|| invalid("缺少记录编号。"))?,
            )?,
        )?,
        "save" => serde_json::to_value(s.save(serde_json::from_value(payload)?)?)?,
        "get_if_changed" => serde_json::to_value(
            s.get_if_changed(
                payload["id"]
                    .as_str()
                    .ok_or_else(|| invalid("缺少记录编号。"))?,
                payload["revision"]
                    .as_i64()
                    .ok_or_else(|| invalid("缺少版本。"))?,
            )?,
        )?,
        "state" => serde_json::to_value(s.change_state(serde_json::from_value(payload)?)?)?,
        "history" => serde_json::to_value(
            s.history(
                payload["id"]
                    .as_str()
                    .ok_or_else(|| invalid("缺少记录编号。"))?,
            )?,
        )?,
        "history_page" => serde_json::to_value(s.history_page(serde_json::from_value(payload)?)?)?,
        "revision_view" => {
            let q: RevisionRequest = serde_json::from_value(payload)?;
            let h = s.revision_detail(&q.id, q.revision)?;
            serde_json::json!({"record": view_record(h.record)?,"reason":h.reason,"recorded_at":h.recorded_at})
        }
        "restore" => serde_json::to_value(s.restore(serde_json::from_value(payload)?)?)?,
        "merge" => serde_json::to_value(s.merge(serde_json::from_value(payload)?)?)?,
        "feedback" => {
            s.feedback(serde_json::from_value(payload)?)?;
            Value::Null
        }
        "asset" => serde_json::to_value(s.asset(serde_json::from_value(payload)?)?)?,
        "delete" => {
            s.delete(
                payload["id"]
                    .as_str()
                    .ok_or_else(|| invalid("缺少记录编号。"))?,
                payload["expected_revision"]
                    .as_i64()
                    .ok_or_else(|| invalid("缺少版本。"))?,
            )?;
            Value::Null
        }
        "stats" => serde_json::to_value(s.stats()?)?,
        "health" => serde_json::to_value(s.health(serde_json::from_value(payload)?)?)?,
        "source_inventory" => {
            serde_json::to_value(s.source_inventory(serde_json::from_value(payload)?)?)?
        }
        "backup" => serde_json::to_value(s.backup()?)?,
        "import" => s.import(serde_json::from_value(payload)?)?,
        "context" => s.context(serde_json::from_value(payload)?)?,
        "semantic_config" => {
            serde_json::to_value(s.configure_semantic(serde_json::from_value(payload)?)?)?
        }
        "semantic_index" => s.index_semantic()?,
        "semantic_pause" | "semantic_resume" => {
            s.pause_semantic(operation == "semantic_pause")?;
            Value::Null
        }
        "checkpoint" => s.checkpoint(serde_json::from_value(payload)?)?,
        "conclude" => serde_json::to_value(s.conclude(serde_json::from_value(payload)?)?)?,
        "activity" => s.activity_feed()?,
        "activity_page" => s.activity_page(serde_json::from_value(payload)?)?,
        "conflict_detail" => s.conflict_detail(
            payload["id"]
                .as_str()
                .ok_or_else(|| invalid("缺少冲突编号。"))?,
        )?,
        "fetch_web" => fetch_web_source(
            payload["uri"]
                .as_str()
                .ok_or_else(|| invalid("缺少网址。"))?,
        )?,
        "resolve_conflict" => {
            serde_json::to_value(s.resolve_conflict(serde_json::from_value(payload)?)?)?
        }
        "undo_activity" => {
            serde_json::to_value(s.undo_activity(serde_json::from_value(payload)?)?)?
        }
        "revision_detail" => serde_json::to_value(
            s.revision_detail(
                payload["id"]
                    .as_str()
                    .ok_or_else(|| invalid("缺少编号。"))?,
                payload["revision"]
                    .as_i64()
                    .ok_or_else(|| invalid("缺少版本。"))?,
            )?,
        )?,
        _ => return Err(invalid(&format!("未知 AI 操作：{operation}"))),
    })
}
