import type { ContextPanelTab, OpenDocument, ReaderMode, TocItem, WorkspaceIndexEntry } from "../../../shared/types";
import { RelatedPanel } from "../../workspace/components/RelatedPanel";
import { Outline } from "./Outline";
import { ReadingRail } from "./ReadingRail";
import { lazy, Suspense } from "react";
const PropertiesPanel = lazy(() => import("./PropertiesPanel").then((m) => ({ default: m.PropertiesPanel })));

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
  sourceDraft: string;
  onUpdateSource: (source: string) => void;
};

const tabs: Array<{ id: ContextPanelTab; label: string }> = [
  { id: "outline", label: "目录" },
  { id: "backlinks", label: "关联" },
  { id: "properties", label: "属性" },
];

function fileTypeLabel(kind: OpenDocument["kind"]): string {
  return kind === "markdown" ? "Markdown" : kind === "text" ? "纯文本" : kind.toUpperCase();
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
  sourceDraft,
  onUpdateSource,
}: ContextPanelProps) {
  return (
    <aside className="context-sidebar" aria-label="当前文档上下文">
      <div className="context-panel-header">
        <div>
          <div className="panel-kicker">CONTEXT</div>
          <h2>文档详情</h2>
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
        {activeTab === "properties" && documentState && (
          <Suspense fallback={<p role="status">正在读取属性…</p>}>
            <PropertiesPanel documentState={documentState} sourceDraft={sourceDraft} onUpdateSource={onUpdateSource} />
          </Suspense>
        )}
      </div>
    </aside>
  );
}
