use crate::*;
use rusqlite::{params, OptionalExtension};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ContextLayer {
    L0,
    #[default]
    L1,
    L2,
    L3,
}
#[derive(Debug, Default, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ContextRead {
    pub id: String,
    #[serde(default)]
    pub layer: ContextLayer,
    /// Omit for current content. L3 without revision lists historical versions.
    pub revision: Option<i64>,
    /// L2 only: return metadata when the record revision is unchanged.
    pub if_revision: Option<i64>,
    /// Conditional read of any content layer, including generated overview and state.
    pub if_etag: Option<String>,
    /// Exact Markdown heading; duplicate headings require a line range instead.
    pub section: Option<String>,
    /// One-based inclusive line range of the selected body/section.
    pub start_line: Option<usize>,
    pub end_line: Option<usize>,
    /// Unicode character offset within the selected content; use the returned continuation.
    #[serde(default)]
    pub offset: usize,
    /// Continuations require this content fingerprint so a new overview cannot splice old text.
    pub expected_fingerprint: Option<String>,
    pub before_revision: Option<i64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ReadContextRequest {
    pub items: Vec<ContextRead>,
    /// Overall JSON response budget in Unicode characters, 1000–30000. Not billing tokens.
    pub max_chars: Option<usize>,
}
pub(crate) fn input_fingerprint(f: &RecordFields) -> String {
    hex(Sha256::digest(
        serde_json::to_vec(&json!([
            f.kind,
            f.title,
            f.body,
            f.summary,
            f.source,
            f.project,
            f.sharing,
            f.memory_type,
            f.expires_at
        ]))
        .unwrap(),
    ))
}
fn clip(text: &str, n: usize) -> String {
    text.chars().take(n).collect()
}
fn size(value: &Value) -> usize {
    value.to_string().chars().count()
}
pub(crate) fn projected_record(store: &Store, id: &str, revision: Option<i64>) -> Result<Record> {
    let raw: Option<String> = if let Some(revision) = revision {
        store.conn.query_row("SELECT json_remove(payload,'$.assets','$.snapshot.locations') FROM revisions WHERE id=? AND revision=?",params![id,revision],|r| r.get(0)).optional()?
    } else {
        store.conn.query_row("SELECT json_remove(payload,'$.assets','$.snapshot.locations') FROM records WHERE id=?",[id],|r| r.get(0)).optional()?
    };
    Ok(serde_json::from_str(
        &raw.ok_or_else(|| invalid("记录或版本不存在。"))?,
    )?)
}
fn headings(body: &str) -> Vec<(usize, usize, String)> {
    let mut fence: Option<(char, usize)> = None;
    let mut result = Vec::new();
    for (index, line) in body.lines().enumerate() {
        let trimmed = line.trim_start_matches(' ');
        if line.len() - trimmed.len() > 3 || trimmed.starts_with('\t') {
            continue;
        }
        let first = trimmed.chars().next().unwrap_or(' ');
        let run = trimmed.chars().take_while(|c| *c == first).count();
        if let Some((mark, length)) = fence {
            if first == mark && run >= length && trimmed[run..].trim().is_empty() {
                fence = None;
            }
            continue;
        }
        if matches!(first, '`' | '~') && run >= 3 {
            if first != '`' || !trimmed[run..].contains('`') {
                fence = Some((first, run));
            }
            continue;
        }
        if first == '#'
            && (1..=6).contains(&run)
            && trimmed.chars().nth(run).is_none_or(char::is_whitespace)
        {
            let title = trimmed[run..].trim();
            let without_closing = title.trim_end_matches('#');
            let title =
                if without_closing.is_empty() || without_closing.ends_with(char::is_whitespace) {
                    without_closing.trim_end()
                } else {
                    title
                };
            result.push((index, run, title.to_owned()));
        }
    }
    result
}
fn navigation(body: &str) -> Vec<Value> {
    headings(body)
        .into_iter()
        .map(|(index, _, title)| json!({"heading":clip(&title,80),"line":index+1}))
        .take(12)
        .collect()
}
pub(crate) fn select_text(body: &str, q: &ContextRead) -> Result<String> {
    let mut lines: Vec<&str> = body.split_inclusive('\n').collect();
    if lines.is_empty() {
        lines.push("");
    }
    if let Some(section) = &q.section {
        let headings = headings(body);
        let matches: Vec<_> = headings
            .iter()
            .filter(|(_, _, title)| title == section.trim())
            .map(|(i, depth, _)| (*i, *depth))
            .collect();
        if matches.len() != 1 {
            return Err(invalid("章节不存在或同名，请改用明确的行范围。"));
        }
        let (start, depth) = matches[0];
        let end = headings
            .iter()
            .find_map(|(i, d, _)| (*i > start && *d <= depth).then_some(*i))
            .unwrap_or(lines.len());
        lines = lines[start..end].to_vec();
    }
    let start = q.start_line.unwrap_or(1);
    let end = q.end_line.unwrap_or(lines.len());
    if start == 0 || start > lines.len() || end < start {
        return Err(invalid("正文行范围无效。"));
    }
    Ok(lines[start - 1..end.min(lines.len())].concat())
}
impl Store {
    pub fn read_context(&self, q: ReadContextRequest) -> Result<Value> {
        if q.items.is_empty() || q.items.len() > 20 {
            return Err(invalid("每次读取 1–20 条资料。"));
        }
        let budget = q.max_chars.unwrap_or(8000).clamp(1000, 30000);
        let mut result = json!({"items":[],"next_index":null,"max_chars":budget});
        for (index, item) in q.items.iter().enumerate() {
            let remaining = budget.saturating_sub(size(&result) + 80);
            if remaining < 350 {
                result["next_index"] = json!(index);
                break;
            }
            let value = match self.read_layer(item, remaining) {
                Ok(value) => value,
                Err(error) => json!({"id":clip(&item.id,100),"error":error.to_string()}),
            };
            if size(&result) + size(&value) + 2 > budget {
                result["next_index"] = json!(index);
                break;
            }
            result["items"].as_array_mut().unwrap().push(value);
            if result["items"]
                .as_array()
                .unwrap()
                .last()
                .unwrap()
                .get("continuation")
                .is_some()
                && index + 1 < q.items.len()
            {
                result["next_index"] = json!(index + 1);
                break;
            }
        }
        Ok(result)
    }
    pub(crate) fn read_layer(&self, q: &ContextRead, budget: usize) -> Result<Value> {
        if let Some(revision) = q
            .if_revision
            .filter(|_| q.layer == ContextLayer::L2 && q.offset == 0 && q.if_etag.is_none())
        {
            // Conditional reads project metadata in SQLite, never materializing body or resources.
            let table = if q.revision.is_some() {
                "revisions"
            } else {
                "records"
            };
            let raw:Option<String>=self.conn.query_row(&format!("SELECT CASE WHEN json_extract(payload,'$.revision')=?2 THEN json_object('id',id,'revision',?2,'kind',json_extract(payload,'$.kind'),'title',substr(json_extract(payload,'$.title'),1,140),'scope',json_object('project',json_extract(payload,'$.project'),'agent',json_extract(payload,'$.agent'),'sharing',COALESCE(json_extract(payload,'$.sharing'),'legacy')),'state',json_extract(payload,'$.state'),'expires_at',json_extract(payload,'$.expires_at')) END FROM {table} WHERE id=?1 AND (?3 IS NULL OR json_extract(payload,'$.revision')=?3)"),params![q.id,revision,q.revision],|r|r.get(0)).optional()?.flatten();
            if let Some(raw) = raw {
                let mut out: Value = serde_json::from_str(&raw)?;
                out["expired"] = json!(out["expires_at"].as_i64().is_some_and(|t| t <= now()));
                out.as_object_mut().unwrap().remove("expires_at");
                out["layer"] = json!(q.layer);
                out["unchanged"] = json!(true);
                return Ok(out);
            }
        }
        let r = projected_record(self, &q.id, q.revision)?;
        let f = &r.fields;
        let mut out = json!({"id":r.id,"revision":r.revision,"layer":q.layer,"kind":f.kind,"title":clip(&f.title,140),"scope":{"project":f.project,"agent":f.agent,"sharing":f.sharing},"state":r.state,"expired":f.expires_at.is_some_and(|t|t<=now())});
        if q.layer == ContextLayer::L3 && q.revision.is_none() {
            let mut history = self.history_page(HistoryRequest {
                id: q.id.clone(),
                before_revision: q.before_revision,
                limit: Some(10),
            })?;
            let had_items = !history.items.is_empty();
            out["history"] = serde_json::to_value(&history)?;
            while size(&out) > budget && !history.items.is_empty() {
                history.items.pop();
                history.next_before = history.items.last().map(|h| h.revision);
                out["history"] = serde_json::to_value(&history)?;
            }
            if had_items && history.items.is_empty() {
                return Err(invalid("预算不足以返回历史条目，请增加 max_chars。"));
            }
            return Ok(out);
        }
        out["source"] = json!(clip(&f.source, 240));
        let generated: Option<(String, String, String)> = self
            .conn
            .query_row(
                "SELECT input_fingerprint,overview,purpose FROM derived_context WHERE id=?",
                [&q.id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        let fresh = generated
            .as_ref()
            .is_some_and(|(key, _, _)| *key == input_fingerprint(f));
        let body = match q.layer {
            ContextLayer::L0 => {
                out["available_layers"] = json!(["l0", "l1", "l2", "l3"]);
                if !f.summary.is_empty() {
                    clip(&f.summary, 180)
                } else if fresh {
                    clip(&generated.as_ref().unwrap().2, 180)
                } else {
                    clip(&f.body, 180)
                }
            }
            ContextLayer::L1 => {
                out["overview_status"] = json!(if fresh {
                    "ready"
                } else if generated.is_some() {
                    "stale"
                } else {
                    "pending"
                });
                if f.body.chars().count() <= 1200 {
                    out["complete_body"] = json!(true);
                    f.body.clone()
                } else {
                    out["navigation"] = json!(navigation(&f.body));
                    if fresh {
                        generated.as_ref().unwrap().1.clone()
                    } else if !f.summary.is_empty() {
                        out["fallback"] = json!("human_summary");
                        f.summary.clone()
                    } else {
                        out["fallback"] = json!("original_excerpt");
                        clip(&f.body, 900)
                    }
                }
            }
            ContextLayer::L2 | ContextLayer::L3 => {
                out["historical"] = json!(q.revision.is_some());
                select_text(&f.body, q)?
            }
        };
        let fingerprint = hex(Sha256::digest(body.as_bytes()));
        // Metadata is part of the validator: pending -> ready, expiry and scope changes
        // matter even if the readable text itself happens to stay the same.
        let etag = hex(Sha256::digest(serde_json::to_vec(&json!([
            out,
            fingerprint
        ]))?));
        out["etag"] = json!(etag);
        if q.offset == 0 && q.if_etag.as_deref() == Some(&etag) {
            out["unchanged"] = json!(true);
            out.as_object_mut().unwrap().remove("navigation");
            return Ok(out);
        }
        if q.expected_fingerprint
            .as_ref()
            .is_some_and(|expected| expected != &fingerprint)
        {
            return Err(invalid("读取内容已变化，请从头重新读取当前层。"));
        }
        out["fingerprint"] = json!(fingerprint);
        let chars: Vec<char> = body.chars().collect();
        if q.offset > chars.len() {
            return Err(invalid("继续读取位置超出正文。"));
        }
        if size(&out) > budget / 2 {
            out.as_object_mut().unwrap().remove("navigation");
        }
        let mut end = (q.offset + budget.saturating_sub(size(&out) + 400)).min(chars.len());
        loop {
            out["content"] = json!(chars[q.offset..end].iter().collect::<String>());
            if end < chars.len() {
                let mut next = q.clone();
                next.revision = Some(r.revision);
                next.if_revision = None;
                next.if_etag = None;
                next.offset = end;
                next.expected_fingerprint = Some(fingerprint.clone());
                out["continuation"] = serde_json::to_value(next)?;
            } else {
                out.as_object_mut().unwrap().remove("continuation");
            }
            if size(&out) <= budget {
                break;
            }
            if end == q.offset {
                return Err(invalid("预算不足以返回资料元数据，请增加 max_chars。"));
            }
            end = q.offset + (end - q.offset) * 3 / 4;
        }
        if end == q.offset && end < chars.len() {
            return Err(invalid("预算不足以读取内容，请增加 max_chars。"));
        }
        Ok(out)
    }
}
