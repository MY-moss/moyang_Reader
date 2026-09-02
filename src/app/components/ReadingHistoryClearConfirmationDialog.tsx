import { useRef } from "react";
import { useModalBehavior } from "./useModalBehavior";

type ReadingHistoryClearConfirmationDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function ReadingHistoryClearConfirmationDialog({
  onCancel,
  onConfirm,
}: ReadingHistoryClearConfirmationDialogProps) {
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
        aria-labelledby="reading-history-clear-title"
        aria-describedby="reading-history-clear-description"
        tabIndex={-1}
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">CLEAR LOCAL READING HISTORY</div>
            <h2 id="reading-history-clear-title">清理阅读记录？</h2>
          </div>
        </header>
        <div className="close-confirm-body">
          <p id="reading-history-clear-description">
            这会删除本机累计阅读时长，原文档、最近打开、阅读位置和草稿不会受到影响。此操作无法撤销。
          </p>
        </div>
        <footer className="quick-open-footer close-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="quiet-button"
            data-testid="reading-history-clear-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="reading-history-clear-confirm"
            onClick={onConfirm}
          >
            清理阅读记录
          </button>
        </footer>
      </section>
    </div>
  );
}
