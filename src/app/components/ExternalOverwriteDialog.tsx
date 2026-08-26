import { useRef } from "react";
import { useModalBehavior } from "./useModalBehavior";

type ExternalOverwriteDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function ExternalOverwriteDialog({ onCancel, onConfirm }: ExternalOverwriteDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: cancelButtonRef, onClose: onCancel });

  return (
    <div className="quick-open-backdrop close-confirm-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="quick-open-dialog close-confirm-dialog external-overwrite-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-overwrite-title"
        aria-describedby="external-overwrite-description"
        tabIndex={-1}
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">EXTERNAL CHANGE</div>
            <h2 id="external-overwrite-title">覆盖外部修改？</h2>
          </div>
        </header>
        <div className="close-confirm-body">
          <p id="external-overwrite-description">
            原文件已经被其他程序修改。确认后，当前编辑会覆盖对方内容；如果不确定，请选择取消后重新载入或另存为。
          </p>
        </div>
        <footer className="quick-open-footer close-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="quiet-button"
            data-testid="external-overwrite-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="external-overwrite-confirm"
            onClick={onConfirm}
          >
            确认覆盖保存
          </button>
        </footer>
      </section>
    </div>
  );
}
