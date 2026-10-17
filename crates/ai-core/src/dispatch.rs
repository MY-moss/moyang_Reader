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
        "record_view_if_changed" => s.view_if_changed(
            payload["id"]
                .as_str()
                .ok_or_else(|| invalid("缺少编号。"))?,
            payload["revision"]
                .as_i64()
                .ok_or_else(|| invalid("缺少版本。"))?,
        )?,
        "record_view" => s.record_view(
            payload["id"]
                .as_str()
                .ok_or_else(|| invalid("缺少记录编号。"))?,
            None,
        )?,
        "patch" => s.patch(serde_json::from_value(payload)?)?,
        "read_context" => s.read_context(serde_json::from_value(payload)?)?,
        "recall" => s.recall(serde_json::from_value(payload)?)?,
        "resource_context" => s.resource_context(serde_json::from_value(payload)?)?,
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
            s.revision_view(&q.id, q.revision)?
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
        "organization_status" => s.organization_status()?,
        "organization_config" => s.configure_organization(serde_json::from_value(payload)?)?,
        "organization_action" => s.organization_action(payload["action"].as_str().unwrap_or(""))?,
        "merge_groups" => s.merge_groups(
            payload["project"].as_str(),
            payload["offset"].as_u64().unwrap_or(0) as usize,
        )?,
        "merge_detail" => s.merge_detail(payload["id"].as_str().unwrap_or(""))?,
        "merge_action" => s.merge_action(
            payload["id"].as_str().unwrap_or(""),
            payload["action"].as_str().unwrap_or(""),
        )?,
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
        "model_status" => s.model_status()?,
        "model_action" => s.model_action(payload["action"].as_str().unwrap_or("status"))?,
        "model_config" => s.configure_model(
            payload["model"].as_str().unwrap_or(""),
            std::path::Path::new(payload["directory"].as_str().unwrap_or("")),
        )?,
        "semantic_index" => s.index_semantic()?,
        "semantic_test" => s.test_semantic(
            serde_json::from_value(payload["config"].clone())?,
            payload["request_id"].as_str(),
        )?,
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
