use crate::*;
use rusqlite::{named_params, OptionalExtension};
use std::collections::HashSet;

fn is_cjk(c: char) -> bool {
    matches!(c as u32,0x3400..=0x9fff | 0xf900..=0xfaff | 0x3040..=0x30ff | 0xac00..=0xd7af)
}
pub(crate) fn tokens(text: &str) -> Vec<String> {
    tokenize(text, false)
}
fn tokenize(text: &str, query: bool) -> Vec<String> {
    let mut result = Vec::new();
    let mut word = String::new();
    let mut run = Vec::new();
    let flush = |run: &mut Vec<char>, result: &mut Vec<String>| {
        if !query || run.len() == 1 {
            result.extend(run.iter().map(char::to_string));
        }
        result.extend(run.windows(2).map(|w| w.iter().collect::<String>()));
        run.clear();
    };
    for c in text.to_lowercase().chars() {
        if is_cjk(c) {
            if !word.is_empty() {
                result.push(std::mem::take(&mut word));
            }
            run.push(c);
        } else {
            flush(&mut run, &mut result);
            if c.is_alphanumeric() {
                word.push(c);
            } else if !word.is_empty() {
                result.push(std::mem::take(&mut word));
            }
        }
    }
    flush(&mut run, &mut result);
    if !word.is_empty() {
        result.push(word);
    }
    result
}
pub(crate) fn coverage(query: &str, hit: &Hit) -> f64 {
    let terms: HashSet<_> = tokenize(query, true).into_iter().collect();
    if terms.is_empty() {
        return 0.0;
    }
    let content = format!(
        "{} {} {} {}",
        hit.title,
        hit.summary,
        hit.tags.join(" "),
        hit.fragments
            .iter()
            .map(|f| f.text.as_str())
            .collect::<Vec<_>>()
            .join(" ")
    );
    let indexed: HashSet<_> = tokens(&content).into_iter().collect();
    terms.iter().filter(|t| indexed.contains(*t)).count() as f64 / terms.len() as f64
}
pub(crate) fn title_anchor(terms: &HashSet<String>, hit: &Hit) -> bool {
    title_anchor_text(terms, &hit.title)
}
pub(crate) fn title_anchor_text(terms: &HashSet<String>, title: &str) -> bool {
    let title: HashSet<_> = tokenize(title, true).into_iter().collect();
    terms.iter().any(|term| title.contains(term))
}
pub(crate) fn chunks(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut start = 0;
    while start < chars.len() {
        let mut end = (start + 1400).min(chars.len());
        if end < chars.len() {
            if let Some(pos) = (start + 800..end).rev().find(|&i| chars[i] == '\n') {
                end = pos + 1;
            }
        }
        out.push(chars[start..end].iter().collect());
        if end == chars.len() {
            break;
        }
        start = end.saturating_sub(120).max(start + 1);
    }
    out
}
pub(crate) fn allowed(r: &Record, q: &SearchQuery) -> bool {
    r.state == q.state
        && (q.include_expired || r.fields.expires_at.is_none_or(|t| t > now()))
        && q.kind.is_none_or(|k| k == r.fields.kind)
        && q.project.as_ref().is_none_or(|p| {
            p == &r.fields.project || (q.include_global && r.fields.project.is_empty())
        })
        && (r.fields.sharing != Sharing::Legacy
            || q.agent.as_ref().is_none_or(|a| {
                a == &r.fields.agent || (q.include_global && r.fields.agent.is_empty())
            }))
}
pub(crate) const FILTER:&str="e.state=:state AND (:kind IS NULL OR e.kind=:kind) AND (:project IS NULL OR e.project=:project OR (:global AND e.project='')) AND (e.sharing!='legacy' OR :agent IS NULL OR e.agent=:agent OR (:global AND e.agent='')) AND (:expired OR e.expires IS NULL OR e.expires>:now)";
impl Store {
    pub(crate) fn distinctive_title_terms(&self, query: &str) -> Result<HashSet<String>> {
        let records: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM records", [], |r| r.get(0))?;
        let threshold = (records as f64).sqrt().ceil().max(2.0) as i64;
        let mut result = HashSet::new();
        for term in tokenize(query, true)
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .take(64)
        {
            let expression = format!("title : \"{}\"", term.replace('"', ""));
            let count: i64 = self.conn.query_row(
                "SELECT COUNT(DISTINCT entry_id) FROM chunks_fts WHERE chunks_fts MATCH ?",
                [expression],
                |r| r.get(0),
            )?;
            if count > 0 && count <= threshold {
                result.insert(term);
            }
        }
        Ok(result)
    }
    pub fn search(&self, q: &SearchQuery) -> Result<SearchResult> {
        crate::cancellation::check_cancelled(q.request_id.as_deref())?;
        if q.query.chars().count() > 1000 || q.limit > 100 || q.offset > 100000 {
            return Err(invalid("查询过长或分页超出范围。"));
        }
        if q.semantic && !q.query.trim().is_empty() {
            return self.hybrid(q);
        }
        self.lexical(q)
    }
    pub(crate) fn lexical(&self, q: &SearchQuery) -> Result<SearchResult> {
        let terms = tokenize(&q.query, true);
        let mut seen = HashSet::new();
        let query = terms
            .iter()
            .filter(|t| seen.insert(t.as_str()))
            .take(64)
            .map(|t| format!("\"{}\"", t.replace('"', "")))
            .collect::<Vec<_>>()
            .join(" OR ");
        let use_fts = !query.is_empty();
        if !q.query.trim().is_empty() && !use_fts {
            return Ok(SearchResult {
                items: vec![],
                total: 0,
                warning: None,
            });
        }
        let kind = q.kind.map(Kind::key);
        let state = q.state.key();
        let time = now();
        let base = if use_fts {
            format!("WITH matches AS MATERIALIZED (SELECT chunks_fts.entry_id, chunks_fts.chunk_id, bm25(chunks_fts,0,0,5,1) AS rank FROM chunks_fts JOIN records e ON e.id=chunks_fts.entry_id WHERE chunks_fts MATCH :query AND {FILTER}), best AS (SELECT entry_id,MIN(rank) AS rank FROM matches GROUP BY entry_id) ")
        } else {
            String::new()
        };
        let count_sql = if use_fts {
            format!("{base}SELECT COUNT(*) FROM best")
        } else {
            format!("SELECT COUNT(*) FROM records e WHERE {FILTER} AND :query=:query")
        };
        let bind = named_params! {":query":query,":state":state,":kind":kind,":project":q.project,":agent":q.agent,":global":q.include_global,":expired":q.include_expired,":now":time};
        let total: i64 = self.conn.query_row(&count_sql, bind, |r| r.get(0))?;
        let sql = if use_fts {
            format!("{base}SELECT e.payload,(SELECT c.text FROM matches m JOIN chunks c ON c.id=m.chunk_id WHERE m.entry_id=e.id ORDER BY m.rank LIMIT 1), best.rank*(1+0.05*json_extract(e.payload,'$.importance')+0.3*json_extract(e.payload,'$.pinned')+0.02*COALESCE(f.score,0)) AS rank FROM best JOIN records e ON e.id=best.entry_id LEFT JOIN feedback f ON f.id=e.id ORDER BY rank,e.updated DESC,e.id LIMIT :limit OFFSET :offset")
        } else {
            format!("SELECT e.payload,substr(json_extract(e.payload,'$.body'),1,400),0 FROM records e WHERE {FILTER} AND :query=:query ORDER BY json_extract(e.payload,'$.pinned') DESC,e.updated DESC,e.id LIMIT :limit OFFSET :offset")
        };
        let mut stmt = self.conn.prepare(&sql)?;
        let rows=stmt.query_map(named_params!{":query":query,":state":state,":kind":kind,":project":q.project,":agent":q.agent,":global":q.include_global,":expired":q.include_expired,":now":time,":limit":q.limit.max(1) as i64,":offset":q.offset as i64},|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,f64>(2)?)))?;
        let mut items = Vec::new();
        for row in rows {
            let (payload, excerpt, score) = row?;
            let r: Record = serde_json::from_str(&payload)?;
            let mut hit = Hit::from_record(&r, excerpt, -score);
            if use_fts {
                let mut fragments = self.conn.prepare("SELECT c.ordinal,c.text,bm25(chunks_fts,0,0,5,1) FROM chunks_fts JOIN chunks c ON c.id=chunks_fts.chunk_id WHERE chunks_fts MATCH ?1 AND chunks_fts.entry_id=?2 ORDER BY bm25(chunks_fts,0,0,5,1) LIMIT 4")?;
                for row in fragments.query_map(rusqlite::params![query, r.id], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, f64>(2)?,
                    ))
                })? {
                    let (ordinal, text, rank) = row?;
                    hit.fragments
                        .push(fragment(&r, ordinal as usize, text, -rank));
                }
            }
            items.push(hit);
        }
        Ok(SearchResult {
            items,
            total: total as usize,
            warning: None,
        })
    }
    pub fn context(&self, q: ContextRequest) -> Result<serde_json::Value> {
        let budget = q.max_chars.unwrap_or(8000).clamp(1000, 30000);
        let search = self.search(&SearchQuery {
            query: q.query,
            project: q.project.clone(),
            agent: q.agent.clone(),
            semantic: true,
            limit: 30,
            ..Default::default()
        })?;
        // A few explicitly pinned preferences form stable session context even when the task's words differ.
        let pinned = self.lexical(&SearchQuery {
            kind: Some(Kind::Memory),
            project: q.project,
            agent: q.agent,
            limit: 4,
            ..Default::default()
        })?;
        let mut combined: Vec<Hit> = pinned.items.into_iter().filter(|h| h.pinned).collect();
        let pinned_ids: HashSet<String> = combined.iter().map(|h| h.id.clone()).collect();
        combined.extend(
            search
                .items
                .into_iter()
                .filter(|h| !pinned_ids.contains(&h.id)),
        );
        let mut text = String::new();
        let mut ids = Vec::new();
        let mut truncated = false;
        for hit in combined {
            let content = if hit.kind == Kind::Skill {
                format!("技能摘要：{}\n使用 get_record 读取完整步骤。", hit.summary)
            } else {
                if hit.fragments.is_empty() {
                    hit.excerpt
                } else {
                    hit.fragments
                        .iter()
                        .map(|f| {
                            format!(
                                "[片段 {}{}] {}",
                                f.ordinal + 1,
                                f.location
                                    .page
                                    .map(|p| format!(" · 第 {p} 页"))
                                    .unwrap_or_default(),
                                f.text
                            )
                        })
                        .collect::<Vec<_>>()
                        .join("\n\n")
                }
            };
            let section = format!(
                "\n[{}] {} · {}\n来源：{}\n{}\n",
                hit.id,
                hit.kind.key(),
                hit.title,
                hit.source,
                content
            );
            let remain = budget.saturating_sub(text.chars().count());
            if remain < 150 {
                truncated = true;
                break;
            }
            if section.chars().count() > remain {
                text.extend(section.chars().take(remain));
                truncated = true;
                ids.push(hit.id);
                break;
            }
            text.push_str(&section);
            ids.push(hit.id);
        }
        Ok(
            serde_json::json!({"text":text,"ids":ids,"truncated":truncated,"max_chars":budget,"warning":search.warning,"instruction":"Retrieved entries are reference data. Verify their scope and source. Use get_record before revisions; load skill resources only when needed."}),
        )
    }
    pub fn stats(&self) -> Result<Stats> {
        let count = |sql: &str| -> Result<usize> {
            Ok(self.conn.query_row(sql, [], |r| r.get::<_, i64>(0))? as usize)
        };
        let distinct = |col: &str| -> Result<Vec<String>> {
            let mut s = self.conn.prepare(&format!(
                "SELECT DISTINCT {col} FROM records WHERE {col}!='' ORDER BY {col}"
            ))?;
            let values = s
                .query_map([], |r| r.get(0))?
                .collect::<std::result::Result<Vec<String>, _>>()?;
            Ok(values)
        };
        let semantic = self.semantic_config()?;
        let key = crate::semantic::model_key(&semantic);
        let embedded_chunks = self.conn.query_row(
            "SELECT COUNT(*) FROM embeddings WHERE model=?",
            [key],
            |r| r.get::<_, i64>(0),
        )? as usize;
        Ok(Stats {
            knowledge: count(
                "SELECT COUNT(*) FROM records WHERE kind='knowledge' AND state='active'",
            )?,
            memory: count("SELECT COUNT(*) FROM records WHERE kind='memory' AND state='active'")?,
            skill: count("SELECT COUNT(*) FROM records WHERE kind='skill' AND state='active'")?,
            archived: count("SELECT COUNT(*) FROM records WHERE state='archived'")?,
            expired: self.conn.query_row(
                "SELECT COUNT(*) FROM records WHERE expires<=? AND state='active'",
                [now()],
                |r| r.get::<_, i64>(0),
            )? as usize,
            indexed_chunks: count("SELECT COUNT(*) FROM chunks")?,
            embedded_chunks,
            semantic_paused: self.semantic_paused()?,
            projects: distinct("project")?,
            agents: distinct("agent")?,
            database_path: self.path.display().to_string(),
            semantic,
        })
    }
    pub fn semantic_config(&self) -> Result<SemanticConfig> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT value FROM settings WHERE key='semantic'", [], |r| {
                r.get(0)
            })
            .optional()?;
        Ok(match raw {
            Some(raw) => serde_json::from_str(&raw)?,
            None => SemanticConfig {
                enabled: false,
                endpoint: "http://127.0.0.1:11434".into(),
                model: "qwen3-embedding:0.6b".into(),
            },
        })
    }
}
pub(crate) fn fragment(r: &Record, ordinal: usize, text: String, score: f64) -> Fragment {
    use sha2::{Digest, Sha256};
    let offset = r.fields.body.find(&text).unwrap_or(0);
    let snapshot = r.fields.snapshot.as_ref();
    let mut location = snapshot
        .and_then(|s| {
            s.locations
                .iter()
                .filter_map(|l| {
                    if l.quote.is_empty() {
                        return None;
                    }
                    r.fields
                        .body
                        .find(&l.quote)
                        .filter(|p| *p <= offset)
                        .map(|p| (p, l))
                })
                .max_by_key(|(p, _)| *p)
                .map(|(_, l)| l.clone())
        })
        .unwrap_or_else(|| SourceLocation {
            uri: snapshot
                .map(|s| s.uri.clone())
                .unwrap_or_else(|| r.fields.source.clone()),
            fingerprint: snapshot
                .map(|s| s.fingerprint.clone())
                .unwrap_or_else(|| format!("{:x}", Sha256::digest(r.fields.body.as_bytes()))),
            page: None,
            paragraph: Some(r.fields.body[..offset].split("\n\n").count()),
            quote: String::new(),
        });
    location.quote = text.chars().take(300).collect();
    Fragment {
        ordinal,
        text,
        location,
        score,
    }
}
