import { useRef, useState } from "react";
import { useModalBehavior } from "./useModalBehavior";

type AnnotationDialogProps = {
  quote: string;
  onCancel: () => void;
  onSave: (note: string) => void;
};

export function AnnotationDialog({ quote, onCancel, onSave }: AnnotationDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: noteRef, onClose: onCancel });

  return (
    <div
      className="quick-open-backdrop annotation-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="quick-open-dialog annotation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="annotation-dialog-title"
        tabIndex={-1}
      >
        <div className="quick-open-header">
          <div>
            <div className="panel-kicker">READING MARK</div>
            <h2 id="annotation-dialog-title">添加高亮 / 批注</h2>
          </div>
          <button type="button" className="panel-close-button" onClick={onCancel} aria-label="取消添加批注">
            ×
          </button>
        </div>
        <div className="annotation-dialog-body">
          <p className="annotation-dialog-label">选中文本</p>
          <blockquote className="annotation-quote">{quote}</blockquote>
          <label className="annotation-note-label">
            <span>备注（可选）</span>
            <textarea
              ref={noteRef}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="写下你的想法，稍后可从右侧批注面板回到这里。"
              rows={4}
            />
          </label>
        </div>
        <div className="annotation-dialog-actions">
          <button type="button" className="quiet-button" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="toolbar-button primary" onClick={() => onSave(note.trim())}>
            保存批注
          </button>
        </div>
      </section>
    </div>
  );
}
