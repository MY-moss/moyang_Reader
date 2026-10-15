import { checkMarkdownEditorSafety } from "../../features/editor/markdown-editor-support";
import type { ReaderApplication } from "../useReaderApplication";

export function DocumentActions({
  model: m,
  children,
}: {
  children?: import("react").ReactNode;
  model: Pick<
    ReaderApplication,
    | "documentState"
    | "mode"
    | "canEdit"
    | "setMode"
    | "sourceDraft"
    | "setSettingsNotice"
    | "saveDocument"
    | "canUndo"
    | "canRedo"
    | "undoEditor"
    | "redoEditor"
    | "saveState"
  >;
}) {
  if (!m.documentState) return null;
  const edit = () => {
    const safe = m.documentState?.kind === "markdown" && checkMarkdownEditorSafety(m.sourceDraft).safe;
    m.setMode(safe ? "wysiwyg" : "source");
    if (!safe && m.documentState?.kind === "markdown")
      m.setSettingsNotice("该文档包含需要保留的特殊格式，已打开源文本编辑。");
  };
  return (
    <div className="document-actions" aria-label="当前文档工具">
      <div className="document-mode-switch" role="group" aria-label="阅读与编辑方式">
        <button
          aria-label={m.mode !== "rendered" ? "直接返回阅读模式" : "阅读模式"}
          aria-pressed={m.mode === "rendered"}
          onClick={() => m.setMode("rendered")}
        >
          阅读
        </button>
        {m.canEdit && (
          <button
            aria-label={m.mode === "rendered" ? "直接进入编辑模式" : "编辑模式"}
            aria-pressed={m.mode === "wysiwyg" || (m.documentState.kind === "text" && m.mode === "source")}
            onClick={edit}
          >
            编辑
          </button>
        )}
        {m.canEdit && m.documentState.kind === "markdown" && (
          <button aria-label="源文本模式" aria-pressed={m.mode === "source"} onClick={() => m.setMode("source")}>
            源文本
          </button>
        )}
      </div>
      <span className="document-action-hint">
        {m.mode === "rendered" ? "安心阅读" : m.documentState.modified ? "有未保存修改" : "内容已保存"}
      </span>
      {children}
      {m.mode !== "rendered" && (
        <div className="document-edit-actions">
          <button
            className="quiet-button"
            onClick={() => m.undoEditor()}
            disabled={!m.canUndo}
            aria-label="撤销"
            title="撤销 (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className="quiet-button"
            onClick={() => m.redoEditor()}
            disabled={!m.canRedo}
            aria-label="重做"
            title="重做 (Ctrl+Y)"
          >
            ↷
          </button>
        </div>
      )}
      {m.documentState.modified && (
        <button
          className="toolbar-button primary"
          disabled={m.saveState?.status === "saving"}
          onClick={() => void m.saveDocument()}
          title="保存 (Ctrl+S)"
        >
          {m.saveState?.status === "saving" ? "保存中…" : "保存"}
        </button>
      )}
    </div>
  );
}
