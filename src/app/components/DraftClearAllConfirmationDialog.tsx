import { useRef } from "react";
import { useModalBehavior } from "./useModalBehavior";

type DraftClearAllConfirmationDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function DraftClearAllConfirmationDialog({ onCancel, onConfirm }: DraftClearAllConfirmationDialogProps) {
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
        aria-labelledby="draft-clear-all-title"
        aria-describedby="draft-clear-all-description"
        tabIndex={-1}
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">CLEAR LOCAL DRAFTS</div>
            <h2 id="draft-clear-all-title">清空全部草稿？</h2>
          </div>
        </header>
        <div className="close-confirm-body">
          <p id="draft-clear-all-description">确定清空全部未保存草稿吗？此操作无法撤销，原文件不会被修改。</p>
        </div>
        <footer className="quick-open-footer close-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="quiet-button"
            data-testid="draft-clear-all-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="draft-clear-all-confirm"
            onClick={onConfirm}
          >
            清空全部草稿
          </button>
        </footer>
      </section>
    </div>
  );
}
