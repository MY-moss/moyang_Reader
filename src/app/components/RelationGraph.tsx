import type { WorkspaceIndexEntry } from "../types";
import { findLinkedEntry } from "../workspace-index";

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

function connectedEntries(current: WorkspaceIndexEntry, entries: WorkspaceIndexEntry[]): WorkspaceIndexEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.file.path === current.file.path ||
        current.links.some((link) => findLinkedEntry(entries, current, link)?.file.path === entry.file.path) ||
        entry.links.some((link) => findLinkedEntry(entries, entry, link)?.file.path === current.file.path),
    )
    .slice(0, 25);
}

function graphNodes(current: WorkspaceIndexEntry, entries: WorkspaceIndexEntry[]): GraphNode[] {
  const related = connectedEntries(current, entries);
  const center = related.findIndex((entry) => entry.file.path === current.file.path);
  const ordered =
    center < 0 ? [current, ...related] : [related[center], ...related.slice(0, center), ...related.slice(center + 1)];
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
  if (!current) return null;

  const nodes = graphNodes(current, entries);
  const nodeByPath = new Map(nodes.map((node) => [node.entry.file.path, node]));
  const edges: Array<{ from: GraphNode; to: GraphNode }> = [];
  const edgeKeys = new Set<string>();

  for (const node of nodes) {
    for (const link of node.entry.links) {
      const target = findLinkedEntry(entries, node.entry, link);
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
      <section className="relation-graph" role="dialog" aria-modal="true" aria-labelledby="graph-title">
        <header className="graph-header">
          <div>
            <div className="panel-kicker">RELATIONS</div>
            <h2 id="graph-title">文档关系图</h2>
          </div>
          <button type="button" className="find-button" onClick={onClose} aria-label="关闭关系图">
            ×
          </button>
        </header>
        <div className="graph-stage">
          <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="img" aria-label="当前文档及直接关联文档">
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
        <p className="graph-note">显示当前文档的一跳出链和反向链接；点击节点即可打开文档。</p>
      </section>
    </div>
  );
}
