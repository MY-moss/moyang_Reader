use crate::*;
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::Duration,
};

pub struct Store {
    pub(crate) conn: Connection,
    pub(crate) path: PathBuf,
}
impl Store {
    pub fn open(directory: impl AsRef<Path>) -> Result<Self> {
        std::fs::create_dir_all(directory.as_ref())?;
        let path = directory.as_ref().join("ai-space.sqlite3");
        let mut conn = Connection::open(&path)?;
        conn.busy_timeout(Duration::from_secs(8))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version > 2 {
            return Err(invalid("数据库版本更新，请使用新版程序。"));
        }
        if version == 0 {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let locked_version: i64 = tx.query_row("PRAGMA user_version", [], |r| r.get(0))?;
            if locked_version == 0 {
                tx.execute_batch("
              CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT NOT NULL, project TEXT NOT NULL, agent TEXT NOT NULL, state TEXT NOT NULL, updated INTEGER NOT NULL, expires INTEGER, fingerprint TEXT NOT NULL, payload TEXT NOT NULL);
              CREATE INDEX IF NOT EXISTS records_scope ON records(kind, project, agent, state);
              CREATE INDEX IF NOT EXISTS records_fingerprint ON records(fingerprint);
              CREATE TABLE IF NOT EXISTS revisions(id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, reason TEXT NOT NULL, recorded INTEGER NOT NULL, PRIMARY KEY(id,revision), FOREIGN KEY(id) REFERENCES records(id) ON DELETE CASCADE);
              CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, entry_id TEXT NOT NULL, ordinal INTEGER NOT NULL, text TEXT NOT NULL, FOREIGN KEY(entry_id) REFERENCES records(id) ON DELETE CASCADE);
              CREATE INDEX IF NOT EXISTS chunks_entry ON chunks(entry_id);
              CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(entry_id UNINDEXED, chunk_id UNINDEXED, title, terms);
              CREATE TABLE IF NOT EXISTS embeddings(chunk_id INTEGER PRIMARY KEY, model TEXT NOT NULL, vector TEXT NOT NULL, FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE CASCADE);
              CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, score INTEGER NOT NULL, uses INTEGER NOT NULL, FOREIGN KEY(id) REFERENCES records(id) ON DELETE CASCADE);
              CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
              PRAGMA user_version=1;")?;
            }
            tx.commit()?;
        }
        crate::migration::upgrade(&mut conn, directory.as_ref(), version != 0)?;
        Ok(Self { conn, path })
    }
    pub fn get(&self, id: &str) -> Result<Record> {
        read_record(&self.conn, id)
    }
    pub fn save(&mut self, mut request: SaveRequest) -> Result<Record> {
        validate(&mut request.fields)?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let record = save_in(&tx, request)?;
        tx.commit()?;
        Ok(record)
    }
    pub fn change_state(&mut self, request: StateRequest) -> Result<Record> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut r = read_record(&tx, &request.id)?;
        check_revision(&r, Some(request.expected_revision))?;
        r.state = request.state;
        r.revision += 1;
        r.updated_at = now();
        persist(&tx, &r, "归档状态变更")?;
        tx.commit()?;
        Ok(r)
    }
    pub fn history(&self, id: &str) -> Result<Vec<Revision>> {
        self.get(id)?;
        let mut stmt = self.conn.prepare(
            "SELECT payload, reason, recorded FROM revisions WHERE id=? ORDER BY revision DESC",
        )?;
        let rows = stmt.query_map([id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
            ))
        })?;
        rows.map(|row| {
            let (p, reason, recorded_at) = row?;
            Ok(Revision {
                record: serde_json::from_str(&p)?,
                reason,
                recorded_at,
            })
        })
        .collect()
    }
    pub fn restore(&mut self, q: RestoreRequest) -> Result<Record> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current = read_record(&tx, &q.id)?;
        check_revision(&current, Some(q.expected_revision))?;
        let data: String = tx
            .query_row(
                "SELECT payload FROM revisions WHERE id=? AND revision=?",
                params![q.id, q.revision],
                |r| r.get(0),
            )
            .optional()?
            .ok_or_else(|| invalid("历史版本不存在。"))?;
        let mut old: Record = serde_json::from_str(&data)?;
        old.revision = current.revision + 1;
        old.updated_at = now();
        persist(&tx, &old, &format!("恢复版本 {}", q.revision))?;
        tx.commit()?;
        Ok(old)
    }
    pub fn delete(&mut self, id: &str, expected_revision: i64) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        check_revision(&read_record(&tx, id)?, Some(expected_revision))?;
        tx.execute("DELETE FROM chunks_fts WHERE entry_id=?", [id])?;
        tx.execute("DELETE FROM records WHERE id=?", [id])?;
        // Relations are IDs in immutable history. Missing links are displayed as unavailable.
        tx.commit()?;
        Ok(())
    }
    pub fn feedback(&self, q: FeedbackRequest) -> Result<()> {
        self.get(&q.id)?;
        self.conn.execute("INSERT INTO feedback(id,score,uses) VALUES(?1,?2,1) ON CONFLICT(id) DO UPDATE SET score=MAX(-10,MIN(10,score+?2)), uses=uses+1",params![q.id,if q.useful {1}else{-1}])?;
        Ok(())
    }
    pub fn asset(&self, q: AssetRequest) -> Result<Asset> {
        let r = self.get(&q.id)?;
        r.fields
            .assets
            .into_iter()
            .find(|a| a.path == q.path)
            .ok_or_else(|| invalid("技能资源不存在。"))
    }
    pub fn merge(&mut self, q: MergeRequest) -> Result<Record> {
        if q.ids.len() < 2
            || q.ids.len() > 20
            || q.ids.len() != q.revisions.len()
            || q.ids.iter().collect::<HashSet<_>>().len() != q.ids.len()
        {
            return Err(invalid("请选择 2–20 条不同记忆并提供当前版本。"));
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut records = Vec::new();
        for (id, version) in q.ids.iter().zip(q.revisions) {
            let r = read_record(&tx, id)?;
            check_revision(&r, Some(version))?;
            records.push(r);
        }
        let first = &records[0];
        if records.iter().any(|r| {
            r.fields.kind != Kind::Memory
                || r.state != RecordState::Active
                || r.fields.project != first.fields.project
                || r.fields.sharing != first.fields.sharing
                || (r.fields.sharing == Sharing::Legacy && r.fields.agent != first.fields.agent)
        }) {
            return Err(invalid("合并需要同一项目和 Agent 范围内的有效记忆。"));
        }
        let mut fields = first.fields.clone();
        fields.title = q.title;
        fields.body = q.body;
        fields.links = q.ids.clone();
        fields.source = format!("合并：{}", q.ids.join(", "));
        fields.summary = String::new();
        fields.tags = records.iter().flat_map(|r| r.fields.tags.clone()).collect();
        validate(&mut fields)?;
        let result = save_in(
            &tx,
            SaveRequest {
                id: None,
                expected_revision: None,
                reason: "合并记忆".into(),
                fields,
            },
        )?;
        if q.ids.contains(&result.id) {
            return Err(invalid("合并内容与原记忆完全相同，请整理为新的内容。"));
        }
        for mut r in records {
            r.state = RecordState::Archived;
            r.revision += 1;
            r.updated_at = now();
            persist(&tx, &r, &format!("合并至 {}", result.id))?;
        }
        tx.commit()?;
        Ok(result)
    }
}
pub(crate) fn read_record(conn: &Connection, id: &str) -> Result<Record> {
    let payload: Option<String> = conn
        .query_row("SELECT payload FROM records WHERE id=?", [id], |r| r.get(0))
        .optional()?;
    serde_json::from_str(&payload.ok_or_else(|| invalid("记录不存在，可能已被删除。"))?)
        .map_err(Into::into)
}
pub(crate) fn check_revision(r: &Record, expected: Option<i64>) -> Result<()> {
    if expected != Some(r.revision) {
        return Err(invalid(
            "记录已更新或缺少版本号。请重新读取后再保存，当前内容未被覆盖。",
        ));
    }
    Ok(())
}
pub(crate) fn fingerprint(f: &RecordFields) -> Result<String> {
    // Keep the legacy hash unchanged so migration preserves duplicate detection.
    let payload = if f.sharing == Sharing::Legacy {
        serde_json::to_vec(&(f.kind, &f.project, &f.agent, f.body.trim(), &f.assets))?
    } else {
        serde_json::to_vec(&(f.kind, &f.project, f.sharing, f.body.trim(), &f.assets))?
    };
    Ok(format!("{:x}", Sha256::digest(payload)))
}
pub(crate) fn save_in(tx: &Transaction, q: SaveRequest) -> Result<Record> {
    let (id, revision, created_at, state) = if let Some(id) = q.id {
        let old = read_record(tx, &id)?;
        check_revision(&old, q.expected_revision)?;
        if old.fields.kind != q.fields.kind {
            return Err(invalid("记录类型不可直接修改，请新建到目标分类。"));
        }
        (id, old.revision + 1, old.created_at, old.state)
    } else {
        let duplicate:Option<String>=tx.query_row("SELECT payload FROM records WHERE fingerprint=? AND state='active' AND (expires IS NULL OR expires>?) LIMIT 1",params![fingerprint(&q.fields)?,now()],|r|r.get(0)).optional()?;
        if let Some(payload) = duplicate {
            return Ok(serde_json::from_str(&payload)?);
        }
        (
            uuid::Uuid::new_v4().to_string(),
            1,
            now(),
            RecordState::Active,
        )
    };
    for linked in &q.fields.links {
        if linked != &id {
            read_record(tx, linked)?;
        }
    }
    let record = Record {
        id,
        revision,
        created_at,
        updated_at: now(),
        state,
        fields: q.fields,
    };
    persist(tx, &record, &q.reason)?;
    Ok(record)
}
pub(crate) fn persist(tx: &Transaction, r: &Record, reason: &str) -> Result<()> {
    let f = &r.fields;
    let payload = serde_json::to_string(r)?;
    tx.execute("INSERT INTO records(id,kind,project,agent,state,updated,expires,fingerprint,payload,sharing) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,project=excluded.project,agent=excluded.agent,state=excluded.state,updated=excluded.updated,expires=excluded.expires,fingerprint=excluded.fingerprint,payload=excluded.payload,sharing=excluded.sharing",params![r.id,f.kind.key(),f.project,f.agent,r.state.key(),r.updated_at,f.expires_at,fingerprint(f)?,payload,f.sharing.key()])?;
    tx.execute(
        "INSERT INTO revisions(id,revision,payload,reason,recorded) VALUES(?,?,?,?,?)",
        params![r.id, r.revision, payload, reason, now()],
    )?;
    tx.execute("DELETE FROM chunks_fts WHERE entry_id=?", [&r.id])?;
    let mut existing: std::collections::HashMap<String, Vec<i64>> =
        std::collections::HashMap::new();
    {
        let mut stmt =
            tx.prepare("SELECT id,text FROM chunks WHERE entry_id=? ORDER BY ordinal DESC")?;
        for row in stmt.query_map([&r.id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })? {
            let (id, text) = row?;
            existing.entry(text).or_default().push(id);
        }
    }
    for (ordinal, text) in crate::search::chunks(&f.body).into_iter().enumerate() {
        let chunk_id = if let Some(id) = existing.get_mut(&text).and_then(Vec::pop) {
            tx.execute(
                "UPDATE chunks SET ordinal=? WHERE id=?",
                params![ordinal as i64, id],
            )?;
            id
        } else {
            tx.execute(
                "INSERT INTO chunks(entry_id,ordinal,text) VALUES(?,?,?)",
                params![r.id, ordinal as i64, text],
            )?;
            tx.last_insert_rowid()
        };
        let terms = crate::search::tokens(&format!("{} {} {}", f.summary, f.tags.join(" "), text))
            .join(" ");
        tx.execute(
            "INSERT INTO chunks_fts(entry_id,chunk_id,title,terms) VALUES(?,?,?,?)",
            params![
                r.id,
                chunk_id,
                crate::search::tokens(&f.title).join(" "),
                terms
            ],
        )?;
    }
    for id in existing.into_values().flatten() {
        tx.execute("DELETE FROM chunks WHERE id=?", [id])?;
    }
    Ok(())
}
pub(crate) fn validate(f: &mut RecordFields) -> Result<()> {
    f.title = f.title.trim().into();
    f.project = f.project.trim().into();
    f.agent = f.agent.trim().into();
    if f.sharing == Sharing::Global && !f.project.is_empty() {
        return Err(invalid("全局共享内容不能指定项目，请选择项目范围。"));
    }
    if f.sharing == Sharing::Project && f.project.is_empty() {
        return Err(invalid("项目共享内容需要填写项目。"));
    }
    if f.title.is_empty() || f.title.chars().count() > 200 || f.body.trim().is_empty() {
        return Err(invalid("请填写标题和正文；标题不超过 200 字。"));
    }
    if f.body.len() > 4_000_000
        || f.summary.len() > 8000
        || f.project.len() > 200
        || f.agent.len() > 200
        || f.source.len() > 4000
    {
        return Err(invalid("内容超出单条大小，请拆分资料。"));
    }
    if !(1..=5).contains(&f.importance) {
        return Err(invalid("重要度应为 1–5。"));
    }
    f.tags = f
        .tags
        .iter()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();
    f.tags.sort();
    f.tags.dedup();
    if f.tags.len() > 50 || f.tags.iter().any(|t| t.len() > 120) || f.links.len() > 100 {
        return Err(invalid("标签或关联过多。"));
    }
    if f.kind == Kind::Memory
        && ![
            "",
            "preference",
            "fact",
            "context",
            "decision",
            "lesson",
            "procedure",
        ]
        .contains(&f.memory_type.as_str())
    {
        return Err(invalid("未知记忆类型。"));
    }
    if f.kind == Kind::Skill {
        let n = &f.title;
        if n.len() > 64
            || n.starts_with('-')
            || n.ends_with('-')
            || n.contains("--")
            || !n
                .chars()
                .all(|c| c.is_lowercase() || c.is_numeric() || c == '-')
            || f.summary.trim().is_empty()
            || f.summary.chars().count() > 1024
        {
            return Err(invalid("技能需要小写名称（字母、数字、短横线，最多 64 字符）和使用说明（最多 1024 字符）。"));
        }
    } else if !f.assets.is_empty() {
        return Err(invalid("只有技能可附带资源。"));
    }
    let mut names = HashSet::new();
    let mut size = 0;
    for a in &f.assets {
        if a.path.is_empty()
            || a.path.contains('\\')
            || a.path.contains(':')
            || a.path.starts_with('/')
            || a.path
                .split('/')
                .any(|p| p == ".." || p == "." || p.is_empty())
            || a.path.eq_ignore_ascii_case("SKILL.md")
            || !names.insert(a.path.to_lowercase())
            || !["utf8", "base64"].contains(&a.encoding.as_str())
        {
            return Err(invalid("技能资源路径或编码无效。"));
        }
        size += a.content.len();
    }
    if size > 25_000_000 || f.assets.len() > 200 {
        return Err(invalid("技能资源超过 25 MB 或 200 个文件。"));
    }
    Ok(())
}
