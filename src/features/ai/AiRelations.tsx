import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import type { AiRecord, AiSearch } from "../../shared/ai-types";
export function AiRelations({
  ids,
  ownId,
  onChange,
  onPreview,
}: {
  ids: string[];
  ownId?: string;
  onChange?: (ids: string[]) => void;
  onPreview?: (record: AiRecord) => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<AiSearch | null>(null),
    [records, setRecords] = useState<Record<string, AiRecord | null>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await aiRequest<AiRecord>("get", { id })] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((values) => {
      if (!cancelled) setRecords(Object.fromEntries(values));
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void aiRequest<AiSearch>("search", { query, limit: 8, semantic: false })
        .then((r) => {
          if (!cancelled) {
            setResults(r);
            setError("");
          }
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);
  return (
    <section className="ai-related">
      <h2>关联内容</h2>
      {ids.map((id) => (
        <div className="ai-resource-row" key={id}>
          <button
            type="button"
            disabled={!records[id]}
            onClick={() => {
              const r = records[id];
              if (r) onPreview?.(r);
            }}
          >
            {records[id]?.title ?? "关联内容已不可用"}
          </button>
          {onChange && (
            <button type="button" onClick={() => onChange(ids.filter((i) => i !== id))}>
              移除
            </button>
          )}
        </div>
      ))}
      {onChange && (
        <>
          <input
            aria-label="按名称关联内容"
            placeholder="搜索名称，添加关联…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          {results && (
            <div className="ai-relation-results">
              {results.items
                .filter((r) => r.id !== ownId && !ids.includes(r.id))
                .map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => {
                      onChange([...ids, r.id]);
                      setQuery("");
                    }}
                  >
                    {r.title}
                    <small>{r.project || "全局"}</small>
                  </button>
                ))}
              {!results.items.length && <p>没有找到相关内容</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
