use crate::*;
use rusqlite::named_params;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HealthIssue {
    Duplicate,
    Expired,
    MissingSource,
    BrokenLinks,
}
impl HealthIssue {
    fn key(self) -> &'static str {
        match self {
            Self::Duplicate => "duplicate",
            Self::Expired => "expired",
            Self::MissingSource => "missing_source",
            Self::BrokenLinks => "broken_links",
        }
    }
}
#[derive(Debug, Default, Deserialize, JsonSchema)]
pub struct HealthQuery {
    /// Omit for all projects; empty string means global entries only.
    pub project: Option<String>,
    pub agent: Option<String>,
    /// Include global entries alongside a specific project. Defaults to false.
    #[serde(default)]
    pub include_global: bool,
    pub kind: Option<Kind>,
    pub issue: Option<HealthIssue>,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}
#[derive(Debug, Clone, Serialize)]
pub struct HealthPeer {
    pub id: String,
    pub title: String,
}
#[derive(Debug, Serialize)]
pub struct HealthItem {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub project: String,
    pub agent: String,
    pub sharing: String,
    pub revision: i64,
    pub expires_at: Option<i64>,
    pub source: String,
    pub excerpt: String,
    pub issues: Vec<HealthIssue>,
    /// Includes this entry. Only the first three other entries are previewed below.
    pub duplicate_count: usize,
    pub duplicate_peers: Vec<HealthPeer>,
    pub broken_link_ids: Vec<String>,
}
#[derive(Debug, Serialize)]
pub struct HealthReport {
    pub checked_at: i64,
    pub scanned: usize,
    pub counts: BTreeMap<String, usize>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub items: Vec<HealthItem>,
}
impl Store {
    pub fn health(&self, q: HealthQuery) -> Result<HealthReport> {
        let time = now();
        let limit = q.limit.unwrap_or(30).clamp(1, 100);
        let offset = q.offset.unwrap_or(0);
        let tx = self.conn.unchecked_transaction()?;
        // Select metadata/body only, never deserialize resources or historical revisions.
        // The single read snapshot also keeps dangling-link checks consistent with the rows.
        let mut stmt = tx.prepare("SELECT e.id,e.kind,e.project,e.agent,e.sharing,json_extract(e.payload,'$.title'),json_extract(e.payload,'$.revision'),e.expires,json_extract(e.payload,'$.body'),json_extract(e.payload,'$.source'),json_extract(e.payload,'$.snapshot.uri'),(SELECT json_group_array(l.value) FROM json_each(e.payload,'$.links') l WHERE NOT EXISTS(SELECT 1 FROM records target WHERE target.id=l.value)) FROM records e WHERE e.state='active' AND (:kind IS NULL OR e.kind=:kind) AND (:project IS NULL OR e.project=:project OR (:global AND e.project='')) AND (e.sharing!='legacy' OR :agent IS NULL OR e.agent=:agent OR (:global AND e.agent='')) ORDER BY e.updated DESC,e.id")?;
        let rows = stmt.query_map(named_params! {":kind":q.kind.map(Kind::key),":project":q.project,":agent":q.agent,":global":q.include_global}, |row| {
            Ok((HealthItem {
                id: row.get(0)?, kind: row.get(1)?, project: row.get(2)?, agent: row.get(3)?, sharing: row.get(4)?, title: row.get(5)?, revision: row.get(6)?, expires_at: row.get(7)?,
                source: row.get::<_, Option<String>>(9)?.unwrap_or_default(), excerpt: String::new(), issues: Vec::new(), duplicate_count: 0, duplicate_peers: Vec::new(), broken_link_ids: Vec::new(),
            }, row.get::<_, String>(8)?, row.get::<_, Option<String>>(10)?.unwrap_or_default(), row.get::<_, String>(11)?))
        })?;
        let mut items = Vec::new();
        let mut groups = HashMap::<(String, String, String, String, String), Vec<usize>>::new();
        for row in rows {
            let (mut item, body, snapshot_uri, broken) = row?;
            item.broken_link_ids = serde_json::from_str(&broken)?;
            if item.expires_at.is_some_and(|t| t <= time) {
                item.issues.push(HealthIssue::Expired);
            }
            if item.source.trim().is_empty() && snapshot_uri.trim().is_empty() {
                item.issues.push(HealthIssue::MissingSource);
            }
            if !item.broken_link_ids.is_empty() {
                item.issues.push(HealthIssue::BrokenLinks);
            }
            // Only normalize line endings and outer whitespace. Code/Markdown indentation and
            // meaningful punctuation must not turn different instructions into equal content.
            let normalized = body.replace("\r\n", "\n");
            if !normalized.trim().is_empty() {
                let group = (
                    item.kind.clone(),
                    item.project.clone(),
                    item.sharing.clone(),
                    if item.sharing == "legacy" {
                        item.agent.clone()
                    } else {
                        String::new()
                    },
                    hex(Sha256::digest(normalized.trim().as_bytes())),
                );
                groups.entry(group).or_default().push(items.len());
            }
            item.excerpt = body.chars().take(180).collect();
            item.source = if item.source.trim().is_empty() {
                snapshot_uri
            } else {
                item.source
            };
            item.source = item.source.chars().take(240).collect();
            items.push(item);
        }
        for group in groups.values().filter(|g| g.len() > 1) {
            for &index in group {
                let peers = group
                    .iter()
                    .filter(|&&i| i != index)
                    .take(3)
                    .map(|&i| HealthPeer {
                        id: items[i].id.clone(),
                        title: items[i].title.clone(),
                    })
                    .collect();
                items[index].issues.push(HealthIssue::Duplicate);
                items[index].duplicate_count = group.len();
                items[index].duplicate_peers = peers;
            }
        }
        let scanned = items.len();
        let mut counts: BTreeMap<String, usize> =
            ["duplicate", "expired", "missing_source", "broken_links"]
                .into_iter()
                .map(|k| (k.into(), 0))
                .collect();
        for item in &items {
            for issue in &item.issues {
                *counts.get_mut(issue.key()).unwrap() += 1;
            }
        }
        items.retain(|item| {
            !item.issues.is_empty() && q.issue.is_none_or(|issue| item.issues.contains(&issue))
        });
        let total = items.len();
        Ok(HealthReport {
            checked_at: time,
            scanned,
            counts,
            total,
            offset,
            limit,
            items: items.into_iter().skip(offset).take(limit).collect(),
        })
    }
}
