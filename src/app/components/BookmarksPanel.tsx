import { bookmarkIdentity, type DocumentBookmark } from "../bookmarks";
import { normalizePathKey } from "../path-key";

type BookmarksPanelProps = {
  bookmarks: DocumentBookmark[];
  knownPaths?: string[];
  currentPath?: string | null;
  currentHeadingId?: string | null;
  onOpen: (bookmark: DocumentBookmark) => void;
  onDelete: (bookmark: DocumentBookmark) => void;
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function bookmarkLabel(bookmark: DocumentBookmark): string {
  const fileName = fileNameFromPath(bookmark.path);
  const location = bookmark.headingId ? `#${bookmark.headingId}` : "文档开头";
  return `${fileName} · ${location}`;
}

function isCurrentBookmark(
  bookmark: DocumentBookmark,
  currentPath: string | null | undefined,
  currentHeadingId: string | null | undefined,
): boolean {
  if (!currentPath || normalizePathKey(bookmark.path) !== normalizePathKey(currentPath)) return false;
  return (bookmark.headingId ?? null) === (currentHeadingId ?? null);
}

export function BookmarksPanel({
  bookmarks,
  knownPaths,
  currentPath,
  currentHeadingId,
  onOpen,
  onDelete,
}: BookmarksPanelProps) {
  const knownPathKeys = knownPaths === undefined ? undefined : new Set(knownPaths.map(normalizePathKey));

  return (
    <section className="bookmarks-panel" aria-labelledby="context-bookmarks-title">
      <div className="panel-kicker">READING MARKS</div>
      <div className="bookmarks-panel-heading">
        <h3 id="context-bookmarks-title">书签</h3>
        <span className="bookmarks-count" aria-label={`${bookmarks.length} 个书签`}>
          {bookmarks.length}
        </span>
      </div>
      <p className="bookmarks-panel-intro">把重要位置留在手边，点击即可回到原文。</p>

      {bookmarks.length === 0 ? (
        <p className="bookmarks-empty">还没有书签。在正文中右键，选择“添加书签”。</p>
      ) : (
        <ul className="bookmark-list">
          {bookmarks.map((bookmark) => {
            const label = bookmarkLabel(bookmark);
            const current = isCurrentBookmark(bookmark, currentPath, currentHeadingId);
            const known = knownPathKeys === undefined || knownPathKeys.has(normalizePathKey(bookmark.path));
            return (
              <li key={bookmarkIdentity(bookmark)} className={`bookmark-item${current ? " current" : ""}`}>
                <button
                  type="button"
                  className="bookmark-open"
                  onClick={() => onOpen(bookmark)}
                  aria-label={`打开书签：${label}`}
                  aria-current={current ? "location" : undefined}
                >
                  <span className="bookmark-pin" aria-hidden="true">
                    ◆
                  </span>
                  <span className="bookmark-copy">
                    <strong title={bookmark.path}>{fileNameFromPath(bookmark.path)}</strong>
                    <span>{bookmark.headingId ? `#${bookmark.headingId}` : "文档开头"}</span>
                    {bookmark.quote && <small title={bookmark.quote}>“{bookmark.quote}”</small>}
                    {!known && <small className="bookmark-status">未在当前阅读库中，可能已移动或删除</small>}
                  </span>
                  {current && <span className="bookmark-current-badge">当前</span>}
                </button>
                <button
                  type="button"
                  className="bookmark-delete"
                  onClick={() => onDelete(bookmark)}
                  aria-label={`删除书签：${label}`}
                  title="删除书签"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
