import { lazy, Suspense, useState, useRef } from "react";
import { aiKinds, type AiFields, type AiRecord } from "../../shared/ai-types";
import { checkMarkdownEditorSafety } from "../editor/markdown-editor-support";
import { AiRelations } from "./AiRelations";
import type { SourceEditorLinkContext } from "../editor/components/SourceEditor";
import { AiResources } from "./AiResources";
const Wysiwyg = lazy(() =>
  import("../editor/components/MarkdownWysiwygEditor").then((m) => ({ default: m.MarkdownWysiwygEditor })),
);
const Source = lazy(() => import("../editor/components/SourceEditor").then((m) => ({ default: m.SourceEditor })));
export type AiDraft = {
  fields: AiFields;
  id?: string;
  key?: string;
  expected_revision?: number;
  baseBody?: string;
  dirty?: boolean;
  saveError?: string;
  merge?: { ids: string[]; revisions: number[] };
};
export function AiEditor({
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
  onComposition,
  onResourceLoading,
}: {
  draft: AiDraft;
  busy: boolean;
  onChange: (draft: AiDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onComposition?: (value: boolean) => void;
  onResourceLoading?: (value: boolean) => void;
}) {
  const f = draft.fields,
    [source, setSource] = useState(false),
    [link, setLink] = useState<string | null>(null),
    [status, setStatus] = useState("");
  const [safety] = useState(() => checkMarkdownEditorSafety(f.body));
  const [related, setRelated] = useState<AiRecord | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const linkTarget = useRef<{ context?: SourceEditorLinkContext; range?: Range }>({});
  const beginLink = (context?: SourceEditorLinkContext) => {
    const selection = window.getSelection();
    if (!context && (!selection?.rangeCount || !selection.toString().trim())) {
      setStatus("请先选择要添加链接的文字，再按 Ctrl+K。");
      return;
    }
    linkTarget.current = context ? { context } : { range: selection!.getRangeAt(0).cloneRange() };
    setLink("");
  };
  const insertLink = () => {
    if (!link?.trim()) return;
    const { context, range } = linkTarget.current;
    if (context) {
      const label = context.value.slice(context.selectionStart, context.selectionEnd) || "链接文字";
      context.replace(`[${label}](${link.trim()})`);
    } else if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("createLink", false, link.trim());
    }
    setLink(null);
  };
  const change = (patch: Partial<AiFields>) =>
    onChange({ ...draft, fields: { ...f, ...patch }, dirty: true, saveError: undefined });
  return (
    <form
      className="ai-editor ai-page-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!resourceLoading) onSave();
      }}
      onCompositionStart={() => onComposition?.(true)}
      onCompositionEnd={() => onComposition?.(false)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (!busy && !resourceLoading) onSave();
        }
      }}
    >
      <div className="ai-detail-toolbar">
        <span>
          {aiKinds.find((k) => k.key === f.kind)?.label} / {draft.merge ? "整理合并" : draft.id ? "编辑" : "新建"}
        </span>
        <div>
          <span role="status">
            {busy ? "正在保存" : draft.saveError ? "保存未完成" : draft.dirty ? "草稿已暂存" : "已保存"}
          </span>
          <button type="button" onClick={onCancel} disabled={busy}>
            放弃草稿
          </button>
          <button className="ai-primary" type="submit" disabled={busy || resourceLoading}>
            保存内容
          </button>
        </div>
      </div>
      <div className="ai-editor-document">
        <label className="ai-title-label">
          {f.kind === "skill" ? "技能名称" : "标题"}
          <input
            className="ai-title-input"
            required
            autoFocus
            maxLength={f.kind === "skill" ? 64 : 200}
            placeholder={f.kind === "skill" ? "例如：weekly-review" : "未命名内容"}
            value={f.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </label>
        {f.kind === "skill" && (
          <label>
            什么时候使用这个技能
            <textarea
              rows={2}
              required
              maxLength={1024}
              value={f.summary}
              onChange={(e) => change({ summary: e.target.value })}
              placeholder="说明适用场景，帮助 Agent 决定是否加载"
            />
          </label>
        )}
        <details className="ai-properties">
          <summary>
            属性 · {f.project || "全局"} · {(f.sharing ?? "legacy") === "legacy" ? "保留原范围" : "跨 Agent 共享"}
            {f.tags.length ? ` · ${f.tags.length} 个标签` : ""}
          </summary>
          {f.kind !== "skill" && (
            <label>
              一句话摘要
              <textarea rows={2} value={f.summary} onChange={(e) => change({ summary: e.target.value })} />
            </label>
          )}
          <div className="ai-form-grid">
            <label>
              共享范围
              <select
                value={f.sharing ?? "legacy"}
                onChange={(e) =>
                  change({
                    sharing: e.target.value as AiFields["sharing"],
                    ...(e.target.value === "global" ? { project: "" } : {}),
                  })
                }
              >
                <option value="global">全局 · 所有 Agent</option>
                <option value="project">项目 · 所有 Agent</option>
                <option value="legacy">保留原项目与 Agent 范围</option>
              </select>
            </label>
            <label>
              项目
              <input
                value={f.project}
                disabled={f.sharing === "global"}
                onChange={(e) => change({ project: e.target.value })}
                required={f.sharing === "project"}
              />
            </label>
            <label>
              {(f.sharing ?? "legacy") === "legacy" ? "原 Agent 范围" : "Agent 来源"}
              <input value={f.agent} onChange={(e) => change({ agent: e.target.value })} />
            </label>
            <label>
              来源
              <input value={f.source} onChange={(e) => change({ source: e.target.value })} />
            </label>
          </div>
          <label>
            标签
            <input
              value={f.tags.join(", ")}
              onChange={(e) => change({ tags: e.target.value.split(/[,，]/).map((t) => t.trim()) })}
              placeholder="使用逗号分隔"
            />
          </label>
          {f.kind === "memory" && (
            <div className="ai-form-grid">
              <label>
                记忆类型
                <select value={f.memory_type} onChange={(e) => change({ memory_type: e.target.value })}>
                  {[
                    ["preference", "偏好"],
                    ["fact", "事实"],
                    ["context", "背景"],
                    ["decision", "决定"],
                    ["lesson", "经验"],
                    ["procedure", "方法"],
                  ].map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                重要程度
                <select value={f.importance} onChange={(e) => change({ importance: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                有效期
                <input
                  type="date"
                  value={f.expires_at ? new Date(f.expires_at).toLocaleDateString("sv-SE") : ""}
                  onChange={(e) =>
                    change({ expires_at: e.target.value ? new Date(`${e.target.value}T23:59:59`).getTime() : null })
                  }
                />
              </label>
              <label className="ai-checkbox">
                <input type="checkbox" checked={f.pinned} onChange={(e) => change({ pinned: e.target.checked })} />
                置顶记忆
              </label>
            </div>
          )}
        </details>
        <div className="ai-body-controls">
          <span>{f.kind === "skill" ? "操作步骤" : "正文"}</span>
          <button
            type="button"
            aria-pressed={source || !safety.safe}
            onClick={() => setSource(!source)}
            disabled={!safety.safe}
          >
            {source || !safety.safe ? "切换直接编辑" : "源码模式"}
          </button>
        </div>
        {!safety.safe && <p className="ai-muted">{safety.reason}</p>}
        {link !== null && (
          <div className="ai-inline-link">
            <label>
              链接地址
              <input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
            </label>
            <button type="button" onClick={insertLink}>
              插入
            </button>
            <button type="button" onClick={() => setLink(null)}>
              取消
            </button>
          </div>
        )}
        <Suspense fallback={<p role="status">正在准备编辑器…</p>}>
          <div className="ai-shared-editor">
            {source || !safety.safe ? (
              <Source
                value={f.body}
                ariaLabel={f.kind === "skill" ? "操作步骤" : "正文"}
                onChange={(body) => change({ body })}
                onInsertLink={beginLink}
                onStatusMessage={setStatus}
              />
            ) : (
              <Wysiwyg
                source={f.body}
                documentKey={`ai-${draft.key}`}
                ariaLabel={f.kind === "skill" ? "操作步骤" : "正文"}
                onChange={(body) => change({ body })}
                onInsertLink={beginLink}
                onStatusMessage={setStatus}
              />
            )}
          </div>
        </Suspense>
        {status && <p role="status">{status}</p>}
        <AiRelations ids={f.links} ownId={draft.id} onChange={(links) => change({ links })} onPreview={setRelated} />
        {related && (
          <aside className="ai-related-preview" aria-label="关联内容预览">
            <header>
              <h2>{related.title}</h2>
              <button type="button" onClick={() => setRelated(null)}>
                关闭预览
              </button>
            </header>
            <p>{related.source}</p>
            <pre>{related.body}</pre>
          </aside>
        )}
        {f.kind === "skill" && (
          <AiResources
            assets={f.assets}
            onChange={(assets) => change({ assets })}
            onLoading={(value) => {
              setResourceLoading(value);
              onResourceLoading?.(value);
            }}
          />
        )}
        <p className="ai-muted">
          停止输入后自动保存，中文组词期间保留草稿。
          {draft.merge ? "合并需点击保存，原记忆将归档并保留历史。" : "Ctrl+S 立即保存。"}
        </p>
      </div>
    </form>
  );
}
