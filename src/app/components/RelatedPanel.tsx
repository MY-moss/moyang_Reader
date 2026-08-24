import type { WorkspaceIndexEntry } from "../types";

type RelatedPanelProps = {
  entry?: WorkspaceIndexEntry;
  backlinks: WorkspaceIndexEntry[];
  outgoing: Array<{ target: string; entry?: WorkspaceIndexEntry }>;
  canCreateNote: boolean;
  selectedTag: string | null;
  onOpenFile: (path: string) => void;
  onCreateNote: (target: string) => void;
  onOpenGraph: () => void;
  onSelectTag: (tag: string | null) => void;
};

export function RelatedPanel({
  entry,
  backlinks,
  outgoing,
  canCreateNote,
  selectedTag,
  onOpenFile,
  onCreateNote,
  onOpenGraph,
  onSelectTag,
}: RelatedPanelProps) {
  if (!entry) return null;

  return (
    <section className="related-panel" aria-labelledby="related-title">
      <div className="related-heading">
        <div>
          <div className="panel-kicker">CONTEXT</div>
          <h2 id="related-title">关联内容</h2>
        </div>
        <button type="button" className="quiet-button" onClick={onOpenGraph}>
          关系图
        </button>
      </div>
      {entry.tags.length > 0 && (
        <div className="tag-list" aria-label="当前文档标签">
          {entry.tags.map((tag) => (
            <button
              type="button"
              className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
              key={tag}
              onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <>
          <div className="related-subheading">出链</div>
          <div className="outgoing-list">
            {outgoing.map(({ target, entry: targetEntry }) =>
              targetEntry ? (
                <button type="button" key={target} onClick={() => onOpenFile(targetEntry.file.path)}>
                  <strong>{targetEntry.title}</strong>
                  <small>{targetEntry.file.relativePath}</small>
                </button>
              ) : (
                <div className="unresolved-link" key={target} title="工作区中没有找到对应 Markdown 文档">
                  <span>
                    <strong>{target}</strong>
                    <small>未找到文档</small>
                  </span>
                  {canCreateNote && (
                    <button type="button" onClick={() => onCreateNote(target)}>
                      创建
                    </button>
                  )}
                </div>
              ),
            )}
          </div>
        </>
      )}
      <div className="related-subheading">反向链接</div>
      {backlinks.length > 0 ? (
        <div className="backlink-list">
          {backlinks.map((item) => (
            <button type="button" key={item.file.path} onClick={() => onOpenFile(item.file.path)}>
              <strong>{item.title}</strong>
              <small>{item.file.relativePath}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-copy">还没有文档链接到这里。</p>
      )}
    </section>
  );
}
