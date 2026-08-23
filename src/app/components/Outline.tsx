import type { TocItem } from "../types";

type OutlineProps = {
  items: TocItem[];
};

export function Outline({ items }: OutlineProps) {
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
              <a href={`#${item.id}`}>{item.text}</a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
