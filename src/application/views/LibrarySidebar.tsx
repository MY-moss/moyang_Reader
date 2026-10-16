import { WorkspacePanel } from "../../features/workspace/components/WorkspacePanel";
import { MAX_MOUNTED_WORKSPACES } from "../../platform/storage";
import type { ReaderApplication } from "../useReaderApplication";
export function LibrarySidebar({
  model,
}: {
  model: Pick<
    ReaderApplication,
    | "documentState"
    | "searchQuery"
    | "handleChooseWorkspace"
    | "workspacePath"
    | "mountedWorkspaces"
    | "handleSelectTab"
    | "handleCloseTab"
    | "handleExportWorkspace"
    | "handleCancelWorkspaceExport"
    | "workspaceExporting"
    | "workspaceExportProgress"
    | "workspaceExportFailures"
    | "copyWorkspaceExportFailures"
    | "saveWorkspaceExportFailures"
    | "workspaceExportNotice"
    | "workspaceIndexLoading"
    | "workspaceFiles"
    | "workspaceFolders"
    | "visibleWorkspaceFiles"
    | "visibleWorkspaceResults"
    | "workspaceExportFiles"
    | "recentFiles"
    | "recentWorkspaces"
    | "workspaceQuery"
    | "workspaceSearchLoading"
    | "availableTags"
    | "selectedTag"
    | "selectedFileKind"
    | "handleOpenRecentWorkspace"
    | "handleRemoveMountedWorkspace"
    | "handleCreateWorkspaceNote"
    | "handleCreateWorkspaceFolder"
    | "handleRenameWorkspaceEntry"
    | "handleDeleteWorkspaceEntry"
    | "handleDuplicateWorkspaceEntry"
    | "handleShowWorkspaceDetails"
    | "handleRevealWorkspaceEntry"
    | "handleCopyWorkspacePath"
    | "handleCopyWorkspaceRelativePath"
    | "handleCopyWorkspaceName"
    | "handleRefreshWorkspaceEntry"
    | "setWorkspaceQuery"
    | "setSelectedTag"
    | "setSelectedFileKind"
    | "workspaceLoading"
    | "workspaceWatchError"
    | "loading"
  >;
}) {
  const {
    documentState,
    handleChooseWorkspace,
    workspacePath,
    mountedWorkspaces,
    handleSelectTab,
    handleCloseTab,
    handleExportWorkspace,
    handleCancelWorkspaceExport,
    workspaceExporting,
    workspaceExportProgress,
    workspaceExportFailures,
    copyWorkspaceExportFailures,
    saveWorkspaceExportFailures,
    workspaceExportNotice,
    workspaceIndexLoading,
    workspaceFiles,
    workspaceFolders,
    visibleWorkspaceFiles,
    visibleWorkspaceResults,
    workspaceExportFiles,
    recentFiles,
    recentWorkspaces,
    workspaceQuery,
    workspaceSearchLoading,
    availableTags,
    selectedTag,
    selectedFileKind,
    handleOpenRecentWorkspace,
    handleRemoveMountedWorkspace,
    handleCreateWorkspaceNote,
    handleCreateWorkspaceFolder,
    handleRenameWorkspaceEntry,
    handleDeleteWorkspaceEntry,
    handleDuplicateWorkspaceEntry,
    handleShowWorkspaceDetails,
    handleRevealWorkspaceEntry,
    handleCopyWorkspacePath,
    handleCopyWorkspaceRelativePath,
    handleCopyWorkspaceName,
    handleRefreshWorkspaceEntry,
    setWorkspaceQuery,
    setSelectedTag,
    setSelectedFileKind,
    workspaceLoading,
    workspaceWatchError,
  } = model;
  return (
    <>
      <aside className="sidebar">
        <WorkspacePanel
          onExportWorkspace={(format) => void handleExportWorkspace(format)}
          onCancelWorkspaceExport={handleCancelWorkspaceExport}
          workspaceExporting={workspaceExporting}
          workspaceExportProgress={workspaceExportProgress}
          workspaceExportFailures={workspaceExportFailures}
          onCopyExportFailures={() => void copyWorkspaceExportFailures()}
          onSaveExportFailures={() => void saveWorkspaceExportFailures()}
          workspaceExportNotice={workspaceExportNotice}
          workspaceIndexLoading={workspaceIndexLoading}
          workspacePath={workspacePath}
          files={workspaceFiles}
          folders={workspaceFolders}
          visibleFiles={visibleWorkspaceFiles}
          visibleResultCount={visibleWorkspaceResults.length}
          exportableFiles={workspaceExportFiles}
          recentFiles={recentFiles}
          recentWorkspaces={recentWorkspaces}
          mountedWorkspaces={mountedWorkspaces}
          activePath={documentState?.path ?? null}
          searchQuery={workspaceQuery}
          searchResults={visibleWorkspaceResults}
          searchLoading={workspaceSearchLoading}
          tagOptions={availableTags}
          selectedTag={selectedTag}
          selectedKind={selectedFileKind}
          onAddWorkspace={() => void handleChooseWorkspace()}
          workspaceLimitReached={mountedWorkspaces.length >= MAX_MOUNTED_WORKSPACES}
          onOpenWorkspace={(path) => void handleOpenRecentWorkspace(path)}
          onRemoveWorkspace={handleRemoveMountedWorkspace}
          onOpenFile={(path) => void handleSelectTab(path)}
          onCloseFile={(path) => void handleCloseTab(path)}
          onCreateNote={(parentPath) => void handleCreateWorkspaceNote(parentPath)}
          onCreateFolder={(parentPath) => void handleCreateWorkspaceFolder(parentPath)}
          onRenameEntry={(entryPath, kind) => void handleRenameWorkspaceEntry(entryPath, kind)}
          onDeleteEntry={(entryPath, kind) => void handleDeleteWorkspaceEntry(entryPath, kind)}
          onDuplicateEntry={(entryPath, kind) => void handleDuplicateWorkspaceEntry(entryPath, kind)}
          onShowDetails={handleShowWorkspaceDetails}
          onRevealEntry={(entryPath) => void handleRevealWorkspaceEntry(entryPath)}
          onCopyPath={(entryPath) => void handleCopyWorkspacePath(entryPath)}
          onCopyRelativePath={(entryPath) => void handleCopyWorkspaceRelativePath(entryPath)}
          onCopyName={(entryPath) => void handleCopyWorkspaceName(entryPath)}
          onRefresh={(entryPath) => void handleRefreshWorkspaceEntry(entryPath)}
          onSearchQueryChange={setWorkspaceQuery}
          onTagChange={setSelectedTag}
          onKindChange={setSelectedFileKind}
          onClearFilters={() => {
            setSelectedTag(null);
            setSelectedFileKind("all");
          }}
        />
        {workspaceLoading && <div className="workspace-loading">正在读取阅读库…</div>}
        {workspaceWatchError && <div className="workspace-watch-note">{workspaceWatchError}</div>}
        {documentState ? (
          <div className="sidebar-note">
            <div className="panel-kicker">阅读提示</div>
            <p>Ctrl+P 快速打开，Ctrl+E 开始编辑。</p>
          </div>
        ) : (
          <div className="sidebar-note">
            <div className="panel-kicker">从这里开始</div>
            <p>添加文件夹后，可以浏览目录、搜索正文和查看文档关联。</p>
          </div>
        )}
      </aside>
    </>
  );
}
