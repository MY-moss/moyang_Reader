use crate::store::{check_revision, persist, read_record, save_in, validate};
use crate::*;
use rusqlite::{params, OptionalExtension, Transaction, TransactionBehavior};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CheckpointRequest {
    pub client: String,
    pub session: String,
    /// Original user turn, unchanged for the one permitted hook continuation.
    pub turn: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub agent: String,
    #[serde(default)]
    pub request_followup: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub client: String,
    pub session: String,
    pub turn: String,
    pub project: String,
    pub agent: String,
    pub status: String,
    pub continuation_requested: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub reason: String,
    pub record_ids: Vec<String>,
    pub conflict_ids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DecisionAction {
    Save,
    Correct,
    Conflict,
    ImproveSkill,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct MemoryDecision {
    pub action: DecisionAction,
    pub record: SaveRequest,
    /// Quote or concrete task result; never an unsupported inference.
    pub evidence: String,
    #[serde(default)]
    pub explicit_correction: bool,
    /// success or failure for a skill improvement.
    #[serde(default)]
    pub outcome: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ConcludeRequest {
    pub checkpoint_id: String,
    pub reason: String,
    /// Empty when no durable information was learned. This still completes the checkpoint.
    pub decisions: Vec<MemoryDecision>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConflict {
    pub id: String,
    pub checkpoint_id: String,
    pub status: String,
    pub proposal: SaveRequest,
    pub evidence: String,
    pub updated_at: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: String,
    pub checkpoint_id: String,
    pub record_id: String,
    pub before_revision: Option<i64>,
    pub after_revision: i64,
    pub reason: String,
    pub evidence: String,
    pub outcome: String,
    pub updated_at: i64,
    pub undone_revision: Option<i64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ResolveConflictRequest {
    pub id: String,
    /// keep_existing, accept or save_copy.
    pub resolution: String,
    /// Required for accept; obtain the current revision first.
    #[serde(default)]
    pub expected_revision: Option<i64>,
    /// Optional edited merge body.
    #[serde(default)]
    pub body: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ActivityRequest {
    pub id: String,
    #[serde(default)]
    pub restore: bool,
}

fn read_payload<T: serde::de::DeserializeOwned>(
    conn: &rusqlite::Connection,
    table: &str,
    id: &str,
) -> Result<T> {
    let raw: Option<String> = conn
        .query_row(
            &format!("SELECT payload FROM {table} WHERE id=?"),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(serde_json::from_str(
        &raw.ok_or_else(|| invalid("活动或任务记录不存在。"))?,
    )?)
}
fn write_checkpoint(tx: &Transaction, c: &Checkpoint) -> Result<()> {
    tx.execute("INSERT INTO checkpoints(id,client,session,turn,status,updated,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated=excluded.updated,payload=excluded.payload",params![c.id,c.client,c.session,c.turn,c.status,c.updated_at,serde_json::to_string(c)?])?;
    Ok(())
}
fn write_conflict(tx: &Transaction, c: &MemoryConflict) -> Result<()> {
    tx.execute("INSERT INTO conflicts(id,status,updated,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated=excluded.updated,payload=excluded.payload",params![c.id,c.status,c.updated_at,serde_json::to_string(c)?])?;
    Ok(())
}
fn write_activity(tx: &Transaction, a: &Activity) -> Result<()> {
    tx.execute("INSERT INTO activities(id,updated,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,payload=excluded.payload",params![a.id,a.updated_at,serde_json::to_string(a)?])?;
    Ok(())
}
fn apply_decision(
    tx: &Transaction,
    q: SaveRequest,
    checkpoint: &str,
    evidence: &str,
    outcome: &str,
) -> Result<Record> {
    let before = if let Some(id) = &q.id {
        Some(read_record(tx, id)?)
    } else {
        let payload:Option<String>=tx.query_row("SELECT payload FROM records WHERE fingerprint=? AND state='active' AND (expires IS NULL OR expires>?) LIMIT 1",params![crate::store::fingerprint(&q.fields)?,now()],|r|r.get(0)).optional()?;
        payload
            .map(|s| serde_json::from_str::<Record>(&s))
            .transpose()?
    };
    let reason = q.reason.clone();
    let r = save_in(tx, q)?;
    if before.as_ref().is_none_or(|old| old.revision != r.revision) {
        write_activity(
            tx,
            &Activity {
                id: uuid::Uuid::new_v4().to_string(),
                checkpoint_id: checkpoint.into(),
                record_id: r.id.clone(),
                before_revision: before.map(|r| r.revision),
                after_revision: r.revision,
                reason,
                evidence: evidence.into(),
                outcome: outcome.into(),
                updated_at: now(),
                undone_revision: None,
            },
        )?;
    }
    Ok(r)
}
impl Store {
    pub fn checkpoint(&mut self, q: CheckpointRequest) -> Result<serde_json::Value> {
        if [&q.client, &q.session, &q.turn]
            .iter()
            .any(|s| s.trim().is_empty() || s.len() > 1000)
        {
            return Err(invalid("检查点需要客户端、会话和原始任务编号。"));
        }
        let id = crate::hex(Sha256::digest(serde_json::to_vec(&(
            &q.client, &q.session, &q.turn,
        ))?));
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let raw: Option<String> = tx
            .query_row("SELECT payload FROM checkpoints WHERE id=?", [&id], |r| {
                r.get(0)
            })
            .optional()?;
        let mut c = if let Some(raw) = raw {
            serde_json::from_str::<Checkpoint>(&raw)?
        } else {
            Checkpoint {
                id,
                client: q.client,
                session: q.session,
                turn: q.turn,
                project: q.project.clone(),
                agent: q.agent.clone(),
                status: "pending".into(),
                continuation_requested: false,
                created_at: now(),
                updated_at: now(),
                reason: String::new(),
                record_ids: vec![],
                conflict_ids: vec![],
            }
        };
        if c.project != q.project || c.agent != q.agent {
            return Err(invalid("同一个检查点的项目与 Agent 来源不能改变。"));
        }
        let should_continue =
            q.request_followup && c.status == "pending" && !c.continuation_requested;
        if should_continue {
            c.continuation_requested = true;
            c.updated_at = now();
        }
        write_checkpoint(&tx, &c)?;
        tx.commit()?;
        Ok(serde_json::json!({"checkpoint":c,"should_continue":should_continue}))
    }
    pub fn conclude(&mut self, mut q: ConcludeRequest) -> Result<Checkpoint> {
        if q.reason.trim().is_empty() || q.decisions.len() > 30 {
            return Err(invalid("请说明本轮沉淀或不保存的原因，每轮最多 30 项。"));
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut c: Checkpoint = read_payload(&tx, "checkpoints", &q.checkpoint_id)?;
        if c.status != "pending" {
            return Ok(c);
        }
        for d in &mut q.decisions {
            if d.evidence.trim().is_empty() {
                return Err(invalid("自动沉淀和技能改进需要具体来源证据。"));
            }
            let old = d
                .record
                .id
                .as_ref()
                .map(|id| read_record(&tx, id))
                .transpose()?;
            if let Some(old) = &old {
                if old.fields.sharing == Sharing::Legacy
                    && !old.fields.agent.is_empty()
                    && old.fields.agent != c.agent
                {
                    return Err(invalid(
                        "旧记录限定于产生它的 Agent，需在界面中显式调整共享范围。",
                    ));
                }
                if old.fields.project != d.record.fields.project
                    || old.fields.sharing != d.record.fields.sharing
                    || (old.fields.sharing == Sharing::Legacy
                        && old.fields.agent != d.record.fields.agent)
                {
                    return Err(invalid("更正不能扩大原记录的共享范围。"));
                }
                if old.fields.kind != d.record.fields.kind {
                    return Err(invalid("更正不能改变记录类型。"));
                }
                if d.record.fields.assets.is_empty() {
                    d.record.fields.assets = old.fields.assets.clone();
                }
            } else {
                if d.record.fields.sharing == Sharing::Legacy {
                    d.record.fields.sharing = if d.record.fields.project.is_empty() {
                        Sharing::Global
                    } else {
                        Sharing::Project
                    };
                }
                if d.record.fields.agent.is_empty() {
                    d.record.fields.agent = c.agent.clone();
                }
            }
            if !d.record.fields.project.is_empty() && d.record.fields.project != c.project {
                return Err(invalid("本轮检查点不能写入其他项目。"));
            }
            if d.record.fields.source.trim().is_empty() {
                d.record.fields.source = format!("{} / {} / {}", c.client, c.session, c.turn);
            }
            d.record.reason = q.reason.clone();
            validate(&mut d.record.fields)?;
            match d.action {
                DecisionAction::Save if old.is_some() => {
                    return Err(invalid("修改已有记忆请明确使用 correct 或 improve_skill。"))
                }
                DecisionAction::Correct | DecisionAction::Conflict if old.is_none() => {
                    return Err(invalid("更正或冲突需要原记录编号。"))
                }
                DecisionAction::ImproveSkill
                    if old.is_none()
                        || d.record.fields.kind != Kind::Skill
                        || !["success", "failure"].contains(&d.outcome.as_str()) =>
                {
                    return Err(invalid(
                        "技能改进需要原技能、任务证据和 success/failure 结果。",
                    ))
                }
                _ => {}
            }
            if matches!(d.action, DecisionAction::Conflict)
                || (matches!(d.action, DecisionAction::Correct) && !d.explicit_correction)
            {
                let conflict = MemoryConflict {
                    id: uuid::Uuid::new_v4().to_string(),
                    checkpoint_id: c.id.clone(),
                    status: "pending".into(),
                    proposal: d.record.clone(),
                    evidence: d.evidence.clone(),
                    updated_at: now(),
                };
                write_conflict(&tx, &conflict)?;
                c.conflict_ids.push(conflict.id);
            } else {
                let r = apply_decision(&tx, d.record.clone(), &c.id, &d.evidence, &d.outcome)?;
                c.record_ids.push(r.id);
            }
        }
        c.status = if q.decisions.is_empty() {
            "no_new_information"
        } else {
            "completed"
        }
        .into();
        c.reason = q.reason;
        c.updated_at = now();
        write_checkpoint(&tx, &c)?;
        tx.commit()?;
        Ok(c)
    }
    pub fn activity_feed(&self) -> Result<serde_json::Value> {
        let rows = |table: &str, filter: &str| -> Result<Vec<serde_json::Value>> {
            let mut stmt = self.conn.prepare(&format!(
                "SELECT payload FROM {table} {filter} ORDER BY updated DESC,id LIMIT 100"
            ))?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .map(|r| Ok(serde_json::from_str(&r?)?))
                .collect();
            rows
        };
        Ok(
            serde_json::json!({"checkpoints":rows("checkpoints","")?,"pending":rows("checkpoints","WHERE status='pending'")?,"conflicts":rows("conflicts","WHERE status='pending'")?,"activities":rows("activities","")?}),
        )
    }
    pub fn resolve_conflict(&mut self, q: ResolveConflictRequest) -> Result<MemoryConflict> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut c: MemoryConflict = read_payload(&tx, "conflicts", &q.id)?;
        if c.status != "pending" {
            return Ok(c);
        }
        match q.resolution.as_str() {
            "keep_existing" => {}
            "accept" | "save_copy" => {
                let mut request = c.proposal.clone();
                if let Some(body) = q.body {
                    request.fields.body = body;
                }
                if q.resolution == "save_copy" {
                    request.id = None;
                    request.expected_revision = None;
                } else {
                    request.expected_revision = q.expected_revision;
                }
                request.reason = "处理记忆冲突".into();
                validate(&mut request.fields)?;
                apply_decision(&tx, request, &c.checkpoint_id, &c.evidence, "")?;
            }
            _ => return Err(invalid("请选择保留原记忆、接受合并或另存副本。")),
        }
        c.status = q.resolution;
        c.updated_at = now();
        write_conflict(&tx, &c)?;
        tx.commit()?;
        Ok(c)
    }
    pub fn undo_activity(&mut self, q: ActivityRequest) -> Result<Activity> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut a: Activity = read_payload(&tx, "activities", &q.id)?;
        let mut current = read_record(&tx, &a.record_id)?;
        let target = if q.restore {
            let revision = a
                .undone_revision
                .ok_or_else(|| invalid("这项沉淀尚未撤回。"))?;
            check_revision(&current, Some(revision))?;
            Some(a.after_revision)
        } else {
            if a.undone_revision.is_some() {
                return Ok(a);
            }
            check_revision(&current, Some(a.after_revision))?;
            a.before_revision
        };
        if let Some(revision) = target {
            let raw: String = tx.query_row(
                "SELECT payload FROM revisions WHERE id=? AND revision=?",
                params![current.id, revision],
                |r| r.get(0),
            )?;
            let old: Record = serde_json::from_str(&raw)?;
            current.fields = old.fields;
            current.state = old.state;
        } else {
            current.state = RecordState::Archived;
        }
        current.revision += 1;
        current.updated_at = now();
        persist(
            &tx,
            &current,
            if q.restore {
                "恢复自动沉淀"
            } else {
                "撤回自动沉淀"
            },
        )?;
        if q.restore {
            a.undone_revision = None;
            a.after_revision = current.revision;
        } else {
            a.undone_revision = Some(current.revision);
        }
        a.updated_at = now();
        write_activity(&tx, &a)?;
        tx.commit()?;
        Ok(a)
    }
    pub fn revision_detail(&self, id: &str, revision: i64) -> Result<Revision> {
        let (raw, reason, recorded_at): (String, String, i64) = self.conn.query_row(
            "SELECT payload,reason,recorded FROM revisions WHERE id=? AND revision=?",
            params![id, revision],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        Ok(Revision {
            record: serde_json::from_str(&raw)?,
            reason,
            recorded_at,
        })
    }
}
