import type { ContextPanelTab, OpenDocument, ReaderMode, TocItem, WorkspaceIndexEntry } from "../types";
import { Outline } from "./Outline";
import { ReadingRail } from "./ReadingRail";
import { RelatedPanel } from "./RelatedPanel";

type ContextPanelProps = {
  documentState: OpenDocument | null;
  entry?: WorkspaceIndexEntry;
  backlinks: WorkspaceIndexEntry[];
  outgoing: Array<{ target: string; entry?: WorkspaceIndexEntry }>;
  canCreateNote: boolean;
  selectedTag: string | null;
  toc: TocItem[];
  activeHeadingId: string | null;
  currentHeading: string | null;
  readingProgress: number;
  mode: ReaderMode;
  activeTab: ContextPanelTab;
  onTabChange: (tab: ContextPanelTab) => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onCreateNote: (target: string) => void;
  onOpenGraph: () => void;
  onSelectTag: (tag: string | null) => void;
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  onNavigateHeading: (item: TocItem) => void;
};

const tabs: Array<{ id: ContextPanelTab; label: string }> = [
  { id: "outline", label: "目录" },
  { id: "backlinks", label: "关联" },
  { id: "properties", label: "属性" },
];

function fileTypeLabel(kind: OpenDocument["kind"]): string {
  return kind === "markdown" ? "Markdown" : kind === "text" ? "纯文本" : kind.toUpperCase();
}

function frontmatterProperties(source: string): Array<[string, string]> {
  if (!source.startsWith("---")) return [];
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return [];

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([^:#][^:]*?)\s*:\s*(.*?)\s*$/))
    .filter((entry): entry is RegExpMatchArray => Boolean(entry?.[1]))
    .map((entry) => [entry[1], entry[2] || "（空）"]);
}

export function ContextPanel({
  documentState,
  entry,
  backlinks,
  outgoing,
  canCreateNote,
  selectedTag,
  toc,
  activeHeadingId,
  currentHeading,
  readingProgress,
  mode,
  activeTab,
  onTabChange,
  onClose,
  onOpenFile,
  onCreateNote,
  onOpenGraph,
  onSelectTag,
  onScrollToTop,
  onScrollToBottom,
  onNavigateHeading,
}: ContextPanelProps) {
  const properties = documentState?.kind === "markdown" ? frontmatterProperties(documentState.source) : [];

  return (
    <aside className="context-sidebar" aria-label="当前文档上下文">
      <div className="context-panel-header">
        <div>
          <div className="panel-kicker">CONTEXT</div>
          <h2>文档上下文</h2>
        </div>
        <button type="button" className="panel-close-button" onClick={onClose} aria-label="隐藏上下文面板">
          ×
        </button>
      </div>

      {documentState && (
        <div className="context-document-card">
          <span className="file-type">{fileTypeLabel(documentState.kind)}</span>
          <div className="context-document-copy">
            <strong title={documentState.name}>{documentState.name}</strong>
            <span>
              {documentState.externallyModified ? "外部已修改" : documentState.modified ? "有未保存修改" : "已保存"}
            </span>
          </div>
        </div>
      )}

      {documentState && documentState.kind !== "pdf" && documentState.kind !== "image" && mode === "rendered" && (
        <ReadingRail
          progress={readingProgress}
          currentHeading={currentHeading}
          headingCount={toc.length}
          onScrollToTop={onScrollToTop}
          onScrollToBottom={onScrollToBottom}
        />
      )}

      <nav className="context-tab-list" aria-label="文档上下文视图" role="tablist">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`context-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="context-panel-body" role="tabpanel">
        {activeTab === "outline" && <Outline items={toc} activeId={activeHeadingId} onNavigate={onNavigateHeading} />}
        {activeTab === "backlinks" && (
          <RelatedPanel
            entry={entry}
            backlinks={backlinks}
            outgoing={outgoing}
            canCreateNote={canCreateNote}
            selectedTag={selectedTag}
            onOpenFile={onOpenFile}
            onCreateNote={onCreateNote}
            onOpenGraph={onOpenGraph}
            onSelectTag={onSelectTag}
          />
        )}
        {activeTab === "properties" && (
          <section className="context-properties" aria-labelledby="context-properties-title">
            <div className="panel-kicker">PROPERTIES</div>
            <h3 id="context-properties-title">文档属性</h3>
            {documentState ? (
              <dl>
                <div>
                  <dt>类型</dt>
                  <dd>{fileTypeLabel(documentState.kind)}</dd>
                </div>
                <div>
                  <dt>字数</dt>
                  <dd>{documentState.rendered.wordCount.toLocaleString("zh-CN")}</dd>
                </div>
                <div>
                  <dt>阅读时间</dt>
                  <dd>{documentState.rendered.readingMinutes} 分钟</dd>
                </div>
                <div>
                  <dt>路径</dt>
                  <dd title={documentState.path}>{documentState.path}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted-copy">打开文档后显示属性。</p>
            )}
            {properties.length > 0 && (
              <div className="context-frontmatter">
                <div className="panel-kicker">FRONTMATTER</div>
                <dl>
                  {properties.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd title={value}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <p className="context-panel-note">YAML 属性编辑将在知识库增强批次中开放，未知字段会保持原样。</p>
          </section>
        )}
      </div>
    </aside>
  );
}
