import { useEffect, useRef, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { sourceEntry, type AiSourceEntry, type AiSourcePage } from "../../shared/ai-sources";
import type { AiFields, AiRecord, AiStats } from "../../shared/ai-types";
import { Icon } from "../../shared/components/Icon";
import { AiSource } from "./AiSource";
import {
  readImportedSource,
  reviewSources,
  sourceStatusLabels,
  type SourceResult,
  type SourceStatus,
} from "./source-review";

export function AiSources({
  stats,
  notify,
  active = true,
  dataVersion = 0,
}: {
  stats?: AiStats | null;
  active?: boolean;
  dataVersion?: number;
  notify: (message: string, error?: boolean) => void;
}) {
  const [project, setProject] = useState("*");
  const [includeGlobal, setIncludeGlobal] = useState(false);
  const [tick, setTick] = useState(0);
  const [entries, setEntries] = useState<AiSourceEntry[]>([]);
  const [results, setResults] = useState<Record<string, SourceResult>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<SourceStatus | "">("");
  const [page, setPage] = useState(0);
  const [opening, setOpening] = useState("");
  const [selected, setSelected] = useState<{ record: AiRecord; incoming: AiFields | null } | null>(null);
  const catalog = useRef<AiSourceEntry[]>([]);
  const scope = useRef("");
  const epoch = useRef({ sequence: 0 });
  const previewEpoch = useRef(0);
  const run = useRef({ cancelled: false });
  useEffect(() => {
    if (!active) return;
    const lifecycle = epoch.current;
    const sequence = ++lifecycle.sequence;
    const key = JSON.stringify([project, includeGlobal]);
    if (scope.current !== key) {
      scope.current = key;
      catalog.current = [];
      setEntries([]);
      setResults({});
      setPage(0);
      setSelected(null);
      setMessage("");
    }
    setLoading(true);
    setError("");
    void (async () => {
      const all: AiSourceEntry[] = [];
      let cursor: string | undefined;
      do {
        const next = await aiRequest<AiSourcePage>("source_inventory", {
          project: project === "*" ? undefined : project,
          include_global: !!project && project !== "*" && includeGlobal,
          cursor,
          limit: 100,
        });
        if (sequence !== epoch.current.sequence) return;
        all.push(...next.items);
        cursor = next.next_cursor ?? undefined;
      } while (cursor);
      const old = new Map(catalog.current.map((r) => [r.id, r.revision]));
      catalog.current = all;
      setEntries(all);
      setResults((previous) =>
        Object.fromEntries(
          all.filter((r) => r.revision === old.get(r.id) && previous[r.id]).map((r) => [r.id, previous[r.id]]),
        ),
      );
    })()
      .catch((e) => {
        if (sequence === epoch.current.sequence) setError(`读取来源列表失败：${String(e)}`);
      })
      .finally(() => {
        if (sequence === epoch.current.sequence) setLoading(false);
      });
    return () => {
      lifecycle.sequence++;
      run.current.cancelled = true;
    };
  }, [project, includeGlobal, tick, active, dataVersion]);
  const start = async (items: AiSourceEntry[]) => {
    if (busy || loading || !items.length) return;
    const token = { cancelled: false };
    run.current = token;
    const sequence = epoch.current.sequence;
    setBusy(true);
    setStopping(false);
    setMessage("");
    setResults((old) => ({
      ...old,
      ...Object.fromEntries(items.map((r) => [r.id, { status: "unchecked" as const }])),
    }));
    await reviewSources(
      items,
      (id, result) => setResults((old) => ({ ...old, [id]: result })),
      () => token.cancelled || sequence !== epoch.current.sequence,
    );
    if (sequence !== epoch.current.sequence) return;
    setBusy(false);
    setStopping(false);
    setResults((old) =>
      Object.fromEntries(
        Object.entries(old).map(([id, r]) => [id, r.status === "checking" ? { status: "unchecked" } : r]),
      ),
    );
    setMessage(token.cancelled ? "已停止检查，已完成的结果保留。" : "本次检查完成。查看差异后再决定是否更新快照。");
  };
  const inspect = async (entry: AiSourceEntry) => {
    const sequence = epoch.current.sequence;
    const previewSequence = ++previewEpoch.current;
    const current = () => sequence === epoch.current.sequence && previewSequence === previewEpoch.current;
    setOpening(entry.id);
    try {
      const record = await aiRequest<AiRecord>("get", { id: entry.id });
      if (!current()) return;
      if (record.state !== "active" || record.kind !== "knowledge" || !record.snapshot?.uri)
        throw new Error("这条资料已归档或来源已移除，请刷新列表。");
      let incoming: AiFields | null = null;
      try {
        const next = await readImportedSource(record.snapshot);
        if (!current()) return;
        if (next && !next.body.trim()) throw new Error("来源没有可读取的正文，已保留现有快照。");
        const changed = next && next.snapshot?.fingerprint !== record.snapshot.fingerprint;
        incoming = changed ? next : null;
        setResults((old) => ({
          ...old,
          [record.id]: { status: !next ? "manual" : changed ? "changed" : "unchanged", checkedAt: Date.now() },
        }));
      } catch (e) {
        if (!current()) return;
        setResults((old) => ({ ...old, [record.id]: { status: "error", error: String(e), checkedAt: Date.now() } }));
        notify(`来源暂时无法读取，现有快照仍保留：${String(e)}`, true);
      }
      setSelected({ record, incoming });
    } catch (e) {
      if (current()) notify(String(e), true);
    } finally {
      if (current()) setOpening("");
    }
  };
  const changed = (record: AiRecord) => {
    setSelected({ record, incoming: null });
    catalog.current = catalog.current.map((r) => (r.id === record.id ? sourceEntry(record) : r));
    setEntries(catalog.current);
    setResults((old) => ({ ...old, [record.id]: { status: "unchanged", checkedAt: Date.now() } }));
  };
  const status = (entry: AiSourceEntry) => results[entry.id]?.status ?? "unchecked";
  const filtered = entries.filter((r) => !filter || status(r) === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / 30));
  const currentPage = Math.min(page, pages - 1);
  const checked = entries.filter((r) => results[r.id]?.checkedAt).length;
  const failed = entries.filter((r) => status(r) === "error");
  const disabled = busy || loading || !!opening;
  return (
    <section className="ai-sources" aria-label="来源更新">
      {selected ? (
        <>
          <div className="ai-inline-actions">
            <button
              onClick={() => {
                previewEpoch.current++;
                setOpening("");
                setSelected(null);
              }}
            >
              <Icon name="back" /> 返回来源列表
            </button>
            <button disabled={!!opening} onClick={() => void inspect(sourceEntry(selected.record))}>
              重新读取与比较
            </button>
          </div>
          <h2>{selected.record.title}</h2>
          <p className="ai-muted">
            {selected.record.project || "全局"} · 保留标题、标签、范围和关联；只在确认后替换正文与来源快照。
          </p>
          <AiSource
            key={selected.record.id}
            record={selected.record}
            initialIncoming={selected.incoming}
            onChange={changed}
            notify={notify}
          />
        </>
      ) : (
        <>
          <p>集中检查已导入的知识来源。文件在本机读取，网页会访问原网站；不调用模型，不自动覆盖快照。</p>
          <div className="ai-health-filters">
            <label>
              项目
              <select
                aria-label="来源项目"
                disabled={disabled}
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="*">全部项目</option>
                <option value="">仅全局</option>
                {stats?.projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {project && project !== "*" && (
              <label className="ai-health-global">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={includeGlobal}
                  onChange={(e) => setIncludeGlobal(e.target.checked)}
                />
                包含全局资料
              </label>
            )}
            <button disabled={disabled} onClick={() => setTick((n) => n + 1)}>
              刷新来源列表
            </button>
          </div>
          <div className="ai-inline-actions">
            <button className="ai-primary" disabled={disabled || !entries.length} onClick={() => void start(entries)}>
              检查全部来源{entries.length ? `（${entries.length}）` : ""}
            </button>
            {failed.length > 0 && (
              <button disabled={disabled} onClick={() => void start(failed)}>
                重试无法读取的来源（{failed.length}）
              </button>
            )}
            {busy && (
              <button
                disabled={stopping}
                onClick={() => {
                  run.current.cancelled = true;
                  setStopping(true);
                }}
              >
                停止检查
              </button>
            )}
          </div>
          {busy && (
            <p role="status">
              {stopping ? "正在结束当前读取，不再开始新的检查…" : `已检查 ${checked} / ${entries.length} 个来源…`}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {error && (
            <p role="alert">
              {error}
              {entries.length ? "，已保留当前列表与检查结果。" : ""}
              <button disabled={disabled} onClick={() => setTick((n) => n + 1)}>
                重试读取列表
              </button>
            </p>
          )}
          {loading && <p role="status">正在读取来源列表…</p>}
          {!loading && !error && !entries.length && (
            <p className="ai-health-empty">这个范围还没有导入的知识来源。导入文件或网页后，可在这里集中检查。</p>
          )}
          {!!entries.length && (
            <>
              <label className="ai-source-filter">
                检查结果
                <select
                  aria-label="来源检查结果"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as SourceStatus | "");
                    setPage(0);
                  }}
                >
                  <option value="">全部（{entries.length}）</option>
                  {(["changed", "error", "manual", "unchanged", "unchecked"] as const).map((s) => (
                    <option key={s} value={s}>
                      {sourceStatusLabels[s]}（{entries.filter((r) => status(r) === s).length}）
                    </option>
                  ))}
                </select>
              </label>
              {!filtered.length && (
                <p className="ai-health-empty">
                  当前筛选没有结果。<button onClick={() => setFilter("")}>显示全部来源</button>
                </p>
              )}
              {filtered.slice(currentPage * 30, currentPage * 30 + 30).map((r) => (
                <article className="ai-health-item" key={r.id}>
                  <div className="ai-health-heading">
                    <h2>{r.title}</h2>
                    <span>
                      {r.project || "全局"} · {sourceStatusLabels[status(r)]}
                    </span>
                  </div>
                  <p className="ai-source-uri">{r.uri}</p>
                  {results[r.id]?.error && <p className="ai-source-error">{results[r.id].error}</p>}
                  {status(r) === "manual" && <p>只有文件名，无法自动访问原文件。查看来源后可重新选择文件。</p>}
                  {results[r.id]?.checkedAt && (
                    <p className="ai-muted">本次检查：{new Date(results[r.id].checkedAt!).toLocaleTimeString()}</p>
                  )}
                  <button disabled={disabled} onClick={() => void inspect(r)}>
                    {opening === r.id ? "正在读取…" : status(r) === "changed" ? "查看差异" : "查看来源"}
                  </button>
                </article>
              ))}
              {filtered.length > 30 && (
                <div className="ai-inline-actions">
                  <button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>
                    上一页
                  </button>
                  <span>
                    第 {currentPage + 1} / {pages} 页
                  </span>
                  <button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
