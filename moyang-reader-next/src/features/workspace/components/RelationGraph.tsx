import { useMemo, useRef, useState } from "react";
import { filterGraphEntries, type GraphFilter } from "../graph-filter";
import { useModalBehavior } from "../../../shared/components/useModalBehavior";
import type { WorkspaceIndexEntry } from "../../../shared/types";
import { createLinkIndex, findLinkedEntry } from "../workspace-index";

type RelationGraphProps = {
  current?: WorkspaceIndexEntry;
  entries: WorkspaceIndexEntry[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
};

type GraphNode = {
  entry: WorkspaceIndexEntry;
  x: number;
  y: number;
};

const GRAPH_WIDTH = 720;
const GRAPH_HEIGHT = 420;

function graphNodes(current: WorkspaceIndexEntry, entries: WorkspaceIndexEntry[]): GraphNode[] {
  const ordered = [current, ...entries];
  const others = ordered.slice(1);
  const radius = Math.min(166, 84 + others.length * 5);

  return ordered.map((entry, index) => {
    if (index === 0) return { entry, x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
    const angle = -Math.PI / 2 + ((index - 1) * Math.PI * 2) / Math.max(others.length, 1);
    return {
      entry,
      x: GRAPH_WIDTH / 2 + Math.cos(angle) * radius,
      y: GRAPH_HEIGHT / 2 + Math.sin(angle) * radius,
    };
  });
}

export function RelationGraph({ current, entries, onClose, onOpenFile }: RelationGraphProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const linkIndex = useMemo(() => createLinkIndex(entries), [entries]);
  const [filter, setFilter] = useState<GraphFilter>({ query: "", tag: "", scope: "neighbors", direction: "both" });
  const [page, setPage] = useState(0);
  const matches = useMemo(
    () => (current ? filterGraphEntries(current, entries, filter) : []),
    [current, entries, filter],
  );
  const tags = useMemo(() => [...new Set(entries.flatMap((entry) => entry.tags))].sort(), [entries]);
  const change = (next: Partial<GraphFilter>) => {
    setFilter((value) => ({ ...value, ...next }));
    setPage(0);
  };
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });
  if (!current) return null;

  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const activePage = Math.min(page, pages - 1);
  const nodes = graphNodes(current, matches.slice(activePage * 24, (activePage + 1) * 24));
  const nodeByPath = new Map(nodes.map((node) => [node.entry.file.path, node]));
  const edges: Array<{ from: GraphNode; to: GraphNode }> = [];
  const edgeKeys = new Set<string>();

  for (const node of nodes) {
    for (const link of node.entry.links) {
      const target = findLinkedEntry(entries, node.entry, link, linkIndex);
      const targetNode = target ? nodeByPath.get(target.file.path) : undefined;
      if (!targetNode || targetNode.entry.file.path === node.entry.file.path) continue;
      const key = [node.entry.file.path, targetNode.entry.file.path].sort().join("\n");
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from: node, to: targetNode });
    }
  }

  return (
    <div
      className="graph-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="relation-graph"
        role="dialog"
        aria-modal="true"
        aria-labelledby="graph-title"
        tabIndex={-1}
      >
        <header className="graph-header">
          <div>
            <div className="panel-kicker">RELATIONS</div>
            <h2 id="graph-title">文档关系图</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="find-button" onClick={onClose} aria-label="关闭关系图">
            ×
          </button>
        </header>
        <div className="graph-filters">
          <input
            type="search"
            aria-label="筛选关系图"
            placeholder="标题或路径"
            value={filter.query}
            onChange={(e) => change({ query: e.target.value })}
          />
          <select
            aria-label="关系图范围"
            value={filter.scope}
            onChange={(e) => change({ scope: e.target.value as GraphFilter["scope"] })}
          >
            <option value="neighbors">当前文档关联</option>
            <option value="workspace">整个阅读库</option>
          </select>
          <select
            aria-label="链接方向"
            value={filter.direction}
            disabled={filter.scope === "workspace"}
            onChange={(e) => change({ direction: e.target.value as GraphFilter["direction"] })}
          >
            <option value="both">全部方向</option>
            <option value="incoming">反向链接</option>
            <option value="outgoing">当前文档出链</option>
          </select>
          <select aria-label="关系图标签" value={filter.tag} onChange={(e) => change({ tag: e.target.value })}>
            <option value="">全部标签</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div className="graph-stage">
          <svg
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="当前文档及直接关联文档"
          >
            <defs>
              <marker id="graph-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 z" fill="var(--accent)" />
              </marker>
            </defs>
            {edges.map(({ from, to }) => (
              <line
                key={`${from.entry.file.path}-${to.entry.file.path}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd="url(#graph-arrow)"
              />
            ))}
          </svg>
          {nodes.map((node, index) => (
            <button
              type="button"
              className={`graph-node ${index === 0 ? "current" : ""}`}
              key={node.entry.file.path}
              style={{ left: `${(node.x / GRAPH_WIDTH) * 100}%`, top: `${(node.y / GRAPH_HEIGHT) * 100}%` }}
              onClick={() => {
                onClose();
                onOpenFile(node.entry.file.path);
              }}
              title={node.entry.file.relativePath}
            >
              <strong>{node.entry.title}</strong>
              <small>{node.entry.file.relativePath}</small>
            </button>
          ))}
        </div>
        <footer className="graph-pagination">
          <span role="status">
            匹配 {matches.length} 篇 · 第 {activePage + 1} / {pages} 页
          </span>
          <button className="quiet-button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>
            上一页
          </button>
          <button className="quiet-button" disabled={activePage + 1 === pages} onClick={() => setPage(activePage + 1)}>
            下一页
          </button>
        </footer>
        <p className="graph-note">中心保留当前文档。每页展示最多 24 篇匹配文档，点击节点打开。</p>
      </section>
    </div>
  );
}
