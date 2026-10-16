import { DocumentPreview } from "../features/reader/components/DocumentPreview";
import { NewNoteDialog } from "../features/workspace/components/NewNoteDialog";
import { readingFonts, editorFonts } from "../features/settings/appearance";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { ContextPanel } from "../features/reader/components/ContextPanel";
import { PANE_WIDTH_LIMITS } from "../features/reader/pane-layout";
import { isTauriRuntime } from "../platform/bridge";
import { PaneResizeHandle } from "../shared/components/PaneResizeHandle";
import type { ReaderApplication } from "./useReaderApplication";
import type { WorkbenchPanes } from "./useWorkbenchPanes";
import { ReaderPaneTools } from "./views/ReaderPaneTools";
import { ReaderPane } from "./views/ReaderPane";
import { Icon } from "../shared/components/Icon";
import { ReaderOverlays } from "./views/ReaderOverlays";
import { ReaderStatus } from "./views/ReaderStatus";
import { ReaderToolbar } from "./views/ReaderToolbar";
export function App({
  model,
  panes,
  settingsOpen,
  onSettingsClose,
  content,
  documentTools,
}: {
  model: ReaderApplication;
  panes: WorkbenchPanes;
  content?: ReactNode;
  documentTools?: ReactNode;
  settingsOpen: boolean;
  onSettingsClose: () => void;
}) {
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [compactPanelOpen, setCompactPanelOpen] = useState(false);
  const [compact, setCompact] = useState(() => window.innerWidth < 1100);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1099px)");
    const update = () => {
      setCompact(query.matches);
      setCompactPanelOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const {
    preferences,
    focusMode,
    sidebarCollapsed,
    rightPanelOpen: preferredRightPanelOpen,
    paneWidths,
    handleDrop,
    documentState,
    mode,
    workspacePath,
    setRightPanelOpen,
    selectedTag,
    setSelectedTag,
    resizePane,
    resetPane,
    currentIndexEntry,
    backlinks,
    outgoing,
    currentHeadingId,
    currentHeading,
    readingProgress,
    activeContextTab,
    setActiveContextTab,
    handleCreateNote,
    setGraphOpen,
    scrollToReaderEdge,
    navigateToHeading,
  } = model;
  const rightPanelOpen = compact ? compactPanelOpen : preferredRightPanelOpen;
  const toggleContext = (value: boolean | ((previous: boolean) => boolean)) =>
    compact ? setCompactPanelOpen(value) : setRightPanelOpen(value);
  const preview = previewPath ? model.documentSessions.get(previewPath) : undefined;
  const paneTools = <ReaderPaneTools panes={panes}>{documentTools}</ReaderPaneTools>;
  return (
    <div
      className={`app-shell reading-width-${preferences.readingWidth}${
        focusMode ? " focus-mode" : ""
      }${sidebarCollapsed ? " sidebar-collapsed" : ""}${!rightPanelOpen || compact || !documentState ? " right-panel-collapsed" : ""}`}
      style={
        {
          "--font-reading": readingFonts[preferences.readingFont],
          "--font-editor": editorFonts[preferences.editorFont],
          "--sidebar-width": `${paneWidths.sidebar}px`,
          "--context-width": `${paneWidths.context}px`,
          "--reading-zoom": `${preferences.readingZoom / 100}`,
        } as CSSProperties
      }
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <ReaderToolbar
        model={{ ...model, rightPanelOpen, setRightPanelOpen: toggleContext }}
        settingsOpen={settingsOpen}
        onSettingsClose={onSettingsClose}
        navigation={
          <>
            <button aria-label="后退" disabled={!panes.canGoBack} onClick={() => void panes.navigateHistory(-1)}>
              <Icon name="back" />
            </button>
            <button aria-label="前进" disabled={!panes.canGoForward} onClick={() => void panes.navigateHistory(1)}>
              <Icon name="forward" />
            </button>
          </>
        }
      />
      {content ?? (
        <div className="workspace-grid">
          <div className="document-workspace">
            <div
              className={`reader-panes${panes.split ? " is-split" : ""}`}
              style={{ "--pane-ratio": `${panes.ratio}%` } as CSSProperties}
            >
              <ReaderPane index={0} model={model} workbench={panes} tools={paneTools} />
              {panes.split && <ReaderPane index={1} model={model} workbench={panes} tools={paneTools} />}
            </div>
          </div>
          {rightPanelOpen && !compact && documentState && !focusMode && (
            <PaneResizeHandle
              side="context"
              value={paneWidths.context}
              min={PANE_WIDTH_LIMITS.context.min}
              max={PANE_WIDTH_LIMITS.context.max}
              onResizeBy={(delta) => resizePane("context", delta)}
              onReset={() => resetPane("context")}
            />
          )}
          {rightPanelOpen &&
            documentState &&
            !focusMode &&
            (previewPath ? (
              <aside
                className={`context-sidebar related-preview${compact ? " context-overlay" : ""}`}
                aria-label="关联内容预览"
              >
                <header>
                  <h2>关联预览</h2>
                  <button onClick={() => setPreviewPath(null)}>返回目录</button>
                </header>
                <p>{previewPath.split(/[\\/]/).at(-1)}</p>
                <button
                  onClick={() => {
                    void panes.openFile(previewPath, false);
                    setPreviewPath(null);
                  }}
                >
                  打开文档
                </button>
                <div className="related-preview-body">
                  <DocumentPreview
                    path={previewPath}
                    draft={preview?.document.modified ? preview.draft : undefined}
                    html={preview?.document.rendered.html}
                    previewUrl={preview?.document.previewUrl}
                    allowRemoteResources={preferences.allowRemoteResources}
                  />
                </div>
              </aside>
            ) : (
              <div className={compact ? "context-overlay" : "context-container"}>
                <ContextPanel
                  key={documentState.path}
                  sourceDraft={model.sourceDraft}
                  onUpdateSource={(source) => {
                    model.updateSource(source);
                    model.setMode("source");
                  }}
                  documentState={documentState}
                  entry={currentIndexEntry}
                  backlinks={backlinks}
                  outgoing={outgoing}
                  canCreateNote={Boolean(workspacePath && isTauriRuntime())}
                  selectedTag={selectedTag}
                  toc={documentState?.rendered.toc ?? []}
                  activeHeadingId={currentHeadingId}
                  currentHeading={currentHeading}
                  readingProgress={readingProgress}
                  mode={mode}
                  activeTab={activeContextTab}
                  onTabChange={setActiveContextTab}
                  onClose={() => toggleContext(false)}
                  onOpenFile={setPreviewPath}
                  onCreateNote={(target) => void handleCreateNote(target)}
                  onOpenGraph={() => setGraphOpen(true)}
                  onSelectTag={setSelectedTag}
                  onScrollToTop={() => scrollToReaderEdge("top")}
                  onScrollToBottom={() => scrollToReaderEdge("bottom")}
                  onNavigateHeading={navigateToHeading}
                />
              </div>
            ))}
        </div>
      )}

      <ReaderStatus model={model} />

      <ReaderOverlays model={model} />
      {model.newNoteParent !== null && (
        <NewNoteDialog
          parent={model.newNoteParent}
          folders={model.workspaceFolders}
          onCreate={model.createNote}
          onClose={() => model.setNewNoteParent(null)}
        />
      )}
    </div>
  );
}
