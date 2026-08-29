import { useRef } from "react";
import { buildDraftComparison, type DraftDiffLine } from "../draft-recovery-diff";
import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import { useModalBehavior } from "./useModalBehavior";

type DraftRecoveryComparisonDialogProps = {
  snapshot: DraftSnapshot;
  comparisonSource: string;
  comparisonLabel: string;
  currentDocumentModified: boolean;
  sourceChangedSinceDraft: boolean;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function diffPrefix(line: DraftDiffLine): string {
  if (line.kind === "added") return "+";
  if (line.kind === "removed") return "−";
  if (line.kind === "notice") return "·";
  return " ";
}

export function DraftRecoveryComparisonDialog({
  snapshot,
  comparisonSource,
  comparisonLabel,
  currentDocumentModified,
  sourceChangedSinceDraft,
  actionLabel,
  onAction,
  onClose,
}: DraftRecoveryComparisonDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const comparison = buildDraftComparison(comparisonSource, snapshot.draft);
  const isCurrentDocument = comparisonLabel === "当前磁盘版本";

  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });

  return (
    <div className="quick-open-backdrop draft-comparison-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="quick-open-dialog draft-comparison-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-comparison-title"
        aria-describedby="draft-comparison-description"
        tabIndex={-1}
      >
        <header className="quick-open-header draft-comparison-header">
          <div>
            <div className="quick-open-kicker">LOCAL RECOVERY</div>
            <h2 id="draft-comparison-title">恢复前查看差异</h2>
            <p className="draft-comparison-file" title={snapshot.path}>
              {fileName(snapshot.path)}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="quiet-button"
            onClick={onClose}
            aria-label="关闭草稿差异"
          >
            关闭
          </button>
        </header>

        <div className="draft-comparison-body">
          <p id="draft-comparison-description" className="draft-comparison-intro">
            下面是草稿与<strong>{comparisonLabel}</strong>
            的差异。恢复只会替换当前编辑区，确认后仍需点击“保存”才会写回原文件。
          </p>

          <div className="draft-comparison-stats" aria-label="草稿变更摘要">
            <div>
              <span>新增行</span>
              <strong className="draft-comparison-added">+{comparison.addedLineCount}</strong>
            </div>
            <div>
              <span>移除行</span>
              <strong className="draft-comparison-removed">−{comparison.removedLineCount}</strong>
            </div>
            <div>
              <span>字符变化</span>
              <strong>{signedNumber(comparison.characterDelta)}</strong>
            </div>
            <div>
              <span>草稿保存</span>
              <strong>{formatDraftRecoveryTime(snapshot.savedAt)}</strong>
            </div>
          </div>

          {currentDocumentModified && isCurrentDocument && (
            <div className="draft-comparison-warning" role="alert">
              当前编辑区还有未保存修改；恢复会替换这些修改，但不会自动覆盖磁盘文件。
            </div>
          )}
          {sourceChangedSinceDraft && isCurrentDocument && (
            <div className="draft-comparison-warning" role="note">
              原文件在草稿保存后又发生过变化，以上差异已按当前磁盘版本计算。
            </div>
          )}

          <div className="draft-comparison-preview" aria-label="草稿差异预览">
            {comparison.preview.length > 0 ? (
              comparison.preview.map((line, index) => (
                <div
                  key={`${line.kind}-${line.lineNumber ?? "notice"}-${index}`}
                  className={`draft-diff-line ${line.kind}`}
                >
                  <span className="draft-diff-marker" aria-hidden="true">
                    {diffPrefix(line)}
                  </span>
                  <span className="draft-diff-line-number" aria-hidden="true">
                    {line.lineNumber ?? ""}
                  </span>
                  <span className="draft-diff-text">{line.text || " "}</span>
                </div>
              ))
            ) : (
              <div className="draft-comparison-empty">当前版本与草稿没有可见差异，不需要恢复。</div>
            )}
          </div>
          {comparison.truncated && <p className="draft-comparison-footnote">文档较长，仅显示差异附近的有限内容。</p>}
        </div>

        <footer className="quick-open-footer draft-comparison-actions">
          <button type="button" className="quiet-button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="draft-comparison-action"
            onClick={onAction}
            disabled={!comparison.hasChanges}
          >
            {actionLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
