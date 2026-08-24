import { useEffect, useRef } from "react";
import type { TocItem } from "../types";

type OutlineProps = {
  items: TocItem[];
  activeId?: string | null;
};

export function Outline({ items, activeId = null }: OutlineProps) {
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <section className="outline-panel" aria-labelledby="outline-title">
      <div className="panel-kicker">NAVIGATION</div>
      <h2 id="outline-title">文档目录</h2>
      {items.length === 0 ? (
        <p className="muted-copy">文档中还没有标题。</p>
      ) : (
        <ol className="outline-list">
          {items.map((item) => (
            <li key={`${item.id}-${item.depth}`} style={{ paddingLeft: `${Math.max(0, item.depth - 1) * 12}px` }}>
              <a
                ref={item.id === activeId ? activeLinkRef : undefined}
                className={item.id === activeId ? "active" : undefined}
                href={`#${item.id}`}
                aria-current={item.id === activeId ? "location" : undefined}
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
