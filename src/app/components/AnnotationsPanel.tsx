import type { TextAnnotation } from "../annotations";
import type { AnnotationLocation } from "../annotation-highlighter";
import { normalizePathKey } from "../path-key";

type AnnotationsPanelProps = {
  annotations: TextAnnotation[];
  locations: readonly AnnotationLocation[];
  currentPath?: string | null;
  enabled: boolean;
  onOpen: (annotation: TextAnnotation) => void;
  onDelete: (annotation: TextAnnotation) => void;
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function annotationStatus(
  annotation: TextAnnotation,
  currentPath: string | null | undefined,
  locations: Map<string, AnnotationLocation>,
): string {
  const isCurrent = Boolean(currentPath && normalizePathKey(annotation.path) === normalizePathKey(currentPath));
  if (!isCurrent) return "打开后定位";
  return locations.get(annotation.id)?.status === "located" ? "当前文档" : "待定位";
}

export function AnnotationsPanel({
  annotations,
  locations,
  currentPath,
  enabled,
  onOpen,
  onDelete,
}: AnnotationsPanelProps) {
  const locationById = new Map(locations.map((location) => [location.annotation.id, location]));
  const sortedAnnotations = [...annotations].sort((left, right) => right.updatedAt - left.updatedAt);

  return (
    <section className="annotations-panel" aria-labelledby="context-annotations-title">
      <div className="panel-kicker">READING MARKS</div>
      <div className="annotations-panel-heading">
        <h3 id="context-annotations-title">高亮与批注</h3>
        <span className="annotations-count" aria-label={`${annotations.length} 条批注`}>
          {annotations.length}
        </span>
      </div>
      <p className="annotations-panel-intro">
        {enabled
          ? "高亮和备注保存在工作区 .moyang sidecar 中，不会改动 Markdown 正文。"
          : "阅读批注已关闭。可在设置中重新启用。"}
      </p>

      {enabled && annotations.length === 0 ? (
        <p className="annotations-empty">还没有批注。在正文中选中文字后右键，选择“高亮 / 批注”。</p>
      ) : enabled ? (
        <ul className="annotation-list">
          {sortedAnnotations.map((annotation) => {
            const status = annotationStatus(annotation, currentPath, locationById);
            const label = `${fileNameFromPath(annotation.path)} · ${annotation.quote}`;
            return (
              <li key={annotation.id} className={`annotation-item${status === "当前文档" ? " current" : ""}`}>
                <button
                  type="button"
                  className="annotation-open"
                  onClick={() => onOpen(annotation)}
                  aria-label={`打开批注：${label}`}
                >
                  <span className="annotation-mark" aria-hidden="true">
                    ✦
                  </span>
                  <span className="annotation-copy">
                    <strong title={annotation.path}>{fileNameFromPath(annotation.path)}</strong>
                    <small className="annotation-quote-inline" title={annotation.quote}>
                      “{annotation.quote}”
                    </small>
                    {annotation.note && <span title={annotation.note}>{annotation.note}</span>}
                    <small className={`annotation-status annotation-status-${status === "待定位" ? "stale" : "ready"}`}>
                      {status}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  className="annotation-delete"
                  onClick={() => onDelete(annotation)}
                  aria-label={`删除批注：${label}`}
                  title="删除批注"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
