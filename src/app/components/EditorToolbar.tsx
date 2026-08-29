import type { EditorContextAction } from "../editor-context-menu";
import type { EditorInsertKind } from "../editor-insertion";

type EditorToolbarProps = {
  canUndo: boolean;
  canRedo: boolean;
  onAction: (action: EditorContextAction) => void;
  onInsert: (kind: EditorInsertKind) => void;
};

const paragraphOptions: readonly { action: EditorContextAction; label: string }[] = [
  { action: "paragraph", label: "正文段落" },
  { action: "heading-1", label: "标题 1" },
  { action: "heading-2", label: "标题 2" },
  { action: "heading-3", label: "标题 3" },
  { action: "bullet-list", label: "无序列表" },
  { action: "ordered-list", label: "有序列表" },
  { action: "quote", label: "引用" },
  { action: "code-block", label: "代码块" },
  { action: "task-list", label: "任务列表" },
];

const formatButtons: readonly { action: EditorContextAction; label: string; shortLabel: string }[] = [
  { action: "bold", label: "粗体", shortLabel: "B" },
  { action: "italic", label: "斜体", shortLabel: "I" },
  { action: "strike", label: "删除线", shortLabel: "S" },
  { action: "inline-code", label: "行内代码", shortLabel: "<>" },
];

export function EditorToolbar({ canUndo, canRedo, onAction, onInsert }: EditorToolbarProps) {
  return (
    <div className="editor-format-toolbar" role="toolbar" aria-label="编辑工具栏">
      <div className="editor-toolbar-group" aria-label="历史记录">
        <button
          type="button"
          className="editor-toolbar-button editor-toolbar-button-icon"
          aria-label="撤销"
          title="撤销 (Ctrl+Z)"
          disabled={!canUndo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction("undo")}
        >
          ↶
        </button>
        <button
          type="button"
          className="editor-toolbar-button editor-toolbar-button-icon"
          aria-label="重做"
          title="重做 (Ctrl+Y)"
          disabled={!canRedo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction("redo")}
        >
          ↷
        </button>
      </div>

      <span className="editor-toolbar-divider" aria-hidden="true" />

      <div className="editor-toolbar-group" aria-label="文字格式">
        {formatButtons.map((item) => (
          <button
            key={item.action}
            type="button"
            className="editor-toolbar-button editor-toolbar-format-button"
            aria-label={item.label}
            title={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onAction(item.action)}
          >
            {item.shortLabel}
          </button>
        ))}
        <button
          type="button"
          className="editor-toolbar-button editor-toolbar-button-wide"
          aria-label="清除格式"
          title="清除格式"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction("clear-format")}
        >
          清除
        </button>
      </div>

      <span className="editor-toolbar-divider" aria-hidden="true" />

      <label className="editor-toolbar-select-wrap">
        <span className="sr-only">段落样式</span>
        <select
          className="editor-toolbar-select"
          aria-label="段落样式"
          defaultValue=""
          onChange={(event) => {
            const selected = paragraphOptions.find((item) => item.action === event.target.value);
            if (selected) onAction(selected.action);
            event.currentTarget.value = "";
          }}
        >
          <option value="" disabled>
            段落样式
          </option>
          {paragraphOptions.map((item) => (
            <option key={item.action} value={item.action}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="editor-toolbar-spacer" />

      <button
        type="button"
        className="editor-toolbar-button editor-toolbar-insert-button"
        aria-label="插入"
        title="插入链接、双链、图片或表格"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onInsert("link")}
      >
        <span aria-hidden="true">＋</span>
        插入
      </button>
    </div>
  );
}
