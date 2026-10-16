use crate::*;
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use std::collections::HashSet;

impl Store {
    pub fn backup(&mut self) -> Result<Backup> {
        let tx = self.conn.transaction()?;
        let mut records = Vec::new();
        let mut history = Vec::new();
        let mut feedback = Vec::new();
        {
            let mut stmt = tx.prepare("SELECT payload FROM records ORDER BY id")?;
            for row in stmt.query_map([], |r| r.get::<_, String>(0))? {
                records.push(crate::resources::decode(&tx, &row?)?);
            }
        }
        {
            let mut stmt =
                tx.prepare("SELECT payload,reason,recorded FROM revisions ORDER BY id,revision")?;
            for row in stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get(1)?, r.get(2)?)))? {
                let (p, reason, recorded_at) = row?;
                history.push(Revision {
                    record: crate::resources::decode(&tx, &p)?,
                    reason,
                    recorded_at,
                });
            }
        }
        {
            let mut stmt = tx.prepare("SELECT id,score,uses FROM feedback ORDER BY id")?;
            for row in stmt.query_map([], |r| {
                Ok(BackupFeedback {
                    id: r.get(0)?,
                    score: r.get(1)?,
                    uses: r.get(2)?,
                })
            })? {
                feedback.push(row?);
            }
        }
        let mut settings = std::collections::BTreeMap::new();
        {
            let mut stmt = tx.prepare("SELECT key,value FROM settings")?;
            for row in
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            {
                let (k, v) = row?;
                if crate::archive::portable_setting(&k) {
                    settings.insert(k, v);
                }
            }
        }
        let read_rows = |table: &str| -> Result<Vec<serde_json::Value>> {
            let mut stmt =
                tx.prepare(&format!("SELECT payload FROM {table} ORDER BY updated,id"))?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .map(|r| crate::resources::decode(&tx, &r?))
                .collect();
            rows
        };
        let checkpoints = read_rows("checkpoints")?;
        let conflicts = read_rows("conflicts")?;
        let activities = read_rows("activities")?;
        let memory_merges = {
            let mut stmt = tx.prepare(
                "SELECT id,state,updated,payload FROM memory_merges ORDER BY updated,id",
            )?;
            let rows = stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,i64>(2)?,r.get::<_,String>(3)?)))?
                .map(|r|{let (id,state,updated,payload)=r?; Ok(serde_json::json!({"id":id,"state":state,"updated_at":updated,"payload":serde_json::from_str::<serde_json::Value>(&payload)?}))}).collect::<Result<Vec<_>>>()?;
            rows
        };
        tx.commit()?;
        Ok(Backup {
            format: "moyang-ai-space".into(),
            version: 2,
            exported_at: now(),
            records,
            history,
            feedback,
            settings,
            checkpoints,
            conflicts,
            activities,
            memory_merges,
        })
    }
    pub fn import(&mut self, mut backup: Backup) -> Result<serde_json::Value> {
        if backup.format != "moyang-ai-space" || !(1..=2).contains(&backup.version) {
            return Err(invalid("这不是支持的 AI 空间备份。"));
        }
        for (table, rows) in [
            ("checkpoints", &backup.checkpoints),
            ("conflicts", &backup.conflicts),
            ("activities", &backup.activities),
        ] {
            let mut seen = HashSet::new();
            for row in rows {
                match table {
                    "checkpoints" => {
                        let c: Checkpoint = serde_json::from_value(row.clone())?;
                        if !["pending", "completed", "no_new_information"]
                            .contains(&c.status.as_str())
                            || [&c.client, &c.session, &c.turn]
                                .iter()
                                .any(|s| s.trim().is_empty())
                        {
                            return Err(invalid("备份任务状态无效。"));
                        }
                    }
                    "conflicts" => {
                        let mut c: MemoryConflict = serde_json::from_value(row.clone())?;
                        crate::store::validate(&mut c.proposal.fields)?;
                        if !["pending", "accept", "keep_existing", "save_copy"]
                            .contains(&c.status.as_str())
                        {
                            return Err(invalid("备份冲突状态无效。"));
                        }
                    }
                    _ => {
                        let a: Activity = serde_json::from_value(row.clone())?;
                        if a.after_revision < 1 || a.before_revision.is_some_and(|v| v < 1) {
                            return Err(invalid("备份活动版本无效。"));
                        }
                    }
                }
                let id = row["id"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| invalid("备份活动缺少编号。"))?;
                if !seen.insert(id) || row["updated_at"].as_i64().is_none() {
                    return Err(invalid("备份活动记录无效。"));
                }
                if table != "activities" && row["status"].as_str().is_none() {
                    return Err(invalid("备份状态无效。"));
                }
                if table == "checkpoints"
                    && ["client", "session", "turn"]
                        .iter()
                        .any(|k| row[k].as_str().is_none())
                {
                    return Err(invalid("备份任务检查点无效。"));
                }
            }
        }
        if let Some(config) = backup.settings.get("semantic") {
            let _: SemanticConfig = serde_json::from_str(config)?;
        }
        let mut merge_ids = HashSet::new();
        for group in &backup.memory_merges {
            let id = group["id"]
                .as_str()
                .ok_or_else(|| invalid("合并组缺少编号。"))?;
            if !merge_ids.insert(id)
                || group["updated_at"].as_i64().is_none()
                || !["pending", "merged", "dismissed", "undone"]
                    .contains(&group["state"].as_str().unwrap_or(""))
            {
                return Err(invalid("合并组状态无效。"));
            }
            crate::archive::validate_event("memory_merges", id, &group["payload"])?;
        }
        let mut ids = HashSet::new();
        for r in &mut backup.records {
            crate::store::validate(&mut r.fields)?;
            if r.id.is_empty() || r.revision < 1 || !ids.insert(r.id.clone()) {
                return Err(invalid("备份存在无效或重复记录。"));
            }
        }
        let mut feedback_ids = HashSet::new();
        for feedback in &backup.feedback {
            if !ids.contains(&feedback.id)
                || !feedback_ids.insert(&feedback.id)
                || !(-10..=10).contains(&feedback.score)
                || feedback.uses < 1
            {
                return Err(invalid("备份学习反馈无效。"));
            }
        }
        let mut revisions = HashSet::new();
        for h in &mut backup.history {
            crate::store::validate(&mut h.record.fields)?;
            if !ids.contains(&h.record.id)
                || h.record.revision < 1
                || !revisions.insert((h.record.id.clone(), h.record.revision))
            {
                return Err(invalid("备份历史不一致。"));
            }
            let latest = backup.records.iter().find(|r| r.id == h.record.id).unwrap();
            if h.record.revision > latest.revision || h.record.fields.kind != latest.fields.kind {
                return Err(invalid("备份历史版本超出当前记录。"));
            }
            if h.record.revision == latest.revision
                && serde_json::to_value(&h.record)? != serde_json::to_value(latest)?
            {
                return Err(invalid("当前记录与同版本历史内容不一致。"));
            }
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut inserted = HashSet::new();
        let mut matching = HashSet::new();
        let mut skipped = 0;
        for r in &backup.records {
            let exists: Option<String> = tx
                .query_row("SELECT id FROM records WHERE id=?", [&r.id], |row| {
                    row.get(0)
                })
                .optional()?;
            if exists.is_some() {
                skipped += 1;
                if serde_json::to_value(crate::store::read_record(&tx, &r.id)?)?
                    == serde_json::to_value(r)?
                {
                    matching.insert(r.id.clone());
                }
                continue;
            }
            crate::store::persist(&tx, r, "从备份导入")?;
            inserted.insert(r.id.clone());
            matching.insert(r.id.clone());
        }
        for h in backup.history {
            if inserted.contains(&h.record.id) {
                // Current record from the archive is authoritative; older revisions are restored verbatim.
                tx.execute("INSERT OR REPLACE INTO revisions(id,revision,payload,reason,recorded) VALUES(?,?,?,?,?)",params![h.record.id,h.record.revision,crate::resources::encode(&tx, &h.record)?,h.reason,h.recorded_at])?;
            } else if !crate::archive::revision_matches(&tx, &h.record)? {
                matching.remove(&h.record.id);
            }
        }
        for feedback in backup.feedback {
            if inserted.contains(&feedback.id) {
                tx.execute(
                    "INSERT INTO feedback(id,score,uses) VALUES(?,?,?)",
                    params![feedback.id, feedback.score, feedback.uses],
                )?;
            }
        }
        for (key, value) in backup.settings {
            // Connection ownership and liveness belong to this machine, not imported content.
            if key.starts_with("client-install:")
                || key.starts_with("connection:")
                || key.starts_with("connection-source:")
                || key.starts_with("connection-service:")
                || key.starts_with("hook-session:")
                || key == "organization"
                || key == "local_model"
                || key == "semantic_background"
            {
                continue;
            }
            tx.execute(
                "INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)",
                params![key, value],
            )?;
        }
        let mut lifecycle_skipped = 0;
        for (table, rows) in [
            ("checkpoints", backup.checkpoints),
            ("conflicts", backup.conflicts),
            ("activities", backup.activities),
        ] {
            for row in rows {
                if crate::archive::event_records(table, &row)
                    .iter()
                    .any(|id| !matching.contains(*id))
                {
                    lifecycle_skipped += 1;
                    continue;
                }
                let id = row["id"].as_str().unwrap();
                let updated = row["updated_at"].as_i64().unwrap();
                if table == "checkpoints" {
                    tx.execute("INSERT OR IGNORE INTO checkpoints(id,client,session,turn,status,updated,payload) VALUES(?,?,?,?,?,?,?)",params![id,row["client"].as_str(),row["session"].as_str(),row["turn"].as_str(),row["status"].as_str(),updated,serde_json::to_string(&row)?])?;
                } else if table == "conflicts" {
                    tx.execute("INSERT OR IGNORE INTO conflicts(id,status,updated,payload) VALUES(?,?,?,?)",params![id,row["status"].as_str(),updated,crate::resources::encode(&tx, &row)?])?;
                } else {
                    tx.execute(
                        "INSERT OR IGNORE INTO activities(id,updated,payload) VALUES(?,?,?)",
                        params![id, updated, serde_json::to_string(&row)?],
                    )?;
                }
            }
        }
        for group in backup.memory_merges {
            if crate::archive::event_records("memory_merges", &group["payload"])
                .iter()
                .any(|id| !matching.contains(*id))
            {
                lifecycle_skipped += 1;
                continue;
            }
            tx.execute(
                "INSERT OR IGNORE INTO memory_merges VALUES(?,?,?,?)",
                params![
                    group["id"].as_str(),
                    group["state"].as_str(),
                    group["updated_at"].as_i64(),
                    serde_json::to_string(&group["payload"])?
                ],
            )?;
        }
        tx.commit()?;
        Ok(
            serde_json::json!({"imported":inserted.len(),"skipped":skipped,"skipped_activity":lifecycle_skipped}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save_memory(store: &mut Store, title: &str, body: &str) -> Record {
        store
            .save(
                serde_json::from_value(serde_json::json!({
                    "kind": "memory", "title": title, "body": body,
                    "source": "backup test"
                }))
                .unwrap(),
            )
            .unwrap()
    }

    fn feedback_row(store: &Store, id: &str) -> Option<(i64, i64)> {
        store
            .conn
            .query_row("SELECT score,uses FROM feedback WHERE id=?", [id], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .optional()
            .unwrap()
    }

    #[test]
    fn backup_preserves_learning_feedback_and_lexical_ranking() {
        let source_dir = tempfile::tempdir().unwrap();
        let mut source = Store::open(source_dir.path()).unwrap();
        let useful = save_memory(&mut source, "记忆甲", "中文回答 简洁");
        let less_useful = save_memory(&mut source, "记忆乙", "中文回答 详细");
        for useful_vote in [true, false, true] {
            source
                .feedback(FeedbackRequest {
                    id: useful.id.clone(),
                    useful: useful_vote,
                })
                .unwrap();
        }
        for _ in 0..2 {
            source
                .feedback(FeedbackRequest {
                    id: less_useful.id.clone(),
                    useful: false,
                })
                .unwrap();
        }
        let query = SearchQuery {
            query: "中文回答".into(),
            ..Default::default()
        };
        let before = source.search(&query).unwrap();
        let json = serde_json::to_value(source.backup().unwrap()).unwrap();
        assert_eq!(json["feedback"].as_array().map(Vec::len), Some(2));
        let target_dir = tempfile::tempdir().unwrap();
        let mut target = Store::open(target_dir.path()).unwrap();
        target
            .import(serde_json::from_value(json).unwrap())
            .unwrap();
        assert_eq!(feedback_row(&target, &useful.id), Some((1, 3)));
        assert_eq!(feedback_row(&target, &less_useful.id), Some((-2, 2)));
        let after = target.search(&query).unwrap();
        assert_eq!(
            before.items.iter().map(|h| &h.id).collect::<Vec<_>>(),
            after.items.iter().map(|h| &h.id).collect::<Vec<_>>()
        );
        assert_eq!(before.items[0].score, after.items[0].score);
        assert_eq!(before.items[1].score, after.items[1].score);
    }

    #[test]
    fn backup_import_feedback_only_for_new_records() {
        let source_dir = tempfile::tempdir().unwrap();
        let mut source = Store::open(source_dir.path()).unwrap();
        let existing = save_memory(&mut source, "已有反馈", "保留本机反馈");
        let existing_without_feedback = save_memory(&mut source, "没有反馈", "保留本机无反馈状态");
        let target_dir = tempfile::tempdir().unwrap();
        let mut target = Store::open(target_dir.path()).unwrap();
        target.import(source.backup().unwrap()).unwrap();
        target
            .feedback(FeedbackRequest {
                id: existing.id.clone(),
                useful: true,
            })
            .unwrap();
        let new_record = save_memory(&mut source, "新资料", "导入新资料的反馈");
        for record in [&existing, &existing_without_feedback, &new_record] {
            source
                .feedback(FeedbackRequest {
                    id: record.id.clone(),
                    useful: false,
                })
                .unwrap();
        }
        let result = target.import(source.backup().unwrap()).unwrap();
        assert_eq!(result["imported"], 1);
        assert_eq!(result["skipped"], 2);
        assert_eq!(feedback_row(&target, &existing.id), Some((1, 1)));
        assert_eq!(feedback_row(&target, &existing_without_feedback.id), None);
        assert_eq!(feedback_row(&target, &new_record.id), Some((-1, 1)));
    }

    #[test]
    fn backup_legacy_versions_without_feedback_remain_readable() {
        let source_dir = tempfile::tempdir().unwrap();
        let mut source = Store::open(source_dir.path()).unwrap();
        let record = save_memory(&mut source, "旧版备份", "没有 feedback 字段");
        let mut json = serde_json::to_value(source.backup().unwrap()).unwrap();
        json.as_object_mut().unwrap().remove("feedback");
        for version in [1, 2] {
            json["version"] = version.into();
            let target_dir = tempfile::tempdir().unwrap();
            let mut target = Store::open(target_dir.path()).unwrap();
            assert_eq!(
                target
                    .import(serde_json::from_value(json.clone()).unwrap())
                    .unwrap()["imported"],
                1
            );
            assert_eq!(
                target.get(&record.id).unwrap().fields.body,
                record.fields.body
            );
            assert_eq!(feedback_row(&target, &record.id), None);
        }
    }

    #[test]
    fn backup_invalid_feedback_never_partially_imports() {
        let source_dir = tempfile::tempdir().unwrap();
        let mut source = Store::open(source_dir.path()).unwrap();
        let record = save_memory(&mut source, "资料", "导入应保持完整");
        let original = serde_json::to_value(source.backup().unwrap()).unwrap();
        for rows in [
            serde_json::json!([{"id":"missing", "score":1, "uses":1}]),
            serde_json::json!([{"id":record.id, "score":11, "uses":11}]),
            serde_json::json!([{"id":record.id, "score":0, "uses":0}]),
            serde_json::json!([{"id":record.id, "score":1, "uses":1}, {"id":record.id, "score":-1, "uses":1}]),
        ] {
            let mut json = original.clone();
            json["feedback"] = rows;
            let target_dir = tempfile::tempdir().unwrap();
            let mut target = Store::open(target_dir.path()).unwrap();
            assert!(target
                .import(serde_json::from_value(json).unwrap())
                .is_err());
            assert_eq!(target.stats().unwrap().memory, 0);
        }
    }

    #[test]
    fn backup_feedback_write_failure_rolls_back_records_and_history() {
        let source_dir = tempfile::tempdir().unwrap();
        let mut source = Store::open(source_dir.path()).unwrap();
        let record = save_memory(&mut source, "回滚", "反馈恢复失败时回滚整个导入");
        source
            .feedback(FeedbackRequest {
                id: record.id.clone(),
                useful: true,
            })
            .unwrap();
        let target_dir = tempfile::tempdir().unwrap();
        let mut target = Store::open(target_dir.path()).unwrap();
        target.conn.execute_batch("CREATE TRIGGER reject_feedback BEFORE INSERT ON feedback BEGIN SELECT RAISE(ABORT, 'feedback fixture failure'); END;").unwrap();
        assert!(target.import(source.backup().unwrap()).is_err());
        assert!(target.get(&record.id).is_err());
        let history: i64 = target
            .conn
            .query_row("SELECT COUNT(*) FROM revisions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(history, 0);
    }
}
