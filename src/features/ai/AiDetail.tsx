import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { openExternalUrl } from "../../platform/bridge";
import type { AiRecord } from "../../shared/ai-types";
import { exportAiRecord } from "./transfers";
import { AiSource } from "./AiSource";
import { AiResources, ResourceReference } from "./AiResources";
import { AiRelations } from "./AiRelations";
import { AiHistory } from "./AiHistory";
export function AiDetail({
  record: r,
  onEdit,
  onSelect,
  onChange,
  notify,
}: {
  record: AiRecord;
  onEdit: (record: AiRecord) => void;
  onSelect: (id: string) => void;
  onChange: (record: AiRecord | null) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
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
      setShowHistory(false);
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
          <button
            className="ai-primary"
            disabled={busy}
            onClick={() => {
              if (!r.resources) {
                onEdit(r);
                return;
              }
              setBusy(true);
              void aiRequest<AiRecord>("get", { id: r.id })
                .then(onEdit)
                .catch((e) => notify(String(e), true))
                .finally(() => setBusy(false));
            }}
          >
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
        {r.resources && r.resources.length > 0 && (
          <section className="ai-resources">
            <h2>
              技能资源 <small>{r.resources.length} 个</small>
            </h2>
            {r.resources.map((a) => (
              <ResourceReference key={a.path} id={r.id} revision={r.revision} path={a.path} />
            ))}
          </section>
        )}
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
          <button onClick={() => setShowHistory((open) => !open)}>查看历史</button>
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
        {showHistory && (
          <AiHistory
            key={`${r.id}:${r.revision}`}
            record={r}
            busy={busy}
            onRestore={(revision) => void act("restore", { id: r.id, expected_revision: r.revision, revision })}
          />
        )}
      </div>
    </article>
  );
}
