type ReadingRailProps = {
  progress: number;
  currentHeading: string | null;
  headingCount: number;
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
};

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function ReadingRail({
  progress,
  currentHeading,
  headingCount,
  onScrollToTop,
  onScrollToBottom,
}: ReadingRailProps) {
  const safeProgress = clampProgress(progress);
  const percentage = Math.round(safeProgress * 100);

  return (
    <aside className="reading-rail" aria-label="阅读进度">
      <div className="reading-rail-card">
        <div className="panel-kicker">READING</div>
        <div className="reading-progress-value">
          <strong>{percentage}%</strong>
          <span>已读</span>
        </div>
        <div
          className="reading-progress-track"
          role="progressbar"
          aria-label="文档阅读进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <span style={{ width: `${percentage}%` }} />
        </div>
        <p className="reading-current-heading" title={currentHeading ?? undefined}>
          {currentHeading ?? "文档开始"}
        </p>
        {headingCount > 0 && <small className="reading-heading-count">{headingCount} 个章节</small>}
      </div>
      <div className="reading-rail-actions" aria-label="阅读位置">
        <button type="button" onClick={onScrollToTop} title="回到文档顶部">
          顶部
        </button>
        <button type="button" onClick={onScrollToBottom} title="跳到文档末尾">
          末尾
        </button>
      </div>
    </aside>
  );
}
