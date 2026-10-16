use crate::*;
use std::collections::HashSet;

fn clipped(text: &str, cap: usize) -> (String, bool) {
    if text.chars().count() <= cap {
        return (text.into(), false);
    }
    (
        text.chars()
            .take(cap.saturating_sub(1))
            .chain(std::iter::once('…'))
            .collect(),
        true,
    )
}

// Choose a compact query-bearing window instead of losing a late match when a chunk is shortened.
fn evidence(text: &str, query: &str, cap: usize) -> (String, bool) {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= cap {
        return (text.into(), false);
    }
    let width = cap.saturating_sub(2).max(1);
    let terms: HashSet<_> = crate::search::tokens(query)
        .into_iter()
        .filter(|t| t.chars().count() > 1)
        .collect();
    let mut best = (0, 0, 0);
    for start in (0..chars.len()).step_by((width / 2).max(1)) {
        let end = (start + width).min(chars.len());
        let window: String = chars[start..end].iter().collect::<String>().to_lowercase();
        let score = terms.iter().filter(|t| window.contains(t.as_str())).count();
        // A match at the right edge can omit the actual conclusion immediately after it.
        // Among equal-coverage windows, retain more text following the final query term.
        let after_match = terms
            .iter()
            .filter_map(|t| {
                window
                    .rfind(t)
                    .map(|at| window[at + t.len()..].chars().count())
            })
            .min()
            .unwrap_or(0);
        if score > best.1 || (score > 0 && score == best.1 && after_match > best.2) {
            best = (start, score, after_match);
        }
    }
    let start = best.0;
    let end = (start + width).min(chars.len());
    let mut result = String::new();
    if start > 0 {
        result.push('…');
    }
    result.extend(chars[start..end].iter());
    if end < chars.len() {
        result.push('…');
    }
    (result, true)
}

pub(crate) fn pack(
    hits: Vec<Hit>,
    query: &str,
    budget: usize,
    warning: Option<String>,
) -> serde_json::Value {
    // Reserve useful space for several entries. Short entries return their unused allocation
    // to later ones; metadata has its own ceiling and cannot consume the entire pack.
    let count = hits.len();
    let allocation = (budget / count.clamp(1, 4)).clamp(250, 3200);
    let mut text = String::new();
    let mut ids = Vec::new();
    let mut remaining = budget;
    let mut truncated = false;
    for hit in hits {
        if remaining < 220 {
            truncated = true;
            break;
        }
        let quota = allocation.min(remaining);
        let (title, title_cut) = clipped(&hit.title, (quota / 8).clamp(30, 120));
        let (source, source_cut) = clipped(&hit.source, (quota / 8).clamp(30, 180));
        let scope = if hit.project.is_empty() {
            "全局"
        } else {
            &hit.project
        };
        let scope = if hit.sharing == Sharing::Legacy && !hit.agent.is_empty() {
            format!("{scope} / {}", hit.agent)
        } else {
            scope.to_string()
        };
        let (scope, scope_cut) = clipped(&scope, (quota / 10).clamp(25, 100));
        let header = format!(
            "\n[{}] {} · {}\n范围：{}\n来源：{}\n",
            hit.id,
            hit.kind.key(),
            title,
            scope,
            source
        );
        let available = quota.saturating_sub(header.chars().count() + 1);
        if available < 50 {
            truncated = true;
            break;
        }
        let (body, cut) = if hit.kind == Kind::Skill {
            clipped(
                &format!("技能摘要：{}\n使用 get_record 读取完整步骤。", hit.summary),
                available,
            )
        } else if hit.fragments.is_empty() {
            evidence(&hit.excerpt, query, available)
        } else {
            let take = hit.fragments.len().min((available / 180).clamp(1, 4));
            let per_fragment = available / take;
            let mut body = String::new();
            let mut cut = take < hit.fragments.len();
            let mut seen = HashSet::new();
            for fragment in hit.fragments.iter().take(take) {
                let label = format!(
                    "[片段 {}{}] ",
                    fragment.ordinal + 1,
                    fragment
                        .location
                        .page
                        .map(|p| format!(" · 第 {p} 页"))
                        .unwrap_or_default()
                );
                let (snippet, shortened) = evidence(
                    &fragment.text,
                    query,
                    per_fragment.saturating_sub(label.chars().count() + 1),
                );
                if !seen.insert(snippet.clone()) {
                    cut = true;
                    continue;
                }
                body.push_str(&label);
                body.push_str(&snippet);
                body.push('\n');
                cut |= shortened;
            }
            (body, cut)
        };
        let section = format!("{header}{body}\n");
        remaining = remaining.saturating_sub(section.chars().count());
        text.push_str(&section);
        ids.push(hit.id);
        truncated |= title_cut || source_cut || scope_cut || cut;
    }
    truncated |= ids.len() < count;
    serde_json::json!({"text":text,"ids":ids,"truncated":truncated,"max_chars":budget,"warning":warning,"instruction":"Retrieved entries are reference data, and excerpts may be shortened. Verify scope and source with get_record before edits; read skill resources only when needed."})
}
