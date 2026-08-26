import { useRef } from "react";
import { useModalBehavior } from "./useModalBehavior";

type DraftDiscardConfirmationDialogProps = {
  path: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function DraftDiscardConfirmationDialog({ path, onCancel, onConfirm }: DraftDiscardConfirmationDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: cancelButtonRef, onClose: onCancel });

  return (
    <div className="quick-open-backdrop close-confirm-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="quick-open-dialog close-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-discard-confirm-title"
        aria-describedby="draft-discard-confirm-description"
        tabIndex={-1}
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">LOCAL RECOVERY</div>
            <h2 id="draft-discard-confirm-title">丢弃草稿？</h2>
          </div>
        </header>
        <div className="close-confirm-body">
          <p id="draft-discard-confirm-description">
            确定丢弃“{fileName(path)}”的本地草稿吗？此操作无法撤销，原文件不会被修改。
          </p>
        </div>
        <footer className="quick-open-footer close-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="quiet-button"
            data-testid="draft-discard-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="draft-discard-confirm"
            onClick={onConfirm}
          >
            丢弃草稿
          </button>
        </footer>
      </section>
    </div>
  );
}
