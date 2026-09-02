import type { CSSProperties } from "react";
import { formatReadingDuration, summarizeReadingHistory, type ReadingHistoryEntry } from "../reading-history";

type ReadingHistoryPanelProps = {
  entries: readonly ReadingHistoryEntry[];
  onRequestClear: () => void;
};

export function ReadingHistoryPanel({ entries, onRequestClear }: ReadingHistoryPanelProps) {
  const summary = summarizeReadingHistory(entries);
  const scale = Math.max(1, summary.maxDaySeconds);
  const hasHistory = entries.length > 0;

  return (
    <section className="reading-history-panel" aria-labelledby="reading-history-title">
      <div className="reading-history-heading">
        <div>
          <div className="panel-kicker">THIS WEEK</div>
          <h3 id="reading-history-title">本周阅读</h3>
        </div>
        <span className="reading-history-range">周一—周日</span>
      </div>

      <div
        className="reading-history-metrics"
        aria-label={`本周阅读摘要：${summary.documentCount} 篇文档，累计 ${formatReadingDuration(summary.totalSeconds)}`}
      >
        <div className="reading-history-metric">
          <strong>{summary.documentCount}</strong>
          <span>篇文档</span>
        </div>
        <div className="reading-history-metric">
          <strong>{formatReadingDuration(summary.totalSeconds)}</strong>
          <span>累计时长</span>
        </div>
      </div>

      <div className="reading-history-days" aria-label="本周每日阅读时长">
        {summary.days.map((day) => {
          const percent = day.seconds > 0 ? Math.max(4, Math.round((day.seconds / scale) * 100)) : 0;
          const barStyle = { "--reading-history-bar-height": `${percent}%` } as CSSProperties;
          return (
            <div className={`reading-history-day${day.isToday ? " is-today" : ""}`} key={day.key}>
              <div
                className="reading-history-bar-track"
                role="progressbar"
                aria-label={`${day.key} 阅读时长`}
                aria-valuemin={0}
                aria-valuemax={summary.maxDaySeconds || 1}
                aria-valuenow={day.seconds}
                aria-valuetext={formatReadingDuration(day.seconds)}
              >
                <span className="reading-history-bar" style={barStyle} />
              </div>
              <span className="reading-history-day-label">{day.label}</span>
              <span className="reading-history-day-value">{formatReadingDuration(day.seconds)}</span>
            </div>
          );
        })}
      </div>

      {!hasHistory && (
        <p className="reading-history-empty" role="status">
          还没有本机阅读记录。
        </p>
      )}
      {hasHistory && summary.totalSeconds <= 0 && (
        <p className="reading-history-empty" role="status">
          本周还没有阅读时长。
        </p>
      )}

      <button
        type="button"
        className="quiet-button reading-history-clear"
        data-testid="reading-history-clear"
        onClick={onRequestClear}
        disabled={!hasHistory}
      >
        清理本机记录
      </button>
    </section>
  );
}
