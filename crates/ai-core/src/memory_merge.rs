use crate::*;
use rusqlite::{params, OptionalExtension, Transaction};
use serde_json::{json, Value};
use std::collections::BTreeSet;

fn compatible(a: &Record, b: &Record) -> bool {
    a.id != b.id
        && a.fields.kind == Kind::Memory
        && b.fields.kind == Kind::Memory
        && a.state == RecordState::Active
        && b.state == RecordState::Active
        && a.fields.project == b.fields.project
        && a.fields.sharing == b.fields.sharing
        && (a.fields.sharing != Sharing::Legacy || a.fields.agent == b.fields.agent)
        && a.fields.memory_type == b.fields.memory_type
        && a.fields.expires_at == b.fields.expires_at
        && !a.fields.expires_at.is_some_and(|t| t <= now())
        && a.fields.assets.is_empty()
        && b.fields.assets.is_empty()
}
// Equality here is a necessary guard, never proof of synonymy. The model must separately
// affirm exact meaning and applicability; uncertain proposals remain reviewable.
fn anchors(body: &str) -> (BTreeSet<String>, BTreeSet<String>) {
    let mut numbers = BTreeSet::new();
    let mut word = String::new();
    for c in body.chars().chain(std::iter::once(' ')) {
        if c.is_numeric() || (matches!(c, '.' | ':' | '/' | '-' | '%') && !word.is_empty()) {
            word.push(c);
        } else if !word.is_empty() {
            numbers.insert(std::mem::take(&mut word));
        }
    }
    let lower = format!(" {} ", body.to_lowercase());
    let conditions = [
        "不", "未", "无", "禁止", "除非", "仅", "只", "以后", "之前", "之后", "今天", "明天",
        "昨天", "始终", "从不", "所有", "必须", "至少", "最多", "一次", "两", "三", "四", "五",
        "零", "一", "二", "六", "七", "八", "九", "十", "百", "千", "万", " not ", " never ",
        " only ", " before ", " after ", " unless ",
    ];
    let guards = conditions
        .into_iter()
        .filter(|w| lower.contains(w))
        .map(str::to_owned)
        .collect();
    (numbers, guards)
}
pub(crate) fn apply_proposal(
    tx: &Transaction,
    record: &Record,
    candidates: &[Record],
    result: &crate::organizer::Organized,
) -> Result<()> {
    let Some(id) = result.merge_with.as_ref() else {
        return Ok(());
    };
    let Some(expected) = candidates.iter().find(|r| &r.id == id) else {
        return Ok(());
    };
    let Ok(candidate) = crate::store::read_record(tx, id) else {
        return Ok(());
    };
    if candidate.revision != expected.revision || !compatible(record, &candidate) {
        return Ok(());
    }
    if result.merge_reason.trim().is_empty()
        || result.merge_body.trim().is_empty()
        || result.merge_title.trim().is_empty()
    {
        return Ok(());
    }
    let safe = result.equivalent
        && result.same_applicability
        && anchors(&record.fields.body) == anchors(&candidate.fields.body)
        && anchors(&result.merge_body) == anchors(&record.fields.body);
    let group = uuid::Uuid::new_v4().to_string();
    let originals = vec![record.clone(), candidate];
    // Stable pair/revisions prevent repeatedly proposing the same unresolved pair.
    let mut pair: Vec<_> = originals
        .iter()
        .map(|r| format!("{}:{}", r.id, r.revision))
        .collect();
    pair.sort();
    let pair = pair.join("|");
    let exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM memory_merges WHERE payload->>'$.pair'=? AND state IN ('pending','merged'))",[&pair],|r|r.get(0))?;
    if exists {
        return Ok(());
    }
    let mut payload = json!({"pair":pair,"originals":originals,"title":result.merge_title,"body":result.merge_body,"reason":result.merge_reason,"auto":safe,"result":null});
    let state = if safe {
        create_merge(tx, &mut payload)?;
        "merged"
    } else {
        "pending"
    };
    tx.execute(
        "INSERT INTO memory_merges VALUES(?,?,?,?)",
        params![group, state, now(), payload.to_string()],
    )?;
    Ok(())
}
fn create_merge(tx: &Transaction, payload: &mut Value) -> Result<()> {
    let expected: Vec<Record> = serde_json::from_value(payload["originals"].clone())?;
    let mut originals = Vec::new();
    for r in expected {
        let current = crate::store::read_record(tx, &r.id)?;
        crate::store::check_revision(&current, Some(r.revision))?;
        originals.push(current);
    }
    if originals.len() != 2 || !compatible(&originals[0], &originals[1]) {
        return Err(invalid("原记忆范围或状态已变化，请重新比较。"));
    }
    let mut fields = originals[0].fields.clone();
    fields.title = payload["title"].as_str().unwrap_or("").into();
    fields.body = payload["body"].as_str().unwrap_or("").into();
    fields.summary = String::new();
    fields.source = originals
        .iter()
        .map(|r| format!("{}（{}）：{}", r.id, r.fields.agent, r.fields.source))
        .collect::<Vec<_>>()
        .join("\n");
    fields.links = originals
        .iter()
        .flat_map(|r| std::iter::once(r.id.clone()).chain(r.fields.links.clone()))
        .collect();
    fields.tags = originals
        .iter()
        .flat_map(|r| r.fields.tags.clone())
        .collect();
    fields.pinned = originals.iter().any(|r| r.fields.pinned);
    fields.importance = originals
        .iter()
        .map(|r| r.fields.importance)
        .max()
        .unwrap_or(3);
    crate::store::validate(&mut fields)?;
    // A group always creates a new identity, even when its body equals one original.
    let result = Record {
        id: uuid::Uuid::new_v4().to_string(),
        revision: 1,
        created_at: now(),
        updated_at: now(),
        state: RecordState::Active,
        fields,
    };
    crate::store::persist(
        tx,
        &result,
        &format!("同义合并：{}", payload["reason"].as_str().unwrap_or("")),
    )?;
    for original in &mut originals {
        original.state = RecordState::Archived;
        original.revision += 1;
        original.updated_at = now();
        crate::store::persist(tx, original, &format!("被同义记忆 {} 替代", result.id))?;
    }
    payload["result"] = json!({"id":result.id,"revision":result.revision});
    payload["archived"] = json!(originals
        .iter()
        .map(|r| json!({"id":r.id,"revision":r.revision}))
        .collect::<Vec<_>>());
    Ok(())
}
impl Store {
    pub(crate) fn merge_candidates(&self, record: &Record) -> Result<Vec<Record>> {
        if record.fields.kind != Kind::Memory {
            return Ok(vec![]);
        }
        let found = self.lexical(&SearchQuery {
            query: format!(
                "{} {}",
                record.fields.title,
                record.fields.body.chars().take(160).collect::<String>()
            ),
            kind: Some(Kind::Memory),
            project: Some(record.fields.project.clone()),
            agent: Some(record.fields.agent.clone()),
            include_global: false,
            limit: 8,
            ..Default::default()
        })?;
        let mut result = Vec::new();
        for hit in found.items {
            let r = crate::layers::projected_record(self, &hit.id, None)?;
            if compatible(record, &r) {
                result.push(r);
            }
            if result.len() == 3 {
                break;
            }
        }
        Ok(result)
    }
    pub fn merge_groups(&self, project: Option<&str>, offset: usize) -> Result<Value> {
        let mut stmt=self.conn.prepare("SELECT id,state,updated,json_object('title',payload->>'$.title','reason',payload->>'$.reason','project',payload->>'$.originals[0].project','result',json_extract(payload,'$.result')) FROM memory_merges WHERE (?1 IS NULL OR payload->>'$.originals[0].project'=?1) ORDER BY updated DESC,id LIMIT 21 OFFSET ?2")?;
        let mut rows = stmt
            .query_map(params![project, offset as i64], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })?
            .map(|row| {
                let (id, state, at, raw) = row?;
                let mut v: Value = serde_json::from_str(&raw)?;
                v["id"] = json!(id);
                v["state"] = json!(state);
                v["updated_at"] = json!(at);
                Ok(v)
            })
            .collect::<Result<Vec<_>>>()?;
        let more = rows.len() > 20;
        rows.truncate(20);
        Ok(json!({"items":rows,"next_offset":more.then_some(offset+20)}))
    }
    pub fn merge_detail(&self, id: &str) -> Result<Value> {
        let raw: String = self
            .conn
            .query_row("SELECT payload FROM memory_merges WHERE id=?", [id], |r| {
                r.get(0)
            })
            .optional()?
            .ok_or_else(|| invalid("合并记录不存在。"))?;
        Ok(serde_json::from_str(&raw)?)
    }
    pub fn merge_action(&mut self, id: &str, action: &str) -> Result<Value> {
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let (state, raw): (String, String) = tx.query_row(
            "SELECT state,payload FROM memory_merges WHERE id=?",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        let mut payload: Value = serde_json::from_str(&raw)?;
        let next = match (state.as_str(), action) {
            ("pending", "accept") => {
                create_merge(&tx, &mut payload)?;
                "merged"
            }
            ("pending", "dismiss") => "dismissed",
            ("merged", "undo") => {
                let result_id = payload["result"]["id"]
                    .as_str()
                    .ok_or_else(|| invalid("合并记录不完整。"))?;
                let mut result = crate::store::read_record(&tx, result_id)?;
                crate::store::check_revision(&result, payload["result"]["revision"].as_i64())
                    .map_err(|_| {
                        invalid("合并后的记忆已被编辑。请先查看差异；撤回不会覆盖新内容。")
                    })?;
                let expected: Vec<Value> = serde_json::from_value(payload["archived"].clone())?;
                for original in expected {
                    let mut r =
                        crate::store::read_record(&tx, original["id"].as_str().unwrap_or(""))?;
                    crate::store::check_revision(&r, original["revision"].as_i64())?;
                    if r.state != RecordState::Archived {
                        return Err(invalid("原记录状态已改变，请先比较差异。"));
                    }
                    r.state = RecordState::Active;
                    r.revision += 1;
                    r.updated_at = now();
                    crate::store::persist(&tx, &r, "撤回整组同义合并，恢复原文")?;
                }
                result.state = RecordState::Archived;
                result.revision += 1;
                result.updated_at = now();
                crate::store::persist(&tx, &result, "撤回同义合并")?;
                "undone"
            }
            _ => return Err(invalid("此合并状态不支持该操作。")),
        };
        tx.execute(
            "UPDATE memory_merges SET state=?,updated=?,payload=? WHERE id=?",
            params![next, now(), payload.to_string(), id],
        )?;
        tx.commit()?;
        Ok(json!({"id":id,"state":next}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn record(s: &mut Store, body: &str, project: &str) -> Record {
        s.save(serde_json::from_value(json!({"kind":"memory","title":"偏好","body":body,"project":project,"sharing":"project","source":"明确要求"})).unwrap()).unwrap()
    }
    fn propose(s: &mut Store, a: &Record, b: &Record, body: &str) {
        let result = crate::organizer::Organized {
            purpose: "偏好".into(),
            overview: "概览".into(),
            merge_with: Some(b.id.clone()),
            merge_title: "共同偏好".into(),
            merge_body: body.into(),
            merge_reason: "两条用户明确表达使用简洁中文".into(),
            equivalent: true,
            same_applicability: true,
        };
        let tx = s.conn.transaction().unwrap();
        apply_proposal(&tx, a, &[b.clone()], &result).unwrap();
        tx.commit().unwrap();
    }
    #[test]
    fn merge_retains_originals_and_group_undo_never_overwrites_later_edits() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let a = record(&mut s, "偏好简洁中文", "reader");
        let b = record(&mut s, "喜欢用简洁中文表达", "reader");
        propose(&mut s, &a, &b, "使用简洁中文");
        let groups = s.merge_groups(None, 0).unwrap();
        let id = groups["items"][0]["id"].as_str().unwrap();
        assert_eq!(groups["items"][0]["state"], "merged");
        let detail = s.merge_detail(id).unwrap();
        let merged = detail["result"]["id"].as_str().unwrap();
        assert_ne!(merged, a.id);
        assert_eq!(s.get(&a.id).unwrap().state, RecordState::Archived);
        let archive = dir.path().join("merge.zip");
        s.export_archive(&archive).unwrap();
        let legacy_dir = tempfile::tempdir().unwrap();
        let mut legacy = Store::open(legacy_dir.path()).unwrap();
        legacy.import(s.backup().unwrap()).unwrap();
        legacy.merge_action(id, "undo").unwrap();
        assert_eq!(legacy.get(&a.id).unwrap().state, RecordState::Active);
        // Same current records with a forked old version must not import undo actions.
        let fork_dir = tempfile::tempdir().unwrap();
        let mut fork = Store::open(fork_dir.path()).unwrap();
        fork.import_archive(&archive).unwrap();
        fork.conn.execute("DELETE FROM memory_merges", []).unwrap();
        fork.conn.execute("UPDATE revisions SET payload=json_set(payload,'$.body','另一条历史') WHERE id=? AND revision=1",[&a.id]).unwrap();
        assert!(
            fork.import_archive(&archive).unwrap()["skipped_activity"]
                .as_u64()
                .unwrap()
                > 0
        );
        assert!(fork.merge_groups(None, 0).unwrap()["items"]
            .as_array()
            .unwrap()
            .is_empty());
        assert!(
            fork.import(s.backup().unwrap()).unwrap()["skipped_activity"]
                .as_u64()
                .unwrap()
                > 0
        );
        assert!(fork.merge_groups(None, 0).unwrap()["items"]
            .as_array()
            .unwrap()
            .is_empty());
        let recovered = tempfile::tempdir().unwrap();
        let mut restored = Store::open(recovered.path()).unwrap();
        restored.import_archive(&archive).unwrap();
        restored.merge_action(id, "undo").unwrap();
        assert_eq!(restored.get(&a.id).unwrap().state, RecordState::Active);
        assert_eq!(restored.get(&b.id).unwrap().state, RecordState::Active);
        s.patch(
            serde_json::from_value(
                json!({"id":merged,"expected_revision":1,"fields":{"body":"后续的新规则"}}),
            )
            .unwrap(),
        )
        .unwrap();
        assert!(s.merge_action(id, "undo").is_err());
        assert_eq!(s.get(&a.id).unwrap().state, RecordState::Archived);
        let c = record(&mut s, "偏好完整出处", "other");
        let d = record(&mut s, "喜欢有完整出处", "other");
        propose(&mut s, &c, &d, "给出完整出处");
        let groups = s.merge_groups(Some("other"), 0).unwrap();
        s.merge_action(groups["items"][0]["id"].as_str().unwrap(), "undo")
            .unwrap();
        assert_eq!(s.get(&c.id).unwrap().state, RecordState::Active);
        assert_eq!(s.get(&d.id).unwrap().state, RecordState::Active);
    }
    #[test]
    fn number_version_negation_and_scope_differences_never_merge_automatically() {
        for (a, b) in [
            ("最多 3 条", "最多 5 条"),
            ("版本 1.2", "版本 2.1"),
            ("允许联网", "不允许联网"),
            ("仅项目 A", "项目 A"),
        ] {
            let dir = tempfile::tempdir().unwrap();
            let mut s = Store::open(dir.path()).unwrap();
            let x = record(&mut s, a, "reader");
            let y = record(&mut s, b, "reader");
            propose(&mut s, &x, &y, a);
            assert_eq!(
                s.merge_groups(None, 0).unwrap()["items"][0]["state"],
                "pending"
            );
            assert_eq!(s.get(&x.id).unwrap().state, RecordState::Active);
        }
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let a = record(&mut s, "使用中文", "a");
        let b = record(&mut s, "用中文", "b");
        propose(&mut s, &a, &b, "使用中文");
        assert!(s.merge_groups(None, 0).unwrap()["items"]
            .as_array()
            .unwrap()
            .is_empty());
    }
}
