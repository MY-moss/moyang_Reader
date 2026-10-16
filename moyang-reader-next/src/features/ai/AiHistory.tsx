import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { resourceMetadata } from "../../shared/ai-resource-metadata";
import type {
  AiAsset,
  AiHistoryPage,
  AiRecord,
  AiResourceInfo,
  AiRevisionSummary,
  AiRevisionView,
} from "../../shared/ai-types";
import { ResourcePreview } from "./AiResources";

function ResourceChange({
  record,
  revision,
  previous,
  current,
}: {
  record: AiRecord;
  revision: number;
  previous?: AiResourceInfo;
  current?: AiResourceInfo;
}) {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<AiAsset | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const path = (previous ?? current)!.path;
  const hasPrevious = !!previous;
  useEffect(() => {
    if (!open || !hasPrevious || asset) return;
    let cancelled = false;
    setError("");
    void aiRequest<AiAsset>("asset", { id: record.id, revision, path })
      .then((value) => {
        if (!cancelled) setAsset(value);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, path, hasPrevious, asset, record.id, revision, retry]);
  const currentAsset = record.assets.find((a) => a.path === path);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {path} · {!previous ? "已新增" : !current ? "已移除" : "已修改"}
      </summary>
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>重试</button>
        </p>
      )}
      {open && (
        <div className="version-compare">
          <section>
            <h4>版本 {revision}</h4>
            {previous ? (
              asset ? (
                <ResourcePreview asset={asset} />
              ) : (
                !error && <p role="status">正在读取资源…</p>
              )
            ) : (
              <p>此版本没有该资源。</p>
            )}
          </section>
          <section>
            <h4>当前版本</h4>
            {currentAsset ? <ResourcePreview asset={currentAsset} /> : <p>该资源已移除。</p>}
          </section>
        </div>
      )}
    </details>
  );
}

function HistoryEntry({
  summary,
  record,
  busy,
  onRestore,
  getResources,
}: {
  summary: AiRevisionSummary;
  record: AiRecord;
  busy: boolean;
  onRestore: (revision: number) => void;
  getResources: () => Promise<AiResourceInfo[]>;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AiRevisionView | null>(null);
  const [resources, setResources] = useState<AiResourceInfo[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || detail) return;
    let cancelled = false;
    setError("");
    void Promise.all([
      aiRequest<AiRevisionView>("revision_view", { id: record.id, revision: summary.revision }),
      getResources(),
    ])
      .then(([value, metadata]) => {
        if (!cancelled) {
          setDetail(value);
          setResources(metadata);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, detail, record.id, getResources, summary.revision, retry]);
  const paths = [...new Set([...(detail?.record.resources ?? []).map((a) => a.path), ...resources.map((a) => a.path)])];
  const changes = paths
    .map((path) => ({
      path,
      previous: detail?.record.resources.find((a) => a.path === path),
      current: resources.find((a) => a.path === path),
    }))
    .filter(({ previous, current }) => previous?.fingerprint !== current?.fingerprint);
  return (
    <details
      onToggle={(e) => {
        if (e.target === e.currentTarget) setOpen(e.currentTarget.open);
      }}
    >
      <summary>
        版本 {summary.revision} · {new Date(summary.recorded_at).toLocaleString()} · {summary.reason || "保存"}
      </summary>
      {open && !detail && !error && <p role="status">正在读取版本…</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>重试</button>
        </p>
      )}
      {open && detail && (
        <>
          <div className="version-compare">
            <section>
              <h3>版本 {summary.revision}</h3>
              <pre className="ai-source-preview">{detail.record.body}</pre>
            </section>
            <section>
              <h3>当前版本</h3>
              <pre className="ai-source-preview">{record.body}</pre>
            </section>
          </div>
          <p>
            标题：{detail.record.title} · 来源：{detail.record.source} · 资源 {detail.record.resources.length} 个
          </p>
          {changes.length > 0 && (
            <section aria-label="资源版本变化">
              <h3>资源变化</h3>
              {changes.map((change) => (
                <ResourceChange key={change.path} record={record} revision={summary.revision} {...change} />
              ))}
            </section>
          )}
          {summary.revision !== record.revision && (
            <button disabled={busy} onClick={() => onRestore(summary.revision)}>
              恢复这个版本
            </button>
          )}
        </>
      )}
    </details>
  );
}

export function AiHistory({
  record,
  busy,
  onRestore,
}: {
  record: AiRecord;
  busy: boolean;
  onRestore: (revision: number) => void;
}) {
  const latest = useRef(record);
  useLayoutEffect(() => {
    latest.current = record;
  }, [record]);
  const metadata = useRef<{ key: string; value: Promise<AiResourceInfo[]> } | null>(null);
  const getResources = useCallback(() => {
    const key = `${record.id}:${record.revision}`;
    if (metadata.current?.key !== key) {
      const value = Promise.all(latest.current.assets.map(resourceMetadata));
      metadata.current = { key, value };
      void value.catch(() => {
        if (metadata.current?.value === value) metadata.current = null;
      });
    }
    return metadata.current!.value;
  }, [record.id, record.revision]);
  const [page, setPage] = useState<AiHistoryPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void aiRequest<AiHistoryPage>("history_page", { id: record.id, before_revision: cursor })
      .then((value) => {
        if (!cancelled)
          setPage((old) => ({ ...value, items: cursor && old ? [...old.items, ...value.items] : value.items }));
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
  }, [record.id, cursor, retry]);
  return (
    <section className="ai-history">
      <h2>修订历史</h2>
      {page?.items.map((summary) => (
        <HistoryEntry
          key={summary.revision}
          summary={summary}
          record={record}
          busy={busy}
          onRestore={onRestore}
          getResources={getResources}
        />
      ))}
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>重试</button>
        </p>
      )}
      {loading && <p role="status">正在读取历史…</p>}
      {page?.next_before != null && (
        <button disabled={loading} onClick={() => setCursor(page.next_before!)}>
          加载更早版本
        </button>
      )}
      {page && !page.items.length && <p>暂无修订历史。</p>}
    </section>
  );
}
