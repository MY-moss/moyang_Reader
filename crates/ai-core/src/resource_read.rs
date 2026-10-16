use crate::*;
use rusqlite::{params, OptionalExtension};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ResourceReadRequest {
    pub id: String,
    /// Omit to list resource metadata, then read the selected relative path.
    pub path: Option<String>,
    pub revision: Option<i64>,
    #[serde(default)]
    pub resource_offset: usize,
    pub start_line: Option<usize>,
    pub end_line: Option<usize>,
    #[serde(default)]
    pub offset: usize,
    pub include_binary: Option<bool>,
    pub expected_fingerprint: Option<String>,
    pub max_chars: Option<usize>,
}
impl Store {
    pub fn resource_context(&self, q: ResourceReadRequest) -> Result<Value> {
        let budget = q.max_chars.unwrap_or(6000).clamp(1000, 30000);
        let revision = q.revision.map(Ok).unwrap_or_else(|| {
            self.conn
                .query_row(
                    "SELECT MAX(revision) FROM revisions WHERE id=?",
                    [&q.id],
                    |r| r.get::<_, Option<i64>>(0),
                )
                .map_err(Error::from)
                .and_then(|r| r.ok_or_else(|| invalid("记录不存在。")))
        })?;
        let exists: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM revisions WHERE id=? AND revision=?)",
            params![q.id, revision],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(invalid("记录或版本不存在。"));
        }
        if q.resource_offset > 1000 {
            return Err(invalid("资源分页超出范围。"));
        }
        let Some(path) = &q.path else {
            let mut stmt=self.conn.prepare("SELECT json_extract(a.value,'$.path'),json_extract(a.value,'$.encoding'),length(json_extract(a.value,'$.content')) FROM revisions r,json_each(r.payload,'$.assets') a WHERE r.id=?1 AND r.revision=?2 ORDER BY a.key LIMIT 21 OFFSET ?3")?;
            let rows=stmt.query_map(params![q.id,revision,q.resource_offset as i64],|r|Ok(json!({"path":r.get::<_,String>(0)?,"encoding":r.get::<_,String>(1)?,"stored_chars":r.get::<_,i64>(2)?})))?.collect::<std::result::Result<Vec<_>,_>>()?;
            let mut out =
                json!({"id":q.id,"revision":revision,"resources":[],"next_resource_offset":null});
            for (i, row) in rows.into_iter().enumerate() {
                if i == 20
                    || out.to_string().chars().count() + row.to_string().chars().count() + 80
                        > budget
                {
                    out["next_resource_offset"] = json!(q.resource_offset + i);
                    break;
                }
                out["resources"].as_array_mut().unwrap().push(row);
            }
            return Ok(out);
        };
        let raw:Option<String>=self.conn.query_row("SELECT a.value FROM revisions r,json_each(r.payload,'$.assets') a WHERE r.id=?1 AND r.revision=?2 AND json_extract(a.value,'$.path')=?3",params![q.id,revision,path],|r|r.get(0)).optional()?;
        let a: Asset = serde_json::from_str(&raw.ok_or_else(|| invalid("技能资源不存在。"))?)?;
        let fingerprint = hex(Sha256::digest(a.content.as_bytes()));
        if q.expected_fingerprint
            .as_ref()
            .is_some_and(|f| f != &fingerprint)
        {
            return Err(invalid("资源已变化，请从头读取。"));
        }
        let mut out = json!({"id":q.id,"path":path,"revision":revision,"encoding":a.encoding,"fingerprint":fingerprint});
        if a.encoding == "base64" && q.include_binary != Some(true) {
            out["stored_chars"] = json!(a.content.len());
            out["read_with"] =
                json!({"id":q.id,"path":path,"revision":revision,"include_binary":true});
            return Ok(out);
        }
        if a.encoding == "base64"
            && (q.start_line.is_some() || q.end_line.is_some() || q.offset % 4 != 0)
        {
            return Err(invalid("二进制资源不支持行范围，续读请使用返回的位置。"));
        }
        let body = if a.encoding == "utf8" {
            crate::layers::select_text(
                &a.content,
                &ContextRead {
                    start_line: q.start_line,
                    end_line: q.end_line,
                    ..Default::default()
                },
            )?
        } else {
            a.content
        };
        let chars: Vec<_> = body.chars().collect();
        if q.offset > chars.len() {
            return Err(invalid("资源位置超出范围。"));
        }
        let mut end = (q.offset + budget.saturating_sub(out.to_string().chars().count() + 450))
            .min(chars.len());
        if a.encoding == "base64" && end < chars.len() {
            end -= end % 4;
        }
        loop {
            out["content"] = json!(chars[q.offset..end].iter().collect::<String>());
            if end < chars.len() {
                let mut next = q.clone();
                next.revision = Some(revision);
                next.offset = end;
                next.expected_fingerprint = Some(fingerprint.clone());
                out["continuation"] = serde_json::to_value(next)?;
            } else {
                out.as_object_mut().unwrap().remove("continuation");
            }
            if out.to_string().chars().count() <= budget {
                break;
            }
            if end == q.offset {
                return Err(invalid("预算不足，请增加 max_chars。"));
            }
            end = q.offset + (end - q.offset) * 3 / 4;
            if a.encoding == "base64" {
                end -= end % 4;
            }
        }
        if end == q.offset && end < chars.len() {
            return Err(invalid("预算不足以读取内容。"));
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resources_are_progressive_and_binary_bytes_are_opt_in() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let r=s.save(serde_json::from_value(json!({"kind":"skill","title":"reference","summary":"参考","body":"步骤","assets":[{"path":"ref.md","encoding":"utf8","content":"第一行\n第二行\n第三行"},{"path":"pic.bin","encoding":"base64","content":"AQID"}]})).unwrap()).unwrap();
        let query = |p: Value| serde_json::from_value::<ResourceReadRequest>(p).unwrap();
        let list = s.resource_context(query(json!({"id":r.id}))).unwrap();
        assert_eq!(list["resources"].as_array().unwrap().len(), 2);
        assert!(!list.to_string().contains("AQID"));
        assert!(s
            .resource_context(query(json!({"id":r.id,"revision":999})))
            .is_err());
        let text = s
            .resource_context(query(
                json!({"id":r.id,"path":"ref.md","start_line":2,"end_line":2}),
            ))
            .unwrap();
        assert_eq!(text["content"], "第二行\n");
        let binary = s
            .resource_context(query(json!({"id":r.id,"path":"pic.bin"})))
            .unwrap();
        assert!(binary.get("content").is_none());
        assert_eq!(
            s.resource_context(query(binary["read_with"].clone()))
                .unwrap()["content"],
            "AQID"
        );
    }
}
