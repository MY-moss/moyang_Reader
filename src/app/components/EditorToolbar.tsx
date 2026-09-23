import type { EditorContextAction } from "../editor-context-menu";
import type { EditorInsertKind } from "../editor-insertion";
import { Icon } from "./Icon";
import type { Locale } from "../i18n";
import { editorText } from "../editor-i18n";

type EditorToolbarProps = {
  locale?: Locale;
  canUndo: boolean;
  canRedo: boolean;
  onAction: (action: EditorContextAction) => void;
  onInsert: (kind: EditorInsertKind) => void;
};

const paragraphOptions: readonly { action: EditorContextAction; labelKey: Parameters<typeof editorText>[1] }[] = [
  { action: "paragraph", labelKey: "paragraphText" },
  { action: "heading-1", labelKey: "heading1" },
  { action: "heading-2", labelKey: "heading2" },
  { action: "heading-3", labelKey: "heading3" },
  { action: "bullet-list", labelKey: "bulletList" },
  { action: "ordered-list", labelKey: "orderedList" },
  { action: "quote", labelKey: "quote" },
  { action: "code-block", labelKey: "codeBlock" },
  { action: "task-list", labelKey: "taskList" },
];

const formatButtons: readonly {
  action: EditorContextAction;
  labelKey: Parameters<typeof editorText>[1];
  shortLabel: string;
}[] = [
  { action: "bold", labelKey: "bold", shortLabel: "B" },
  { action: "italic", labelKey: "italic", shortLabel: "I" },
  { action: "strike", labelKey: "strike", shortLabel: "S" },
  { action: "inline-code", labelKey: "inlineCode", shortLabel: "<>" },
];

export function EditorToolbar({ locale = "zh-CN", canUndo, canRedo, onAction, onInsert }: EditorToolbarProps) {
  const t = (key: Parameters<typeof editorText>[1]) => editorText(locale, key);
  return (
    <div className="editor-format-toolbar" role="toolbar" aria-label={t("toolbar")}>
      <div className="editor-toolbar-group" aria-label={t("history")}>
        <button
          type="button"
          className="editor-toolbar-button editor-toolbar-button-icon"
          aria-label={t("undo")}
          title={`${t("undo")} (Ctrl+Z)`}
          disabled={!canUndo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction("undo")}
        >
          <Icon name="undo" size={16} />
        </button>
        <button
          type="button"
          className="editor-toolbar-button editor-toolbar-button-icon"
          aria-label={t("redo")}
          title={`${t("redo")} (Ctrl+Y)`}
          disabled={!canRedo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction("redo")}
        >
          <Icon name="redo" size={16} />
        </button>
      </div>

      <span className="editor-toolbar-divider" aria-hidden="true" />

      <div className="editor-toolbar-group" aria-label={t("formatting")}>
        {formatButtons.map((item) => (
          <button
            key={item.action}
            type="button"
            className="editor-toolbar-button editor-toolbar-format-button"
            aria-label={t(item.labelKey)}
            title={t(item.labelKey)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onAction(item.action)}
          >
            {item.shortLabel}
          </button>
        ))}
        <button
          type="button"
          className="editor-toolbar-button editor-toolbar-button-wide"
          aria-label={t("clear")}
          title={t("clear")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAction("clear-format")}
        >
          {t("clearShort")}
        </button>
      </div>

      <span className="editor-toolbar-divider" aria-hidden="true" />

      <label className="editor-toolbar-select-wrap">
        <span className="sr-only">{t("paragraphStyle")}</span>
        <select
          className="editor-toolbar-select"
          aria-label={t("paragraphStyle")}
          defaultValue=""
          onChange={(event) => {
            const selected = paragraphOptions.find((item) => item.action === event.target.value);
            if (selected) onAction(selected.action);
            event.currentTarget.value = "";
          }}
        >
          <option value="" disabled>
            {t("paragraphStyle")}
          </option>
          {paragraphOptions.map((item) => (
            <option key={item.action} value={item.action}>
              {t(item.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <div className="editor-toolbar-spacer" />

      <button
        type="button"
        className="editor-toolbar-button editor-toolbar-insert-button"
        aria-label={t("insert")}
        title={t("insertHint")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onInsert("link")}
      >
        <Icon name="plus" size={16} />
        {t("insert")}
      </button>
    </div>
  );
}
