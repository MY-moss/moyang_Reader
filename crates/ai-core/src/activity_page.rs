use crate::*;
use rusqlite::named_params;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Default, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ActivityPageRequest {
    pub project: Option<String>,
    #[serde(default)]
    pub include_global: bool,
    #[serde(default)]
    pub offset: usize,
    pub limit: Option<usize>,
}

impl Store {
    /// Summary-only projections. Pending checkpoints are not repeated in completed history.
    pub fn activity_page(&self, q: ActivityPageRequest) -> Result<Value> {
        if q.offset > 100_000 {
            return Err(invalid("活动分页超出范围。"));
        }
        let limit = q.limit.unwrap_or(20).clamp(1, 50);
        let mut out = json!({"offset":q.offset,"limit":limit,"has_more":false});
        for (name, table, predicate, project, projection) in [
            ("checkpoints", "checkpoints e", "e.status!='pending'", "json_extract(e.payload,'$.project')", "json_object('id',e.id,'client',json_extract(e.payload,'$.client'),'turn',substr(json_extract(e.payload,'$.turn'),1,100),'status',e.status,'updated_at',e.updated,'reason',substr(json_extract(e.payload,'$.reason'),1,300))"),
            ("pending", "checkpoints e", "e.status='pending'", "json_extract(e.payload,'$.project')", "json_object('id',e.id,'client',json_extract(e.payload,'$.client'),'turn',substr(json_extract(e.payload,'$.turn'),1,100),'status',e.status,'updated_at',e.updated)"),
            ("conflicts", "conflicts e", "e.status='pending'", "json_extract(e.payload,'$.proposal.project')", "json_object('id',e.id,'title',json_extract(e.payload,'$.proposal.title'),'updated_at',e.updated)"),
            ("activities", "activities e LEFT JOIN checkpoints c ON c.id=json_extract(e.payload,'$.checkpoint_id') LEFT JOIN records r ON r.id=json_extract(e.payload,'$.record_id')", "1", "COALESCE(json_extract(c.payload,'$.project'),r.project,'')", "json_object('id',e.id,'record_id',json_extract(e.payload,'$.record_id'),'reason',substr(json_extract(e.payload,'$.reason'),1,300),'evidence',substr(json_extract(e.payload,'$.evidence'),1,350),'outcome',json_extract(e.payload,'$.outcome'),'updated_at',e.updated,'undone_revision',json_extract(e.payload,'$.undone_revision'))"),
        ] {
            let filter = format!("{predicate} AND (:project IS NULL OR {project}=:project OR (:global AND {project}=''))");
            let mut stmt = self.conn.prepare(&format!("SELECT {projection} FROM {table} WHERE {filter} ORDER BY e.updated DESC,e.id LIMIT :limit OFFSET :offset"))?;
            let mut items = stmt.query_map(named_params!{":project":q.project,":global":q.include_global,":limit":limit as i64+1,":offset":q.offset as i64}, |r| r.get::<_,String>(0))?
                .map(|r| Ok(serde_json::from_str::<Value>(&r?)?)).collect::<Result<Vec<_>>>()?;
            if items.len() > limit { out["has_more"] = json!(true); items.truncate(limit); }
            out[name] = json!(items);
        }
        Ok(out)
    }
    pub fn conflict_detail(&self, id: &str) -> Result<Value> {
        let raw: String = self.conn.query_row(
            "SELECT json_remove(payload,'$.proposal.assets') FROM conflicts WHERE id=?",
            [id],
            |r| r.get(0),
        )?;
        Ok(serde_json::from_str(&raw)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn activity_pages_keep_scope_and_never_load_proposal_bodies() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(dir.path()).unwrap();
        for (turn, project) in [("1", "甲"), ("2", "乙"), ("3", "甲")] {
            let r = store
                .save(
                    serde_json::from_value(
                        json!({"kind":"memory","title":"偏好","body":"旧正文","project":project}),
                    )
                    .unwrap(),
                )
                .unwrap();
            let c = store
                .checkpoint(
                    serde_json::from_value(
                        json!({"client":"test","session":"one","turn":turn,"project":project}),
                    )
                    .unwrap(),
                )
                .unwrap();
            store.conclude(serde_json::from_value(json!({"checkpoint_id":c["checkpoint"]["id"],"reason":"待确认","decisions":[{"action":"conflict","evidence":"依据","record":{"id":r.id,"expected_revision":r.revision,"kind":"memory","title":"偏好","body":"不应提前加载的正文","project":project}}]})).unwrap()).unwrap();
        }
        let first = store
            .activity_page(serde_json::from_value(json!({"project":"甲","limit":1})).unwrap())
            .unwrap();
        assert_eq!(first["conflicts"].as_array().unwrap().len(), 1);
        assert_eq!(first["has_more"], true);
        assert_eq!(first["pending"], json!([]));
        assert!(!first.to_string().contains("不应提前加载"));
        let detail = store
            .conflict_detail(first["conflicts"][0]["id"].as_str().unwrap())
            .unwrap();
        assert_eq!(detail["proposal"]["body"], "不应提前加载的正文");
        let next = store
            .activity_page(
                serde_json::from_value(json!({"project":"甲","offset":1,"limit":1})).unwrap(),
            )
            .unwrap();
        assert_ne!(first["conflicts"][0]["id"], next["conflicts"][0]["id"]);
        assert_eq!(next["has_more"], false);
    }
}
