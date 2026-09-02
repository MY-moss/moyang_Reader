import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { resolveProgrammaticScrollBehavior } from "../scroll-behavior";
import type { TocItem } from "../types";

type OutlineProps = {
  items: TocItem[];
  activeId?: string | null;
  onNavigate: (item: TocItem) => void;
};

function resolveRovingItemId(items: TocItem[], preferredId: string | null | undefined): string | null {
  if (items.length === 0) return null;
  return preferredId && items.some((item) => item.id === preferredId) ? preferredId : items[0].id;
}

export function Outline({ items, activeId = null, onNavigate }: OutlineProps) {
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const outlineRef = useRef<HTMLOListElement | null>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [rovingId, setRovingId] = useState(() => resolveRovingItemId(items, activeId));

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView?.({
      behavior: resolveProgrammaticScrollBehavior("auto"),
      block: "nearest",
    });
  }, [activeId]);

  useEffect(() => {
    const activeElement = document.activeElement;
    const focusIsInsideOutline = activeElement instanceof HTMLElement && outlineRef.current?.contains(activeElement);
    const currentRovingItemExists = rovingId !== null && items.some((item) => item.id === rovingId);
    const nextRovingId =
      focusIsInsideOutline && currentRovingItemExists ? rovingId : resolveRovingItemId(items, activeId);

    if (nextRovingId !== rovingId) setRovingId(nextRovingId);
  }, [activeId, items, rovingId]);

  function focusItem(index: number, navigate: boolean) {
    const item = items[index];
    if (!item) return;

    setRovingId(item.id);
    linkRefs.current.get(item.id)?.focus();
    if (navigate) onNavigate(item);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = Math.min(items.length - 1, index + 1);
    if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    focusItem(nextIndex, nextIndex !== index);
  }

  return (
    <section className="outline-panel" aria-labelledby="outline-title">
      <div className="panel-kicker">NAVIGATION</div>
      <h2 id="outline-title">文档目录</h2>
      {items.length === 0 ? (
        <p className="muted-copy">文档中还没有标题。</p>
      ) : (
        <ol ref={outlineRef} className="outline-list" role="tree" aria-label="文档目录" aria-orientation="vertical">
          {items.map((item, index) => (
            <li key={`${item.id}-${item.depth}`} style={{ paddingLeft: `${Math.max(0, item.depth - 1) * 12}px` }}>
              <a
                ref={(element) => {
                  if (element) {
                    linkRefs.current.set(item.id, element);
                  } else {
                    linkRefs.current.delete(item.id);
                  }
                  if (item.id === activeId) activeLinkRef.current = element;
                }}
                role="treeitem"
                aria-level={Math.max(1, item.depth)}
                aria-selected={item.id === activeId}
                tabIndex={item.id === rovingId ? 0 : -1}
                className={item.id === activeId ? "active" : undefined}
                href={`#${encodeURIComponent(item.id)}`}
                aria-current={item.id === activeId ? "location" : undefined}
                onFocus={() => setRovingId(item.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onClick={(event) => {
                  event.preventDefault();
                  setRovingId(item.id);
                  onNavigate(item);
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
