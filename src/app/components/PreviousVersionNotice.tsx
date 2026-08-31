import { buildDraftComparison } from "../draft-recovery-diff";

type PreviousVersionNoticeProps = {
  path: string;
  currentSource: string;
  previousSource: string;
  onPreview: () => void;
  onDismiss: () => void;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function PreviousVersionNotice({
  path,
  currentSource,
  previousSource,
  onPreview,
  onDismiss,
}: PreviousVersionNoticeProps) {
  const comparison = buildDraftComparison(currentSource, previousSource);
  const characterDelta = comparison.characterDelta > 0 ? `+${comparison.characterDelta}` : comparison.characterDelta;
  const diffSummary = comparison.hasChanges
    ? `上一保存版本：新增 ${comparison.addedLineCount} 行、移除 ${comparison.removedLineCount} 行、${comparison.changeHunkCount} 个变更区域，字符 ${characterDelta}。`
    : "上一保存版本与当前版本内容相同，不需要恢复。";

  return (
    <div className="external-change-notice draft-recovery-notice previous-version-notice" role="status">
      <span className="draft-recovery-copy">
        <strong>{fileName(path)} 保留了上一保存版本</strong>
        <small className="draft-recovery-source-note">
          这是保存前的本机备份，不会自动覆盖当前文件。先查看差异，再决定是否恢复到编辑区。
        </small>
        <small>{diffSummary}</small>
      </span>
      <div>
        <button
          type="button"
          data-testid="previous-version-preview"
          aria-label="查看当前文件与上一保存版本的差异并决定是否恢复"
          onClick={onPreview}
        >
          查看差异
        </button>
        <button type="button" className="notice-dismiss" onClick={onDismiss}>
          忽略
        </button>
      </div>
    </div>
  );
}
