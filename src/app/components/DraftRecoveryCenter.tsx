import { useRef } from "react";
import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import { buildDraftComparison } from "../draft-recovery-diff";
import { isSameDocumentPath } from "../document-transition";
import { useModalBehavior } from "./useModalBehavior";

type DraftRecoveryCenterProps = {
  snapshots: DraftSnapshot[];
  onOpen: (path: string) => void;
  onPreview: (path: string) => void;
  onDiscard: (path: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  activeDocumentPath?: string | null;
  activeDocumentSource?: string | null;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function draftPreview(draft: string): string {
  const preview = draft.replace(/\s+/g, " ").trim();
  return preview.length > 100 ? `${preview.slice(0, 100)}…` : preview || "（空文档）";
}

export function DraftRecoveryCenter({
  snapshots,
  onOpen,
  onPreview,
  onDiscard,
  onClearAll,
  onClose,
  activeDocumentPath,
  activeDocumentSource,
}: DraftRecoveryCenterProps) {
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
              {(() => {
                const isCurrentDocument = Boolean(
                  activeDocumentPath && isSameDocumentPath(activeDocumentPath, snapshot.path),
                );
                const currentComparison =
                  isCurrentDocument && activeDocumentSource !== null && activeDocumentSource !== undefined
                    ? buildDraftComparison(activeDocumentSource, snapshot.draft)
                    : null;
                const characterDelta =
                  currentComparison && currentComparison.characterDelta > 0
                    ? `+${currentComparison.characterDelta}`
                    : (currentComparison?.characterDelta ?? 0);
                const diffSummary = currentComparison
                  ? currentComparison.hasChanges
                    ? `已打开内容差异：+${currentComparison.addedLineCount} 行 / −${currentComparison.removedLineCount} 行 · ${currentComparison.changeHunkCount} 个区域 · 字符 ${characterDelta}${currentComparison.precise ? "" : " · 快速摘要"}`
                    : "已打开内容与草稿相同 · 无需恢复"
                  : "查看差异时将读取当前文件 · 不会自动恢复";

                return (
                  <>
                    <button
                      type="button"
                      className="draft-recovery-open"
                      onClick={() => onOpen(snapshot.path)}
                      aria-label={`打开 ${fileName(snapshot.path)} 的当前文件（不会自动恢复草稿）`}
                    >
                      <strong>{fileName(snapshot.path)}</strong>
                      <span title={snapshot.path}>{snapshot.path}</span>
                      <small>
                        {formatDraftRecoveryTime(snapshot.savedAt)} · {draftPreview(snapshot.draft)}
                      </small>
                      <small className="draft-recovery-source-note">当前文件 · 不会自动恢复草稿</small>
                      <small className="draft-recovery-diff-summary">{diffSummary}</small>
                    </button>
                    <div className="draft-recovery-actions">
                      <button
                        type="button"
                        className="draft-recovery-preview"
                        onClick={() => onPreview(snapshot.path)}
                        aria-label={`查看 ${fileName(snapshot.path)} 当前文件与草稿的差异`}
                      >
                        查看差异
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
                  </>
                );
              })()}
            </div>
          ))}
        </div>
        <footer className="quick-open-footer draft-recovery-footer">
          <span>先查看当前文件与草稿的差异，再决定是否恢复；恢复只进入编辑区，点击“保存”后才写回文件。</span>
          <button type="button" className="quiet-button" onClick={onClearAll}>
            清空全部
          </button>
        </footer>
      </section>
    </div>
  );
}
