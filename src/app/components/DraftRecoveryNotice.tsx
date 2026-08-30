import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import { buildDraftComparison } from "../draft-recovery-diff";

type DraftRecoveryNoticeProps = {
  snapshot: DraftSnapshot;
  currentSource: string;
  onPreview: () => void;
  onLater: () => void;
  onDiscard: () => void;
};

export function DraftRecoveryNotice({
  snapshot,
  currentSource,
  onPreview,
  onLater,
  onDiscard,
}: DraftRecoveryNoticeProps) {
  const comparison = buildDraftComparison(currentSource, snapshot.draft);
  const characterDelta = comparison.characterDelta > 0 ? `+${comparison.characterDelta}` : comparison.characterDelta;
  const diffSummary = comparison.hasChanges
    ? `相比当前版本：新增 ${comparison.addedLineCount} 行、移除 ${comparison.removedLineCount} 行、${comparison.changeHunkCount} 个变更区域，字符 ${characterDelta}。`
    : "草稿与当前版本内容相同，不需要恢复。";

  return (
    <div className="external-change-notice draft-recovery-notice" role="status">
      <span className="draft-recovery-copy">
        <strong>{snapshot.path.split(/[\\/]/).pop() ?? snapshot.path}</strong> 检测到上次未保存的草稿（
        {formatDraftRecoveryTime(snapshot.savedAt)}）。
        <small className="draft-recovery-source-note">
          当前打开的是文件版本；草稿保存在本机。先查看差异，再决定是否恢复。
        </small>
        <small>{diffSummary}</small>
      </span>
      <div>
        <button
          type="button"
          data-testid="draft-recovery-preview"
          aria-label="查看当前文件与草稿的差异并决定是否恢复"
          onClick={onPreview}
        >
          查看差异
        </button>
        <button type="button" className="notice-dismiss" onClick={onLater}>
          稍后处理
        </button>
        <button type="button" className="notice-dismiss" onClick={onDiscard}>
          丢弃
        </button>
      </div>
    </div>
  );
}
