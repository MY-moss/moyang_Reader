import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import type { AiRecord } from "../../shared/ai-types";
type Group = {
  id: string;
  title: string;
  reason: string;
  state: "pending" | "merged" | "undone" | "dismissed";
  result: { id: string; revision: number } | null;
};
type Detail = {
  originals: AiRecord[];
  title: string;
  body: string;
  reason: string;
  result: { id: string; revision: number } | null;
};
function Item({
  item,
  act,
  onSelect,
}: {
  item: Group;
  act: (id: string, action: string) => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void aiRequest<Detail>("merge_detail", { id: item.id })
      .then((r) => {
        if (alive) {
          setDetail(r);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [open, item.id, item.state]);
  const run = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      await act(item.id, action);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="ai-conflict-item" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {item.title} · {{ pending: "待比较", merged: "已合并", undone: "已撤回", dismissed: "已保留原文" }[item.state]}
      </summary>
      <p>{item.reason}</p>
      {error && <p role="alert">{error}</p>}
      {open && !detail && !error && <p role="status">正在读取合并依据…</p>}
      {detail && (
        <>
          <div className="version-compare">
            {detail.originals.map((r) => (
              <section key={r.id}>
                <h3>
                  {r.title} · 原版本 {r.revision}
                </h3>
                <pre>{r.body}</pre>
                <small>{r.source}</small>
                <button onClick={() => onSelect(r.id)}>打开原记录与后续变化</button>
              </section>
            ))}
          </div>
          <section>
            <h3>合并内容</h3>
            <pre className="ai-merge-body">{detail.body}</pre>
          </section>
          <div className="ai-inline-actions">
            {item.state === "pending" && (
              <>
                <button disabled={busy} onClick={() => void run("accept")}>
                  确认合并
                </button>
                <button disabled={busy} onClick={() => void run("dismiss")}>
                  分别保留
                </button>
              </>
            )}
            {item.state === "merged" && (
              <>
                <button onClick={() => onSelect(detail.result!.id)}>打开合并后的记忆</button>
                <button disabled={busy} onClick={() => void run("undo")}>
                  撤回整组合并
                </button>
              </>
            )}
          </div>
        </>
      )}
    </details>
  );
}
export function AiMergeGroups({
  project,
  active,
  dataVersion,
  onSelect,
}: {
  project: string;
  active: boolean;
  dataVersion: number;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(0),
    [tick, setTick] = useState(0),
    [error, setError] = useState("");
  const [feed, setFeed] = useState<{ items: Group[]; next_offset: number | null } | null>(null);
  useEffect(() => {
    setPage(0);
    setFeed(null);
  }, [project]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void aiRequest<{ items: Group[]; next_offset: number | null }>("merge_groups", {
      project: project === "*" ? null : project,
      offset: page * 20,
    })
      .then((r) => {
        if (alive) {
          setFeed(r);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [project, page, active, dataVersion, tick]);
  const act = async (id: string, action: string) => {
    await aiRequest("merge_action", { id, action });
    setTick((t) => t + 1);
  };
  return (
    <section aria-label="记忆合并记录">
      <h2>记忆整理与合并</h2>
      {error && <p role="alert">{error}</p>}
      {feed?.items.map((item) => (
        <Item key={item.id} item={item} act={act} onSelect={onSelect} />
      ))}
      {feed && !feed.items.length && <p>暂无合并记录。可在设置 → AI 服务与整理中配置后台整理。</p>}
      {feed && (page > 0 || feed.next_offset !== null) && (
        <div className="ai-inline-actions">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            上一页合并
          </button>
          <span>第 {page + 1} 页</span>
          <button disabled={feed.next_offset === null} onClick={() => setPage((p) => p + 1)}>
            下一页合并
          </button>
        </div>
      )}
    </section>
  );
}
