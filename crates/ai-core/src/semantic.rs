use crate::*;
use rusqlite::{named_params, params, OptionalExtension};
use std::{
    collections::{HashMap, VecDeque},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

#[cfg(test)]
#[path = "semantic_index_tests.rs"]
mod tests;

pub(crate) fn model_key(c: &SemanticConfig) -> String {
    let base = format!("{}|{}|body-v2", c.endpoint.trim_end_matches('/'), c.model);
    if c.protocol == "openai" {
        format!("{base}|openai|{}", c.provider)
    } else {
        base
    }
}
fn embed(
    c: &SemanticConfig,
    texts: &[String],
    key: &str,
    request_id: Option<&str>,
) -> Result<Vec<Vec<f64>>> {
    static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    let runtime = RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("Embedding runtime")
    });
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    let client = CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("HTTP client initialization")
    });
    crate::cancellation::check_cancelled(request_id)?;
    runtime.block_on(async {
    let fetch=async {
    let api=c.protocol=="openai";
    let mut request=client.post(if api {format!("{}/embeddings",c.endpoint.trim_end_matches('/'))}else{format!("{}/api/embed",c.endpoint.trim_end_matches('/'))});
    if !key.is_empty(){request=request.bearer_auth(key);}
    let response = request
        .json(&if api{serde_json::json!({"model":c.model,"input":texts,"encoding_format":"float"})}else{serde_json::json!({"model":c.model,"input":texts,"truncate":false})})
        .send().await
        .map_err(|e| invalid(&format!("语义服务连接失败：{e}")))?;
    if !response.status().is_success() {
        return Err(invalid(&format!(
            "语义服务返回 {}，请检查模型是否已安装。",
            response.status()
        )));
    }
    let value: serde_json::Value = response
        .json().await
        .map_err(|e| invalid(&format!("语义响应无效：{e}")))?;
    let vectors: Vec<Vec<f64>> = if api {
        let mut data=value["data"].as_array().ok_or_else(||invalid("嵌入 API 响应缺少 data。"))?.clone();
        data.sort_by_key(|v|v["index"].as_u64().unwrap_or(u64::MAX));
        if data.iter().enumerate().any(|(i,v)|v["index"].as_u64()!=Some(i as u64)){return Err(invalid("嵌入 API 返回的索引不连续。"));}
        data.into_iter().map(|v|serde_json::from_value(v["embedding"].clone())).collect::<std::result::Result<_,_>>()?
    }else{serde_json::from_value(value
            .get("embeddings")
            .cloned()
            .ok_or_else(|| invalid("语义响应缺少 embeddings。"))?)?};
    if vectors.len() != texts.len()
        || vectors.iter().any(|v| {
            v.is_empty()
                || v.len() > 16384
                || v.iter().any(|x| !x.is_finite())
                || v.iter().map(|x| x * x).sum::<f64>() == 0.0
        })
        || vectors.windows(2).any(|v| v[0].len() != v[1].len())
    {
        return Err(invalid("语义响应的向量数量、维度或数值无效。"));
    }
    Ok(vectors)
    };
    tokio::pin!(fetch);
    loop {tokio::select! {
        result=&mut fetch=>return result,
        _=tokio::time::sleep(Duration::from_millis(40))=>{crate::cancellation::check_cancelled(request_id)?;}
    }}
    })
}
type CachedQuery = (String, Instant, Vec<f64>);
fn query_embedding(
    c: &SemanticConfig,
    query: &str,
    credential: &str,
    request_id: Option<&str>,
) -> Result<Vec<f64>> {
    static CACHE: OnceLock<Mutex<VecDeque<CachedQuery>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(VecDeque::new()));
    let key = format!("{}\n{}", model_key(c), query);
    if let Ok(entries) = cache.lock() {
        if let Some((_, _, v)) = entries
            .iter()
            .find(|(k, t, _)| k == &key && t.elapsed() < Duration::from_secs(300))
        {
            return Ok(v.clone());
        }
    }
    let text = if c.model.starts_with("qwen3-embedding") {
        format!("Instruct: Given a query, retrieve relevant passages that answer the query\nQuery: {query}")
    } else {
        query.to_string()
    };
    let v = embed(c, &[text], credential, request_id)?.remove(0);
    if let Ok(mut entries) = cache.lock() {
        entries.retain(|(k, t, _)| k != &key && t.elapsed() < Duration::from_secs(300));
        entries.push_back((key, Instant::now(), v.clone()));
        while entries.len() > 128 {
            entries.pop_front();
        }
    }
    Ok(v)
}
fn cosine(a: &[f64], b: &[f64]) -> Option<f64> {
    if a.len() != b.len() {
        return None;
    }
    let dot: f64 = a.iter().zip(b).map(|(a, b)| a * b).sum();
    let norm =
        a.iter().map(|x| x * x).sum::<f64>().sqrt() * b.iter().map(|x| x * x).sum::<f64>().sqrt();
    if norm == 0.0 {
        None
    } else {
        Some(dot / norm)
    }
}
fn index_lock(path: &std::path::Path) -> Result<Option<std::fs::File>> {
    // Keep one stable file: unlinking it would allow two different inodes to be locked.
    // The OS releases the lock even when a desktop/MCP process is terminated.
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path.with_extension("semantic.lock"))?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(std::fs::TryLockError::WouldBlock) => Ok(None),
        Err(std::fs::TryLockError::Error(error)) => Err(error.into()),
    }
}
impl Store {
    pub fn pause_semantic(&self, paused: bool) -> Result<()> {
        self.conn.execute("INSERT INTO settings(key,value) VALUES('semantic_paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [if paused { "true" } else { "false" }])?;
        Ok(())
    }
    pub(crate) fn semantic_paused(&self) -> Result<bool> {
        Ok(self
            .conn
            .query_row(
                "SELECT value FROM settings WHERE key='semantic_paused'",
                [],
                |r| r.get::<_, String>(0),
            )
            .optional()?
            .as_deref()
            == Some("true"))
    }
    pub(crate) fn semantic_remaining(&self, key: &str) -> Result<i64> {
        Ok(self.conn.query_row("SELECT COUNT(*) FROM chunks c JOIN records e ON e.id=c.entry_id LEFT JOIN embeddings v ON v.chunk_id=c.id AND v.model=? WHERE v.chunk_id IS NULL AND e.state='active'", [key], |r| r.get(0))?)
    }
    fn resolve_semantic(&self, mut c: SemanticConfig) -> Result<SemanticConfig> {
        if !["", "ollama", "openai"].contains(&c.protocol.as_str()) {
            return Err(invalid("请选择本地 Ollama 或兼容 OpenAI 的嵌入 API。"));
        }
        if c.protocol == "openai" && c.enabled {
            let (provider, _) = self.service(&c.provider)?;
            if provider.protocol != "openai" {
                return Err(invalid("嵌入检索需要 OpenAI 兼容协议的服务。"));
            }
            c.endpoint = services::endpoint(&provider, true)
                .map_err(|e| invalid(&e))?
                .trim_end_matches("/models")
                .into();
        }
        c.endpoint = c.endpoint.trim().trim_end_matches('/').into();
        c.model = c.model.trim().into();
        if c.enabled {
            let url = reqwest::Url::parse(&c.endpoint)
                .map_err(|_| invalid("请输入有效的嵌入服务地址。"))?;
            if !["http", "https"].contains(&url.scheme())
                || c.model.is_empty()
                || !url.username().is_empty()
                || url.password().is_some()
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(invalid("服务地址需使用 http/https，并填写模型名称。"));
            }
        }
        Ok(c)
    }
    pub fn configure_semantic(&self, c: SemanticConfig) -> Result<SemanticConfig> {
        let c = self.resolve_semantic(c)?;
        self.conn.execute("INSERT INTO settings(key,value) VALUES('semantic',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[serde_json::to_string(&c)?])?;
        Ok(c)
    }
    pub fn test_semantic(
        &self,
        mut c: SemanticConfig,
        request_id: Option<&str>,
    ) -> Result<serde_json::Value> {
        c.enabled = true;
        let c = self.resolve_semantic(c)?;
        let vectors = embed(
            &c,
            &["墨阳阅读器：中文语义连接测试".into()],
            &self.embedding_key(&c)?,
            request_id,
        )?;
        Ok(serde_json::json!({"dimensions":vectors[0].len(),"model":c.model}))
    }
    fn embedding_key(&self, c: &SemanticConfig) -> Result<String> {
        if c.protocol != "openai" {
            return Ok(String::new());
        }
        let (provider, key) = self.service(&c.provider)?;
        let endpoint = services::endpoint(&provider, true).map_err(|e| invalid(&e))?;
        if provider.protocol != "openai"
            || endpoint.trim_end_matches("/models") != c.endpoint.trim_end_matches('/')
        {
            return Err(invalid(
                "嵌入 API 服务已修改，请重新保存检索设置后建立索引。",
            ));
        }
        Ok(key)
    }
    /// One bounded batch. UI repeats until remaining=0, allowing cancellation between batches.
    pub fn index_semantic(&mut self) -> Result<serde_json::Value> {
        let guard = index_lock(&self.path)?;
        let c = self.semantic_config()?;
        if !c.enabled {
            return Err(invalid("请先启用语义检索。"));
        }
        let key = model_key(&c);
        let paused = self.semantic_paused()?;
        if paused || guard.is_none() {
            return Ok(
                serde_json::json!({"processed":0,"remaining":self.semantic_remaining(&key)?,"busy":guard.is_none(),"paused":paused}),
            );
        }
        let pending: Vec<(i64, String)> = {
            let mut stmt=self.conn.prepare("SELECT c.id,c.text FROM chunks c JOIN records e ON e.id=c.entry_id LEFT JOIN embeddings v ON v.chunk_id=c.id AND v.model=? WHERE v.chunk_id IS NULL AND e.state='active' LIMIT 16")?;
            let rows = stmt
                .query_map([&key], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            rows
        };
        if !pending.is_empty() {
            let texts: Vec<String> = pending.iter().map(|(_, text)| text.clone()).collect();
            let vectors = embed(&c, &texts, &self.embedding_key(&c)?, None)?;
            let tx = self.conn.transaction()?;
            // A settings change must not let an old request replace newer-model vectors.
            let current: String =
                tx.query_row("SELECT value FROM settings WHERE key='semantic'", [], |r| {
                    r.get(0)
                })?;
            let current: SemanticConfig = serde_json::from_str(&current)?;
            if !current.enabled || model_key(&current) != key {
                return Ok(
                    serde_json::json!({"processed":0,"remaining":pending.len(),"changed":true}),
                );
            }
            for ((id, text), vector) in pending.iter().zip(vectors) {
                // Another process may have replaced the chunk while the network call was in flight.
                tx.execute("INSERT INTO embeddings(chunk_id,model,vector) SELECT c.id,?2,?3 FROM chunks c WHERE c.id=?1 AND c.text=?4 ON CONFLICT(chunk_id) DO UPDATE SET model=excluded.model,vector=excluded.vector",params![id,key,serde_json::to_string(&vector)?,text])?;
            }
            tx.commit()?;
        }
        let remaining = self.semantic_remaining(&key)?;
        Ok(serde_json::json!({"processed":pending.len(),"remaining":remaining}))
    }
    pub(crate) fn hybrid(&self, q: &SearchQuery) -> Result<SearchResult> {
        let c = self.semantic_config()?;
        if !c.enabled {
            return self.lexical(q);
        }
        // Partial vectors cannot prove that an unindexed keyword match is irrelevant.
        // Preserve full lexical pagination until this search scope is ready, and avoid
        // paying for a query embedding that could only produce an incomplete ranking.
        let missing: bool = self.conn.query_row(&format!("SELECT EXISTS(SELECT 1 FROM chunks c JOIN records e ON e.id=c.entry_id LEFT JOIN embeddings v ON v.chunk_id=c.id AND v.model=:model WHERE v.chunk_id IS NULL AND {})", crate::search::FILTER),
            named_params!{":model":model_key(&c),":state":q.state.key(),":kind":q.kind.map(Kind::key),":project":q.project,":agent":q.agent,":global":q.include_global,":expired":q.include_expired,":now":now()}, |r| r.get(0))?;
        let mut broad = q.clone();
        broad.limit = 100;
        broad.offset = 0;
        broad.semantic = false;
        let lexical = self.lexical(&broad)?;
        let title_terms = self.distinctive_title_terms(&q.query)?;
        let semantic = self.vector_search(q, &c, &title_terms);
        match semantic {
            Err(error) => {
                crate::cancellation::check_cancelled(q.request_id.as_deref())?;
                let mut fallback = self.lexical(q)?;
                fallback.warning = Some(format!("{} 已显示关键词结果。", error));
                Ok(fallback)
            }
            Ok((vectors, late_missing)) => {
                if missing || late_missing {
                    // Keep the entire keyword sequence, then append ready semantic-only
                    // matches. Unindexed records must never disappear from pagination.
                    let mut fallback = self.lexical(q)?;
                    let mut additional = Vec::new();
                    for hit in vectors {
                        if !self.lexical_matches(&hit.id, &q.query)? {
                            additional.push(hit);
                        }
                    }
                    let skip = q.offset.saturating_sub(fallback.total);
                    let room = q.limit.max(1).saturating_sub(fallback.items.len());
                    fallback.total += additional.len();
                    fallback
                        .items
                        .extend(additional.into_iter().skip(skip).take(room));
                    fallback.warning = Some(
                        "语义索引正在补齐；保留全部关键词结果，并在其后补充已就绪的语义结果。"
                            .into(),
                    );
                    return Ok(fallback);
                }
                let mut scores: HashMap<String, (Hit, f64)> = HashMap::new();
                for h in lexical.items {
                    let coverage = crate::search::coverage(&q.query, &h);
                    let title = if crate::search::title_anchor(&title_terms, &h) {
                        0.15
                    } else {
                        0.0
                    };
                    // A single common Chinese bigram is not evidence for a long question.
                    if coverage >= 0.25 || title > 0.0 {
                        scores.insert(h.id.clone(), (h, 0.35 * coverage + title));
                    }
                }
                for h in vectors {
                    // Preserve semantic distance: equal RRF ranks let weak word overlaps
                    // outrank the best semantic-only answer in a library of long documents.
                    let score = 0.65 * h.score;
                    let word_bonus = 0.35 * crate::search::coverage(&q.query, &h)
                        + if crate::search::title_anchor(&title_terms, &h) {
                            0.15
                        } else {
                            0.0
                        };
                    scores
                        .entry(h.id.clone())
                        .and_modify(|(old, s)| {
                            *s += score;
                            for fragment in &h.fragments {
                                if let Some(existing) = old
                                    .fragments
                                    .iter_mut()
                                    .find(|f| f.ordinal == fragment.ordinal)
                                {
                                    existing.score = fragment.score;
                                } else if old.fragments.len() < 4 {
                                    old.fragments.push(fragment.clone());
                                }
                            }
                        })
                        .or_insert((h, score + word_bonus));
                }
                let mut rows: Vec<_> = scores.into_values().collect();
                rows.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.id.cmp(&b.0.id)));
                let total = rows.len();
                let items = rows
                    .into_iter()
                    .skip(q.offset)
                    .take(q.limit.max(1))
                    .map(|(mut h, s)| {
                        h.score = s;
                        h
                    })
                    .collect();
                Ok(SearchResult {
                    items,
                    total,
                    warning: None,
                })
            }
        }
    }
    fn vector_search(
        &self,
        q: &SearchQuery,
        c: &SemanticConfig,
        title_terms: &std::collections::HashSet<String>,
    ) -> Result<(Vec<Hit>, bool)> {
        let key = model_key(c);
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM embeddings WHERE model=?",
            [&key],
            |r| r.get(0),
        )?;
        if count == 0 {
            return Ok((vec![], true));
        }
        let query = query_embedding(
            c,
            &q.query,
            &self.embedding_key(c)?,
            q.request_id.as_deref(),
        )?;
        // Keep candidate chunks and their subsequently loaded records on one read snapshot.
        // Start only after the embedding request so no transaction waits for the network.
        let read_tx = self.conn.unchecked_transaction()?;
        // Materialize each title once. Carrying the full record body on every chunk
        // made long-document searches quadratic in document size.
        let mut stmt=read_tx.prepare(&format!("WITH eligible AS MATERIALIZED (SELECT e.id,json_extract(e.payload,'$.title') AS title FROM records e WHERE {}) SELECT e.id,e.title,c.text,v.vector,c.ordinal FROM embeddings v JOIN chunks c ON c.id=v.chunk_id JOIN eligible e ON e.id=c.entry_id WHERE v.model=:model",crate::search::FILTER))?;
        type Candidate = (usize, String, f64);
        let mut best: HashMap<String, Vec<Candidate>> = HashMap::new();
        let mut mismatch = false;
        for row in stmt.query_map(named_params!{":model":key,":state":q.state.key(),":kind":q.kind.map(Kind::key),":project":q.project,":agent":q.agent,":global":q.include_global,":expired":q.include_expired,":now":now()}, |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
            ))
        })? {
            let (id, title, text, v,ordinal) = row?;
            crate::cancellation::check_cancelled(q.request_id.as_deref())?;
            let vector = crate::vector_cache::parsed(&key, &v)?;
            let Some(score) = cosine(&query, &vector) else {
                mismatch = true;
                continue;
            };
            let anchor=crate::search::title_anchor_text(title_terms,&title);
            if score < 0.42 && !(anchor && score>=0.25) {
                continue;
            }
            let candidates = best.entry(id).or_default();
            candidates.push((ordinal as usize, text, score));
            candidates.sort_by(|a,b|b.2.total_cmp(&a.2));
            candidates.truncate(4);
        }
        let missing: bool = read_tx.query_row(&format!("SELECT EXISTS(SELECT 1 FROM chunks c JOIN records e ON e.id=c.entry_id LEFT JOIN embeddings v ON v.chunk_id=c.id AND v.model=:model WHERE v.chunk_id IS NULL AND {})", crate::search::FILTER),
            named_params!{":model":key,":state":q.state.key(),":kind":q.kind.map(Kind::key),":project":q.project,":agent":q.agent,":global":q.include_global,":expired":q.include_expired,":now":now()}, |r| r.get(0))?;
        let mut ranked: Vec<_> = best.into_iter().collect();
        ranked.sort_by(|a, b| b.1[0].2.total_cmp(&a.1[0].2).then(a.0.cmp(&b.0)));
        ranked.truncate(100);
        let mut hits = Vec::with_capacity(ranked.len());
        let mut record_query =
            read_tx.prepare("SELECT json_remove(payload,'$.assets') FROM records WHERE id=?")?;
        for (id, candidates) in ranked {
            crate::cancellation::check_cancelled(q.request_id.as_deref())?;
            let Some(payload) = record_query
                .query_row([id], |r| r.get::<_, String>(0))
                .optional()?
            else {
                continue;
            };
            let record: Record = serde_json::from_str(&payload)?;
            if !crate::search::allowed(&record, q) {
                continue;
            }
            let mut hit = Hit::from_record(&record, candidates[0].1.clone(), candidates[0].2);
            hit.fragments = candidates
                .into_iter()
                .map(|(ordinal, text, score)| {
                    crate::search::fragment(&record, ordinal, text, score)
                })
                .collect();
            hits.push(hit);
        }
        Ok((hits, missing || mismatch))
    }
}
