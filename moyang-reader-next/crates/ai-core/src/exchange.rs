use crate::*;
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use std::collections::HashSet;

impl Store {
    pub fn backup(&mut self) -> Result<Backup> {
        let tx = self.conn.transaction()?;
        let mut records = Vec::new();
        let mut history = Vec::new();
        {
            let mut stmt = tx.prepare("SELECT payload FROM records ORDER BY id")?;
            for row in stmt.query_map([], |r| r.get::<_, String>(0))? {
                records.push(serde_json::from_str(&row?)?);
            }
        }
        {
            let mut stmt =
                tx.prepare("SELECT payload,reason,recorded FROM revisions ORDER BY id,revision")?;
            for row in stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get(1)?, r.get(2)?)))? {
                let (p, reason, recorded_at) = row?;
                history.push(Revision {
                    record: serde_json::from_str(&p)?,
                    reason,
                    recorded_at,
                });
            }
        }
        let mut settings = std::collections::BTreeMap::new();
        {
            let mut stmt = tx.prepare("SELECT key,value FROM settings")?;
            for row in
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            {
                let (k, v) = row?;
                settings.insert(k, v);
            }
        }
        let read_rows = |table: &str| -> Result<Vec<serde_json::Value>> {
            let mut stmt =
                tx.prepare(&format!("SELECT payload FROM {table} ORDER BY updated,id"))?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .map(|r| Ok(serde_json::from_str(&r?)?))
                .collect();
            rows
        };
        let checkpoints = read_rows("checkpoints")?;
        let conflicts = read_rows("conflicts")?;
        let activities = read_rows("activities")?;
        tx.commit()?;
        Ok(Backup {
            format: "moyang-ai-space".into(),
            version: 2,
            exported_at: now(),
            records,
            history,
            settings,
            checkpoints,
            conflicts,
            activities,
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
        let mut ids = HashSet::new();
        for r in &mut backup.records {
            crate::store::validate(&mut r.fields)?;
            if r.id.is_empty() || r.revision < 1 || !ids.insert(r.id.clone()) {
                return Err(invalid("备份存在无效或重复记录。"));
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
        let mut skipped = 0;
        for r in &backup.records {
            let exists: Option<String> = tx
                .query_row("SELECT id FROM records WHERE id=?", [&r.id], |row| {
                    row.get(0)
                })
                .optional()?;
            if exists.is_some() {
                skipped += 1;
                continue;
            }
            crate::store::persist(&tx, r, "从备份导入")?;
            inserted.insert(r.id.clone());
        }
        for h in backup.history {
            if inserted.contains(&h.record.id) {
                // Current record from the archive is authoritative; older revisions are restored verbatim.
                tx.execute("INSERT OR REPLACE INTO revisions(id,revision,payload,reason,recorded) VALUES(?,?,?,?,?)",params![h.record.id,h.record.revision,serde_json::to_string(&h.record)?,h.reason,h.recorded_at])?;
            }
        }
        for (key, value) in backup.settings {
            // Connection ownership and liveness belong to this machine, not imported content.
            if key.starts_with("client-install:")
                || key.starts_with("connection:")
                || key == "semantic_background"
            {
                continue;
            }
            tx.execute(
                "INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)",
                params![key, value],
            )?;
        }
        for (table, rows) in [
            ("checkpoints", backup.checkpoints),
            ("conflicts", backup.conflicts),
            ("activities", backup.activities),
        ] {
            for row in rows {
                let id = row["id"].as_str().unwrap();
                let updated = row["updated_at"].as_i64().unwrap();
                if table == "checkpoints" {
                    tx.execute("INSERT OR IGNORE INTO checkpoints(id,client,session,turn,status,updated,payload) VALUES(?,?,?,?,?,?,?)",params![id,row["client"].as_str(),row["session"].as_str(),row["turn"].as_str(),row["status"].as_str(),updated,serde_json::to_string(&row)?])?;
                } else if table == "conflicts" {
                    tx.execute("INSERT OR IGNORE INTO conflicts(id,status,updated,payload) VALUES(?,?,?,?)",params![id,row["status"].as_str(),updated,serde_json::to_string(&row)?])?;
                } else {
                    tx.execute(
                        "INSERT OR IGNORE INTO activities(id,updated,payload) VALUES(?,?,?)",
                        params![id, updated, serde_json::to_string(&row)?],
                    )?;
                }
            }
        }
        tx.commit()?;
        Ok(serde_json::json!({"imported":inserted.len(),"skipped":skipped}))
    }
}
