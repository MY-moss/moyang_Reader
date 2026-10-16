import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import type { AiKind, AiRecord, AiStats } from "../../shared/ai-types";
import { healthLabels, type AiHealthIssue, type AiHealthItem, type AiHealthReport } from "../../shared/ai-health";

export function AiHealth({
  stats,
  onSelect,
  notify,
  active = true,
  dataVersion = 0,
}: {
  stats?: AiStats | null;
  active?: boolean;
  dataVersion?: number;
  onSelect: (id: string) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [project, setProject] = useState("*"),
    [agent, setAgent] = useState(""),
    [kind, setKind] = useState(""),
    [issue, setIssue] = useState("");
  const [includeGlobal, setIncludeGlobal] = useState(false),
    [page, setPage] = useState(0),
    [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; report: AiHealthReport } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState<AiRecord | null>(null);
  const query = JSON.stringify({
    project: project === "*" ? undefined : project,
    agent: agent || undefined,
    kind: kind || undefined,
    issue: issue || undefined,
    include_global: includeGlobal,
    offset: page * 30,
    limit: 30,
  });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void aiRequest<AiHealthReport>("health", JSON.parse(query))
      .then((report) => {
        if (!cancelled) {
          if (report.offset > 0 && report.offset >= report.total) {
            setPage(Math.max(0, Math.ceil(report.total / 30) - 1));
          } else setResult({ key: query, report });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, tick, active, dataVersion]);
  const report = result?.key === query ? result.report : null;
  const change = (update: () => void) => {
    update();
    setPage(0);
  };
  const archive = async (r: AiHealthItem | AiRecord, undo = false) => {
    setBusy(true);
    try {
      const next = await aiRequest<AiRecord>("state", {
        id: r.id,
        expected_revision: r.revision,
        state: undo ? "active" : "archived",
      });
      setArchived(undo ? null : next);
      setTick((n) => n + 1);
      notify(undo ? "已恢复这条资料。" : "已归档，历史仍保留。也可以在归档列表恢复。");
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ai-health" aria-label="资料检查">
      <p>集中核对知识、记忆与技能，保持长期积累清晰可用。检查在本机完成，不调用模型。</p>
      <div className="ai-health-filters">
        <label>
          项目
          <select value={project} onChange={(e) => change(() => setProject(e.target.value))}>
            <option value="*">全部项目</option>
            <option value="">仅全局</option>
            {stats?.projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          类型
          <select value={kind} onChange={(e) => change(() => setKind(e.target.value as AiKind))}>
            <option value="">所有类型</option>
            <option value="knowledge">知识</option>
            <option value="memory">长期记忆</option>
            <option value="skill">技能</option>
          </select>
        </label>
        <label>
          Agent
          <select value={agent} onChange={(e) => change(() => setAgent(e.target.value))}>
            <option value="">所有 Agent</option>
            {stats?.agents.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        {project !== "*" && project !== "" && (
          <label className="ai-health-global">
            <input
              type="checkbox"
              checked={includeGlobal}
              onChange={(e) => change(() => setIncludeGlobal(e.target.checked))}
            />
            包含全局资料
          </label>
        )}
        <button disabled={loading || busy} onClick={() => setTick((n) => n + 1)}>
          重新检查
        </button>
      </div>
      <div className="ai-health-categories" aria-label="检查类型">
        <button aria-pressed={!issue} onClick={() => change(() => setIssue(""))}>
          全部待核对
        </button>
        {(Object.keys(healthLabels) as AiHealthIssue[]).map((key) => (
          <button key={key} aria-pressed={issue === key} onClick={() => change(() => setIssue(key))}>
            {healthLabels[key]}
            {report ? ` ${report.counts[key]}` : ""}
          </button>
        ))}
      </div>
      {archived && (
        <div className="ai-notice" role="status">
          已归档「{archived.title}」。
          <button disabled={busy} onClick={() => void archive(archived, true)}>
            撤销归档
          </button>
        </div>
      )}
      {error && (
        <p role="alert">
          检查失败{report ? "，已保留上次结果" : ""}：{error}{" "}
          <button onClick={() => setTick((n) => n + 1)}>重试检查</button>
        </p>
      )}
      {loading && <p role="status">正在核对本地资料…</p>}
      {report && (
        <>
          <p className="ai-muted">
            {new Date(report.checked_at).toLocaleTimeString()} 检查了 {report.scanned} 条未归档资料，当前条件下{" "}
            {report.total} 条待核对。正文相同不代表用途相同，请查看来源与适用范围后整理。
          </p>
          {!report.total && (
            <p className="ai-health-empty">
              {report.scanned ? "当前条件下没有发现待核对项。" : "这个范围还没有资料。保存知识或记忆后可以再来检查。"}
            </p>
          )}
          {report.items.map((r) => (
            <article className="ai-health-item" key={r.id}>
              <div className="ai-health-heading">
                <h2>{r.title}</h2>
                <span>
                  {r.project || "全局"} · {r.kind === "memory" ? "长期记忆" : r.kind === "skill" ? "技能" : "知识"}
                </span>
              </div>
              <div className="ai-tags">
                {r.issues.map((i) => (
                  <span key={i}>{healthLabels[i]}</span>
                ))}
              </div>
              <p className="ai-health-excerpt">{r.excerpt}</p>
              {r.source && <p className="ai-muted">来源：{r.source}</p>}
              {r.issues.includes("expired") && (
                <p>有效期已到 {new Date(r.expires_at!).toLocaleDateString()}，默认召回已排除；可编辑有效期或归档。</p>
              )}
              {!!r.broken_link_ids.length && <p>{r.broken_link_ids.length} 条关联已被删除，打开资料可重新选择关联。</p>}
              {r.duplicate_count > 1 && (
                <details>
                  <summary>同范围有 {r.duplicate_count} 条相同正文</summary>
                  <p>仅比较正文，不代表来源、附件或用途相同。下方最多列出 3 条，完整结果可用“正文相同”筛选查看。</p>
                  {r.duplicate_peers.map((p) => (
                    <button key={p.id} onClick={() => onSelect(p.id)}>
                      查看：{p.title}
                    </button>
                  ))}
                </details>
              )}
              <div className="ai-inline-actions">
                <button onClick={() => onSelect(r.id)}>查看与整理</button>
                <button disabled={busy || loading} onClick={() => void archive(r)}>
                  归档
                </button>
              </div>
            </article>
          ))}
          {report.total > 30 && (
            <div className="ai-health-pagination">
              <button disabled={!page || loading} onClick={() => setPage((n) => n - 1)}>
                上一页
              </button>
              <span>
                第 {page + 1} / {Math.ceil(report.total / 30)} 页
              </span>
              <button disabled={(page + 1) * 30 >= report.total || loading} onClick={() => setPage((n) => n + 1)}>
                下一页
              </button>
            </div>
          )}
          {report.total > 0 && !report.items.length && <button onClick={() => setPage(0)}>返回第一页</button>}
        </>
      )}
    </section>
  );
}
