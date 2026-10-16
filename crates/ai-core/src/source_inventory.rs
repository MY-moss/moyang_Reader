use crate::*;
use rusqlite::named_params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, schemars::JsonSchema)]
pub struct SourceInventoryQuery {
    /// Omit for all projects; empty string selects only global imported knowledge.
    pub project: Option<String>,
    /// Filter legacy Agent-private entries; shared entries remain visible.
    pub agent: Option<String>,
    /// Include global sources together with the selected project. Defaults to false.
    #[serde(default)]
    pub include_global: bool,
    pub cursor: Option<String>,
    /// Metadata page size, 1-100. Pass next_cursor unchanged to continue.
    pub limit: Option<usize>,
}
#[derive(Debug, Serialize)]
pub struct SourceEntry {
    pub id: String,
    pub title: String,
    pub project: String,
    pub agent: String,
    pub sharing: String,
    pub revision: i64,
    pub uri: String,
    pub format: String,
    pub fingerprint: String,
    pub imported_at: i64,
}
#[derive(Debug, Serialize)]
pub struct SourceInventory {
    pub items: Vec<SourceEntry>,
    pub total: usize,
    pub next_cursor: Option<String>,
}
impl Store {
    pub fn source_inventory(&self, q: SourceInventoryQuery) -> Result<SourceInventory> {
        let limit = q.limit.unwrap_or(50).clamp(1, 100);
        let tx = self.conn.unchecked_transaction()?;
        let filter = "kind='knowledge' AND state='active' AND COALESCE(json_extract(payload,'$.snapshot.uri'),'')!='' AND (:project IS NULL OR project=:project OR (:global AND project='')) AND (sharing!='legacy' OR :agent IS NULL OR agent=:agent OR (:global AND agent=''))";
        let total = tx.query_row(
            &format!("SELECT count(*) FROM records WHERE {filter}"),
            named_params! {":project":q.project,":global":q.include_global,":agent":q.agent},
            |r| r.get::<_, i64>(0),
        )?;
        // Metadata only: inspecting a library must not deserialize bodies, assets or history.
        let mut stmt = tx.prepare(&format!("SELECT id,json_extract(payload,'$.title'),project,json_extract(payload,'$.revision'),json_extract(payload,'$.snapshot.uri'),json_extract(payload,'$.snapshot.format'),json_extract(payload,'$.snapshot.fingerprint'),json_extract(payload,'$.snapshot.imported_at'),agent,sharing FROM records WHERE {filter} AND (:cursor IS NULL OR id>:cursor) ORDER BY id LIMIT :limit"))?;
        let mut items = stmt.query_map(
            named_params! {":project":q.project,":global":q.include_global,":agent":q.agent,":cursor":q.cursor,":limit":(limit+1) as i64},
            |r| Ok(SourceEntry {id:r.get(0)?,title:r.get(1)?,project:r.get(2)?,revision:r.get(3)?,uri:r.get(4)?,format:r.get(5)?,fingerprint:r.get(6)?,imported_at:r.get(7)?,agent:r.get(8)?,sharing:r.get(9)?}),
        )?.collect::<std::result::Result<Vec<_>,_>>()?;
        let next_cursor = if items.len() > limit {
            items.truncate(limit);
            items.last().map(|r| r.id.clone())
        } else {
            None
        };
        drop(stmt);
        tx.commit()?;
        Ok(SourceInventory {
            items,
            total: total as usize,
            next_cursor,
        })
    }
}
