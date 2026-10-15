import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { openExternalUrl } from "../../platform/bridge";
import type { AiRecord, AiRevision } from "../../shared/ai-types";
import { exportAiRecord } from "./transfers";
import { AiSource } from "./AiSource";
import { AiResources } from "./AiResources";
import { AiRelations } from "./AiRelations";
export function AiDetail({
  record: r,
  onEdit,
  onSelect,
  onChange,
  notify,
}: {
  record: AiRecord;
  onEdit: () => void;
  onSelect: (id: string) => void;
  onChange: (record: AiRecord | null) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [history, setHistory] = useState<AiRevision[] | null>(null);
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [related, setRelated] = useState<AiRecord | null>(null);
  useEffect(() => {
    let cancelled = false;
    setHtml("");
    void import("../documents/rendering/markdown")
      .then(async (m) => {
        const rendered = await m.renderMarkdown(r.body);
        if (!cancelled) setHtml(rendered.html);
      })
      .catch(() => {
        /* Plain source below remains available. */
      });
    return () => {
      cancelled = true;
    };
  }, [r.body]);
  const act = async (operation: string, payload: unknown) => {
    setBusy(true);
    try {
      const next = await aiRequest<AiRecord | null>(operation, payload);
      setHistory(null);
      onChange(next);
      notify(operation === "delete" ? "已永久删除。" : "已保存变更。");
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="ai-record-detail">
      <div className="ai-detail-toolbar">
        <span>
          {r.project || "全局"} / {(r.sharing ?? "legacy") === "legacy" ? r.agent || "所有 Agent" : "跨 Agent 共享"}
        </span>
        <div>
          <button
            onClick={() =>
              void exportAiRecord(r)
                .then((ok) => {
                  if (ok) notify("已导出。");
                })
                .catch((e) => notify(String(e), true))
            }
          >
            导出{r.kind === "skill" ? "技能包" : "文档"}
          </button>
          <button className="ai-primary" onClick={onEdit}>
            编辑
          </button>
        </div>
      </div>
      <div className="ai-document">
        <h1>{r.title}</h1>
        {r.summary && <p className="ai-lede">{r.summary}</p>}
        <div className="ai-meta">
          <span>{r.kind === "memory" ? "长期记忆" : r.kind === "skill" ? "可复用技能" : "知识资料"}</span>
          {r.state === "archived" && <span>已归档</span>}
          {r.pinned && <span>置顶</span>}
          <span>{new Date(r.updated_at).toLocaleDateString()} 更新</span>
          <span>版本 {r.revision}</span>
          {r.expires_at && <span>有效至 {new Date(r.expires_at).toLocaleDateString()}</span>}
        </div>
        {r.tags.length > 0 && (
          <div className="ai-tags">
            {r.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        )}
        {html ? (
          <div
            className="ai-prose"
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={(e) => {
              const link = (e.target as HTMLElement).closest("a");
              if (link) {
                e.preventDefault();
                const href = link.getAttribute("href") || "";
                if (/^https?:\/\//i.test(href))
                  void openExternalUrl(href).catch((error) => notify(String(error), true));
                else if (href.startsWith("#"))
                  document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
                else notify("此链接没有可直接打开的网址。", true);
              }
            }}
          />
        ) : (
          <pre className="ai-source-preview">{r.body}</pre>
        )}
        <AiSource record={r} onChange={onChange} notify={notify} />
        {r.links.length > 0 && <AiRelations ids={r.links} onPreview={setRelated} />}
        {r.assets.length > 0 && <AiResources assets={r.assets} />}
        {related && (
          <aside className="ai-related-preview" aria-label="关联内容预览">
            <header>
              <h2>{related.title}</h2>
              <button onClick={() => setRelated(null)}>关闭预览</button>
            </header>
            <p>{related.source}</p>
            <pre>{related.body}</pre>
            <button onClick={() => onSelect(related.id)}>打开完整内容</button>
          </aside>
        )}
        <div className="ai-record-actions">
          <button
            disabled={busy}
            onClick={() =>
              void act("state", {
                id: r.id,
                expected_revision: r.revision,
                state: r.state === "active" ? "archived" : "active",
              })
            }
          >
            {r.state === "active" ? "归档" : "恢复使用"}
          </button>
          <button
            onClick={() => {
              void aiRequest<AiRevision[]>("history", { id: r.id })
                .then(setHistory)
                .catch((e) => notify(String(e), true));
            }}
          >
            查看历史
          </button>
          <button
            onClick={() =>
              void navigator.clipboard
                .writeText(r.id)
                .then(() => notify("已复制编号。"))
                .catch((e) => notify(String(e), true))
            }
          >
            复制编号
          </button>
          <button
            onClick={() =>
              void aiRequest("feedback", { id: r.id, useful: true })
                .then(() => notify("已记录：这条内容有帮助。"))
                .catch((e) => notify(String(e), true))
            }
          >
            有帮助
          </button>
          {r.state === "archived" && (
            <button className="ai-danger" onClick={() => setConfirmDelete(true)}>
              永久删除
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="ai-delete-confirm" role="alert">
            <p>永久删除会移除正文和全部历史。若只是暂时不用，保留归档即可。</p>
            <button onClick={() => setConfirmDelete(false)}>保留归档</button>
            <button
              disabled={busy}
              className="ai-danger"
              onClick={() => void act("delete", { id: r.id, expected_revision: r.revision })}
            >
              确认永久删除
            </button>
          </div>
        )}
        {history && (
          <section className="ai-history">
            <h2>修订历史</h2>
            {history.map((h) => (
              <details key={h.record.revision}>
                <summary>
                  版本 {h.record.revision} · {new Date(h.recorded_at).toLocaleString()} · {h.reason || "保存"}
                </summary>
                <div className="version-compare">
                  <section>
                    <h3>版本 {h.record.revision}</h3>
                    <pre className="ai-source-preview">{h.record.body}</pre>
                  </section>
                  <section>
                    <h3>当前版本</h3>
                    <pre className="ai-source-preview">{r.body}</pre>
                  </section>
                </div>
                <p>
                  标题：{h.record.title} · 来源：{h.record.source} · 资源 {h.record.assets.length} 个
                </p>
                {h.record.revision !== r.revision && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act("restore", { id: r.id, expected_revision: r.revision, revision: h.record.revision })
                    }
                  >
                    恢复这个版本
                  </button>
                )}
              </details>
            ))}
          </section>
        )}
      </div>
    </article>
  );
}
