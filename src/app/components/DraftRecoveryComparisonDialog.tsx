import { useRef } from "react";
import { buildDraftComparison, type DraftDiffLine } from "../draft-recovery-diff";
import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import { useModalBehavior } from "./useModalBehavior";

type DraftRecoveryComparisonDialogProps = {
  snapshot: DraftSnapshot;
  comparisonSource: string | null;
  comparisonLabel: string;
  comparisonIsCurrent: boolean;
  comparisonStatus: "loading" | "ready" | "unavailable";
  comparisonError: string | null;
  currentDocumentModified: boolean;
  sourceChangedSinceDraft: boolean;
  actionLabel: string;
  onAction: () => void;
  onRetry?: () => void;
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

function recoveryDecision(
  comparison: ReturnType<typeof buildDraftComparison> | null,
  comparisonStatus: DraftRecoveryComparisonDialogProps["comparisonStatus"],
  comparisonIsCurrent: boolean,
  sourceChangedSinceDraft: boolean,
): { tone: "neutral" | "ready" | "warning"; title: string; description: string } {
  if (comparisonStatus === "loading") {
    return {
      tone: "neutral",
      title: "正在读取当前版本",
      description: "正在读取此刻的磁盘文件；读取完成前不会允许恢复。",
    };
  }
  if (comparisonStatus === "unavailable" || !comparison) {
    return {
      tone: "warning",
      title: "无法判断是否需要恢复",
      description: "当前文件无法读取，暂时不能可靠比较，也不会直接恢复草稿。",
    };
  }
  if (!comparisonIsCurrent) {
    return {
      tone: "warning",
      title: "还需要核对当前文件",
      description: "这里只能与草稿保存时的原文比较；打开当前文件后再决定是否恢复。",
    };
  }
  if (!comparison.hasChanges) {
    return {
      tone: "neutral",
      title: "无需恢复",
      description: "草稿与当前版本内容相同，不需要恢复。",
    };
  }
  if (sourceChangedSinceDraft) {
    return {
      tone: "warning",
      title: "建议先核对",
      description: "草稿保存后原文件又发生了变化；请确认两边内容后，再恢复到编辑区。",
    };
  }
  return {
    tone: "ready",
    title: "存在未保存内容",
    description: "如果这些内容需要保留，可以恢复到编辑区；点击“保存”后才会写回原文件。",
  };
}

export function DraftRecoveryComparisonDialog({
  snapshot,
  comparisonSource,
  comparisonLabel,
  comparisonIsCurrent,
  comparisonStatus,
  comparisonError,
  currentDocumentModified,
  sourceChangedSinceDraft,
  actionLabel,
  onAction,
  onRetry,
  onClose,
}: DraftRecoveryComparisonDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const comparison =
    comparisonStatus === "ready" && comparisonSource !== null
      ? buildDraftComparison(comparisonSource, snapshot.draft)
      : null;
  const decision = recoveryDecision(comparison, comparisonStatus, comparisonIsCurrent, sourceChangedSinceDraft);

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
            <strong>当前版本</strong>是此刻可读取的文件内容，<strong>草稿</strong>是保存在本机的未保存快照。
            当前比较基线：<strong>{comparisonLabel}</strong>
            。恢复只会替换当前编辑区，确认后仍需点击“保存”才会写回原文件。
          </p>

          <div className="draft-comparison-sources" aria-label="当前版本与草稿来源">
            <div className="draft-comparison-source current">
              <strong>当前版本</strong>
              <span>{comparisonLabel}</span>
            </div>
            <div className="draft-comparison-source draft">
              <strong>草稿</strong>
              <span>本机恢复快照 · {formatDraftRecoveryTime(snapshot.savedAt)}</span>
            </div>
          </div>

          <div className="draft-comparison-key" aria-label="差异符号说明">
            <span>
              <b className="removed" aria-hidden="true">
                −
              </b>
              当前版本有、草稿中移除
            </span>
            <span>
              <b className="added" aria-hidden="true">
                +
              </b>
              草稿新增
            </span>
          </div>

          <div className={`draft-comparison-decision ${decision.tone}`} data-testid="draft-comparison-decision">
            <strong>{decision.title}</strong>
            <span>{decision.description}</span>
          </div>

          {comparison && (
            <div className="draft-comparison-stats" aria-label="草稿变更摘要">
              <div>
                <span>{comparisonIsCurrent ? "当前版本行" : "比较基线行"}</span>
                <strong>{comparison.baselineLineCount}</strong>
              </div>
              <div>
                <span>草稿行</span>
                <strong>{comparison.draftLineCount}</strong>
              </div>
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
                <span>变更区域</span>
                <strong>{comparison.changeHunkCount}</strong>
              </div>
              <div>
                <span>草稿保存</span>
                <strong>{formatDraftRecoveryTime(snapshot.savedAt)}</strong>
              </div>
            </div>
          )}

          {comparisonStatus === "loading" && (
            <div className="draft-comparison-state" data-testid="draft-comparison-loading" role="status">
              正在读取当前磁盘版本…
            </div>
          )}
          {comparisonStatus === "unavailable" && (
            <div className="draft-comparison-state error" data-testid="draft-comparison-error" role="alert">
              <strong>无法判断当前差异</strong>
              <span>{comparisonError || "当前文件不可访问，请确认文件仍存在且有读取权限。"}</span>
              {onRetry && (
                <button type="button" className="quiet-button" data-testid="draft-comparison-retry" onClick={onRetry}>
                  重新读取当前版本
                </button>
              )}
            </div>
          )}

          {currentDocumentModified && comparisonIsCurrent && (
            <div className="draft-comparison-warning" role="alert">
              当前编辑区还有未保存修改；恢复会替换这些修改，但不会自动覆盖磁盘文件。
            </div>
          )}
          {sourceChangedSinceDraft && comparisonIsCurrent && (
            <div className="draft-comparison-warning" role="note">
              原文件在草稿保存后又发生过变化，以上差异已按当前磁盘版本计算。
            </div>
          )}
          {comparisonStatus === "ready" && !comparisonIsCurrent && (
            <div className="draft-comparison-warning" role="note">
              当前文件尚未在这里读取；以上内容只与草稿保存时的原文比较，不能代表此刻磁盘文件的完整差异。
            </div>
          )}

          {comparison && (
            <>
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
              {comparison.truncated && (
                <p className="draft-comparison-footnote">文档较长，仅显示差异附近的有限内容。</p>
              )}
              {!comparison.precise && (
                <p className="draft-comparison-footnote">
                  文档较长，已使用快速差异摘要；恢复前建议打开编辑区再次确认全文。
                </p>
              )}
            </>
          )}
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
            disabled={!comparison || !comparison.hasChanges || comparisonStatus !== "ready"}
          >
            {comparisonStatus === "loading"
              ? "正在读取…"
              : comparisonStatus === "unavailable"
                ? "暂不可恢复"
                : actionLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
