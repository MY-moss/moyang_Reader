import { useRef } from "react";
import { useModalBehavior } from "../../../shared/components/useModalBehavior";
import { formatDraftRecoveryTime, type DraftSummary } from "../draft-recovery";

type DraftRecoveryCenterProps = {
  snapshots: DraftSummary[];
  onOpen: (path: string) => void;
  onDiscard: (path: string) => void;
  onClearAll: () => void;
  onClose: () => void;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function draftPreview(draft: string): string {
  const preview = draft.replace(/\s+/g, " ").trim();
  return preview.length > 100 ? `${preview.slice(0, 100)}…` : preview || "（空文档）";
}

export function DraftRecoveryCenter({ snapshots, onOpen, onDiscard, onClearAll, onClose }: DraftRecoveryCenterProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });

  return (
    <div
      className="quick-open-backdrop draft-recovery-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="quick-open-dialog draft-recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-recovery-title"
        tabIndex={-1}
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">LOCAL RECOVERY</div>
            <h2 id="draft-recovery-title">未保存草稿</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="quiet-button"
            onClick={onClose}
            aria-label="关闭草稿恢复中心"
          >
            关闭
          </button>
        </header>
        <div className="draft-recovery-list">
          {snapshots.map((snapshot) => (
            <div className="draft-recovery-item" key={snapshot.path}>
              <button
                type="button"
                className="draft-recovery-open"
                onClick={() => onOpen(snapshot.path)}
                aria-label={`打开 ${fileName(snapshot.path)} 草稿`}
              >
                <strong>{fileName(snapshot.path)}</strong>
                <span title={snapshot.path}>{snapshot.path}</span>
                <small>
                  {formatDraftRecoveryTime(snapshot.savedAt)} · {draftPreview(snapshot.preview)}
                </small>
              </button>
              <button
                type="button"
                className="draft-recovery-discard"
                onClick={() => onDiscard(snapshot.path)}
                aria-label={`丢弃 ${fileName(snapshot.path)} 草稿`}
              >
                丢弃
              </button>
            </div>
          ))}
        </div>
        <footer className="quick-open-footer draft-recovery-footer">
          <span>草稿逐篇保存在本机，不会上传正文。</span>
          <button type="button" className="quiet-button" onClick={onClearAll}>
            清空全部
          </button>
        </footer>
      </section>
    </div>
  );
}
