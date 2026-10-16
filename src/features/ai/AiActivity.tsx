import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import type { AiFields, AiRecord, AiStats } from "../../shared/ai-types";
import { AiHealth } from "./AiHealth";
type Conflict = { id: string; evidence: string; proposal: AiFields & { id: string; expected_revision: number } };
type Activity = {
  id: string;
  record_id: string;
  reason: string;
  evidence: string;
  outcome: string;
  updated_at: number;
  undone_revision: number | null;
};
type Checkpoint = {
  id: string;
  client: string;
  session: string;
  turn: string;
  reason: string;
  status: string;
  updated_at: number;
};
type Feed = { checkpoints: Checkpoint[]; pending: Checkpoint[]; conflicts: Conflict[]; activities: Activity[] };
function ConflictItem({ item, act }: { item: Conflict; act: (operation: string, payload: unknown) => Promise<void> }) {
  const [current, setCurrent] = useState<AiRecord | null>(null),
    [body, setBody] = useState(item.proposal.body),
    [error, setError] = useState("");
  useEffect(() => {
    void aiRequest<AiRecord>("get", { id: item.proposal.id })
      .then(setCurrent)
      .catch((e) => setError(String(e)));
  }, [item.proposal.id]);
  return (
    <details className="ai-conflict-item">
      <summary>{item.proposal.title} · 等待判断</summary>
      <p>依据：{item.evidence}</p>
      {error && <p role="alert">{error}</p>}
      <div className="version-compare">
        <section>
          <h3>现有记忆</h3>
          <pre>{current?.body ?? "正在读取…"}</pre>
        </section>
        <section>
          <h3>新提议</h3>
          <pre>{item.proposal.body}</pre>
        </section>
      </div>
      <label>
        整理后的记忆
        <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="ai-inline-actions">
        <button
          disabled={!current}
          onClick={() =>
            void act("resolve_conflict", {
              id: item.id,
              resolution: "accept",
              expected_revision: current?.revision,
              body,
            })
          }
        >
          采用整理结果
        </button>
        <button onClick={() => void act("resolve_conflict", { id: item.id, resolution: "keep_existing" })}>
          保留现有记忆
        </button>
        <button onClick={() => void act("resolve_conflict", { id: item.id, resolution: "save_copy", body })}>
          分别保留
        </button>
      </div>
    </details>
  );
}
export function AiActivity({
  onSelect,
  notify,
  stats,
}: {
  onSelect: (id: string) => void;
  notify: (text: string, error?: boolean) => void;
  stats?: AiStats | null;
}) {
  const [health, setHealth] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (health) return;
    let cancelled = false;
    void aiRequest<Feed>("activity")
      .then((r) => {
        if (!cancelled) {
          setFeed(r);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [tick, health]);
  const act = async (operation: string, payload: unknown) => {
    setBusy(true);
    try {
      await aiRequest(operation, payload);
      setTick((n) => n + 1);
      notify("已保存处理结果。");
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="ai-activity">
      <h1>{health ? "资料检查" : "近期活动"}</h1>
      <nav className="ai-health-tabs" aria-label="积累管理">
        <button aria-pressed={!health} onClick={() => setHealth(false)}>
          近期活动与冲突
        </button>
        <button aria-pressed={health} onClick={() => setHealth(true)}>
          资料检查
        </button>
      </nav>
      {health ? (
        <AiHealth stats={stats} onSelect={onSelect} notify={notify} />
      ) : (
        <>
          <p>明确结论自动留下，推测出的矛盾在这里处理。每次沉淀都可以查看依据、撤回与恢复。</p>
          <button onClick={() => setTick((n) => n + 1)}>刷新活动</button>
          {error && <p role="alert">{error}</p>}
          {!feed && !error && <p role="status">正在读取活动…</p>}
          {feed && (
            <>
              <section>
                <h2>
                  待处理冲突 <small>{feed.conflicts.length}</small>
                </h2>
                {feed.conflicts.map((c) => (
                  <ConflictItem key={c.id} item={c} act={act} />
                ))}
                {!feed.conflicts.length && <p className="ai-muted">暂时没有需要你判断的矛盾。</p>}
              </section>
              <section>
                <h2>沉淀与技能改进</h2>
                {feed.activities.map((a) => (
                  <article className="ai-activity-item" key={a.id}>
                    <time>{new Date(a.updated_at).toLocaleString()}</time>
                    <h3>{a.reason}</h3>
                    <p>{a.evidence}</p>
                    {a.outcome && <p>任务结果：{a.outcome === "success" ? "成功经验" : "失败经验"}</p>}
                    <div className="ai-inline-actions">
                      <button onClick={() => onSelect(a.record_id)}>查看内容与历史</button>
                      <button
                        disabled={busy}
                        onClick={() => void act("undo_activity", { id: a.id, restore: a.undone_revision !== null })}
                      >
                        {a.undone_revision !== null ? "恢复这次沉淀" : "撤回这次沉淀"}
                      </button>
                    </div>
                  </article>
                ))}
                {!feed.activities.length && <p className="ai-muted">Agent 完成有新信息的任务后，记录会出现在这里。</p>}
              </section>
              <section>
                <h2>尚未完成的任务检查点</h2>
                {feed.pending.map((c) => (
                  <article key={c.id} className="ai-activity-item">
                    <strong>
                      {c.client} · {c.turn}
                    </strong>
                    <p>任务中断或尚未回报。下次连接时可继续处理。</p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act("conclude", {
                          checkpoint_id: c.id,
                          reason: "用户确认这轮没有需要长期保存的新信息",
                          decisions: [],
                        })
                      }
                    >
                      本轮无需沉淀
                    </button>
                  </article>
                ))}
                {!feed.pending.length && <p className="ai-muted">所有已登记任务均已处理。</p>}
              </section>
              <details>
                <summary>最近任务记录</summary>
                {feed.checkpoints.map((c) => (
                  <p key={c.id}>
                    {c.client} · {new Date(c.updated_at).toLocaleString()} ·{" "}
                    {c.status === "completed" ? "已沉淀" : c.status === "no_new_information" ? "没有新信息" : "待处理"}{" "}
                    — {c.reason}
                  </p>
                ))}
              </details>
            </>
          )}
        </>
      )}
    </main>
  );
}
