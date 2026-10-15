import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";

type DraftRecoveryNoticeProps = {
  snapshot: DraftSnapshot;
  onRecover: () => void;
  onLater: () => void;
  onDiscard: () => void;
};

export function DraftRecoveryNotice({ snapshot, onRecover, onLater, onDiscard }: DraftRecoveryNoticeProps) {
  return (
    <div className="external-change-notice draft-recovery-notice" role="status">
      <span>
        <strong>{snapshot.path.split(/[\\/]/).pop() ?? snapshot.path}</strong> 检测到上次未保存的草稿（
        {formatDraftRecoveryTime(snapshot.savedAt)}）。
      </span>
      <div>
        <button type="button" onClick={onRecover}>
          恢复草稿
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
