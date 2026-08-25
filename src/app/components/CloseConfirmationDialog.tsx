import { useEffect, useRef } from "react";

type CloseConfirmationDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function CloseConfirmationDialog({ onCancel, onConfirm }: CloseConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onCancel]);

  return (
    <div className="quick-open-backdrop close-confirm-backdrop" role="presentation">
      <section
        className="quick-open-dialog close-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-confirm-title"
        aria-describedby="close-confirm-description"
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">UNSAVED CHANGES</div>
            <h2 id="close-confirm-title">退出 Moyang Reader？</h2>
          </div>
        </header>
        <div className="close-confirm-body">
          <p id="close-confirm-description">当前文档有未保存修改。确认退出后，这些修改不会写回原文件。</p>
        </div>
        <footer className="quick-open-footer close-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="quiet-button"
            data-testid="close-confirm-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="close-confirm-confirm"
            onClick={onConfirm}
          >
            退出 Moyang Reader
          </button>
        </footer>
      </section>
    </div>
  );
}
