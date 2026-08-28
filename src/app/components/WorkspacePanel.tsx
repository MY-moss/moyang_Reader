import type {
  RecentFile,
  RecentWorkspace,
  WorkspaceDirectory,
  WorkspaceEntryDetails,
  WorkspaceExportFailure,
  WorkspaceFile,
  WorkspaceListingStatus,
  WorkspaceSearchResult,
} from "../types";
import { WorkspaceTreeView, type WorkspaceEntryKind, type WorkspaceEntryTransferMode } from "./WorkspaceTree";
import type { WorkspaceKindFilter } from "../workspace-filter";
import { filterSwitchableWorkspaces } from "../workspace-switcher";
import { MAX_MOUNTED_WORKSPACES } from "../storage";

const workspaceKindOptions: Array<{ value: WorkspaceKindFilter; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "纯文本" },
  { value: "docx", label: "Word" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "图片" },
];

type WorkspacePanelProps = {
  workspacePath: string | null;
  files: WorkspaceFile[];
  folders?: WorkspaceDirectory[];
  visibleFiles: WorkspaceFile[];
  visibleResultCount: number;
  exportableFiles: WorkspaceFile[];
  recentFiles: RecentFile[];
  recentWorkspaces: RecentWorkspace[];
  mountedWorkspaces: RecentWorkspace[];
  activePath: string | null;
  searchQuery: string;
  searchResults: WorkspaceSearchResult[];
  searchLoading: boolean;
  tagOptions: string[];
  selectedTag: string | null;
  selectedKind: WorkspaceKindFilter;
  onAddWorkspace: () => void;
  workspaceLimitReached: boolean;
  onOpenWorkspace: (path: string) => void;
  onRemoveWorkspace: (path: string) => void;
  onExportWorkspace: (format: "html" | "docx" | "pdf") => void;
  onCancelWorkspaceExport: () => void;
  workspaceExporting: boolean;
  workspaceExportProgress: { current: number; total: number; fileName: string } | null;
  workspaceExportFailures: WorkspaceExportFailure[];
  onCopyExportFailures: () => void;
  onSaveExportFailures: () => void;
  workspaceExportNotice: string | null;
  workspaceIndexLoading: boolean;
  workspaceListingStatus: WorkspaceListingStatus;
  onOpenFile: (path: string) => void;
  onCloseFile?: (path: string) => void;
  onCreateNote?: (parentPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRenameEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onDeleteEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onDuplicateEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onShowDetails?: (details: WorkspaceEntryDetails) => void;
  onRevealEntry?: (entryPath: string) => void;
  onCopyPath?: (entryPath: string) => void;
  onCopyRelativePath?: (entryPath: string) => void;
  onCopyName?: (entryPath: string) => void;
  onRefresh?: (entryPath: string) => void;
  onTransferEntry?: (
    sourcePath: string,
    destinationParentPath: string,
    mode: WorkspaceEntryTransferMode,
    kind: WorkspaceEntryKind,
  ) => boolean | Promise<boolean>;
  onStatusMessage?: (message: string) => void;
  onSearchQueryChange: (query: string) => void;
  onTagChange: (tag: string | null) => void;
  onKindChange: (kind: WorkspaceKindFilter) => void;
  onClearFilters: () => void;
};

function pathName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function isBatchExportable(file: WorkspaceFile): boolean {
  return file.kind === "markdown" || file.kind === "text" || file.kind === "docx";
}

export function WorkspacePanel({
  workspacePath,
  files,
  folders = [],
  visibleFiles,
  visibleResultCount,
  exportableFiles,
  recentFiles,
  recentWorkspaces,
  mountedWorkspaces,
  activePath,
  searchQuery,
  searchResults,
  searchLoading,
  tagOptions,
  selectedTag,
  selectedKind,
  onAddWorkspace,
  workspaceLimitReached,
  onOpenWorkspace,
  onRemoveWorkspace,
  onExportWorkspace,
  onCancelWorkspaceExport,
  workspaceExporting,
  workspaceExportProgress,
  workspaceExportFailures,
  onCopyExportFailures,
  onSaveExportFailures,
  workspaceExportNotice,
  workspaceIndexLoading,
  workspaceListingStatus,
  onOpenFile,
  onCloseFile,
  onCreateNote,
  onCreateFolder,
  onRenameEntry,
  onDeleteEntry,
  onDuplicateEntry,
  onShowDetails,
  onRevealEntry,
  onCopyPath,
  onCopyRelativePath,
  onCopyName,
  onRefresh,
  onTransferEntry,
  onStatusMessage,
  onSearchQueryChange,
  onTagChange,
  onKindChange,
  onClearFilters,
}: WorkspacePanelProps) {
  const selectedKindLabel = workspaceKindOptions.find((option) => option.value === selectedKind)?.label ?? "全部类型";
  const hasFilters = Boolean(selectedTag) || selectedKind !== "all";
  const switchableWorkspaces = filterSwitchableWorkspaces(mountedWorkspaces, workspacePath);
  const canBatchExport = Boolean(workspacePath && exportableFiles.some(isBatchExportable));
  const treeFolders = hasFilters ? [] : folders;

  return (
    <section className="workspace-panel" aria-labelledby="workspace-title">
      <div className="workspace-heading">
        <div>
          <div className="panel-kicker">WORKSPACE</div>
          <h2 id="workspace-title">阅读库</h2>
        </div>
        <div className="workspace-actions">
          {workspacePath && onCreateNote && onCreateFolder && (
            <details className="workspace-create-menu">
              <summary className="quiet-button workspace-create-button">新建</summary>
              <div className="workspace-create-menu-panel" role="menu">
                <div className="workspace-switcher-label">阅读库根目录</div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    onCreateNote("");
                  }}
                >
                  新建笔记
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    onCreateFolder("");
                  }}
                >
                  新建文件夹
                </button>
              </div>
            </details>
          )}
          {(canBatchExport || workspaceExporting) && (
            <details className="export-menu workspace-export-menu">
              <summary className="quiet-button">{workspaceExporting ? "导出中…" : "批量导出"}</summary>
              <div className="export-menu-panel">
                <button
                  type="button"
                  disabled={!canBatchExport || workspaceExporting}
                  onClick={() => onExportWorkspace("html")}
                >
                  单文件 HTML
                </button>
                <button
                  type="button"
                  disabled={!canBatchExport || workspaceExporting}
                  onClick={() => onExportWorkspace("docx")}
                >
                  单文件 Word
                </button>
                <button
                  type="button"
                  disabled={!canBatchExport || workspaceExporting}
                  onClick={() => onExportWorkspace("pdf")}
                >
                  批量打印 / PDF
                </button>
              </div>
            </details>
          )}
          {workspaceExporting && (
            <button type="button" className="quiet-button workspace-export-cancel" onClick={onCancelWorkspaceExport}>
              取消导出
            </button>
          )}
          {workspacePath && (
            <button
              type="button"
              className="quiet-button workspace-add-button"
              onClick={onAddWorkspace}
              disabled={workspaceLimitReached}
              title={
                workspaceLimitReached
                  ? `已达到 ${MAX_MOUNTED_WORKSPACES} 个阅读库上限，请先移除一个已挂载阅读库。`
                  : "添加另一个阅读库"
              }
            >
              添加阅读库
            </button>
          )}
        </div>
      </div>

      {workspacePath ? (
        <div className="workspace-location" title={workspacePath}>
          <span className="workspace-dot" aria-hidden="true" />
          <span>{pathName(workspacePath)}</span>
          <small>
            {files.length} 项 · {mountedWorkspaces.length} 个阅读库
          </small>
          {switchableWorkspaces.length > 0 && (
            <details className="workspace-switcher">
              <summary className="workspace-switcher-trigger" aria-label="切换阅读库">
                切换
              </summary>
              <div className="workspace-switcher-menu" role="menu">
                <div className="workspace-switcher-label">
                  已挂载阅读库 · {mountedWorkspaces.length} / {MAX_MOUNTED_WORKSPACES}
                </div>
                {switchableWorkspaces.map((workspace) => (
                  <div className="workspace-switcher-item" role="none" key={workspace.path}>
                    <button
                      type="button"
                      role="menuitem"
                      title={workspace.path}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onOpenWorkspace(workspace.path);
                      }}
                    >
                      <strong>{workspace.name}</strong>
                      <span>{workspace.path}</span>
                    </button>
                    <button
                      type="button"
                      className="workspace-switcher-remove"
                      title={`移除 ${workspace.name}`}
                      aria-label={`从已挂载阅读库移除 ${workspace.name}`}
                      onClick={() => onRemoveWorkspace(workspace.path)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="workspace-help">添加一个文件夹，递归读取其中的文档并开启目录浏览和全文搜索。</p>
      )}
      {workspaceExportNotice && (
        <div className="workspace-export-note" role="status">
          {workspaceExportNotice}
        </div>
      )}
      {workspaceExportProgress && (
        <div className="workspace-export-progress" role="status" aria-live="polite">
          <div className="workspace-export-progress-label">
            <span>
              正在整理 {workspaceExportProgress.current} / {workspaceExportProgress.total}
            </span>
            <strong title={workspaceExportProgress.fileName}>{workspaceExportProgress.fileName}</strong>
          </div>
          <div
            className="workspace-export-progress-track"
            role="progressbar"
            aria-label="批量导出进度"
            aria-valuemin={0}
            aria-valuemax={workspaceExportProgress.total}
            aria-valuenow={workspaceExportProgress.current}
          >
            <span
              style={{
                width: `${Math.round((workspaceExportProgress.current / Math.max(1, workspaceExportProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
      {workspaceExportFailures.length > 0 && (
        <details className="workspace-export-failures">
          <summary>查看 {workspaceExportFailures.length} 个未导出文件</summary>
          <div className="workspace-export-failure-actions">
            <button type="button" className="quiet-button" onClick={onCopyExportFailures}>
              复制清单
            </button>
            <button type="button" className="quiet-button" onClick={onSaveExportFailures}>
              保存清单
            </button>
          </div>
          <ul>
            {workspaceExportFailures.map((failure) => (
              <li key={`${failure.fileName}-${failure.reason}`}>
                <strong title={failure.fileName}>{failure.fileName}</strong>
                <span>{failure.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {workspaceIndexLoading && (
        <div className="workspace-index-note" role="status">
          目录已打开，正在整理链接与标签…
        </div>
      )}
      {workspaceListingStatus.truncated && (
        <div className="workspace-limit-note" role="status">
          工作区较大，文件树和工作区索引只加载了安全范围内的内容；未加载部分需要缩小工作区后查看。
        </div>
      )}

      {workspacePath && (
        <>
          <div className="workspace-filter-summary" role="status">
            <span>
              {searchQuery.trim()
                ? searchLoading
                  ? "正在整理搜索结果…"
                  : `当前结果 ${visibleResultCount} 项`
                : `显示 ${visibleFiles.length} / ${files.length} 项`}
            </span>
            {hasFilters && (
              <>
                <span className="workspace-filter-label">
                  · {selectedKind !== "all" ? selectedKindLabel : ""}
                  {selectedKind !== "all" && selectedTag ? " · " : ""}
                  {selectedTag ? `#${selectedTag}` : ""}
                </span>
                <button type="button" className="workspace-clear-filter" onClick={onClearFilters}>
                  清除筛选
                </button>
              </>
            )}
          </div>
          <input
            className="workspace-search"
            type="search"
            aria-label="搜索工作区"
            placeholder="搜索整个阅读库"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          {tagOptions.length > 0 && (
            <label className="tag-filter">
              <span>标签</span>
              <select
                aria-label="按标签筛选工作区"
                value={selectedTag ?? ""}
                onChange={(event) => onTagChange(event.target.value || null)}
              >
                <option value="">全部标签</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="tag-filter">
            <span>类型</span>
            <select
              aria-label="按类型筛选工作区"
              value={selectedKind}
              onChange={(event) => onKindChange(event.target.value as WorkspaceKindFilter)}
            >
              {workspaceKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {searchQuery.trim() ? (
        <div className="workspace-results" aria-live="polite">
          {searchQuery.trim().length < 2 && <p className="muted-copy">再输入一个字符开始搜索。</p>}
          {searchLoading && <p className="muted-copy">正在搜索…</p>}
          {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
            <p className="muted-copy">没有找到匹配文档。</p>
          )}
          {!searchLoading &&
            searchResults.map((result) => (
              <button
                type="button"
                className="workspace-result"
                key={result.file.path}
                onClick={() => onOpenFile(result.file.path)}
              >
                <strong>{result.file.name}</strong>
                <span>{result.preview || result.file.relativePath}</span>
              </button>
            ))}
        </div>
      ) : (
        <>
          {workspacePath && (visibleFiles.length > 0 || treeFolders.length > 0 || !hasFilters) && (
            <div className="workspace-files" aria-label="工作区文件">
              <div className="workspace-subheading">文件</div>
              <WorkspaceTreeView
                files={visibleFiles}
                folders={treeFolders}
                activePath={activePath}
                onOpenFile={onOpenFile}
                onCloseFile={onCloseFile}
                onCreateNote={onCreateNote}
                onCreateFolder={onCreateFolder}
                onRenameEntry={onRenameEntry}
                onDeleteEntry={onDeleteEntry}
                onDuplicateEntry={onDuplicateEntry}
                onShowDetails={onShowDetails}
                onRevealEntry={onRevealEntry}
                onCopyPath={onCopyPath}
                onCopyRelativePath={onCopyRelativePath}
                onCopyName={onCopyName}
                onRefresh={onRefresh}
                onTransferEntry={onTransferEntry}
                onStatusMessage={onStatusMessage}
              />
            </div>
          )}

          {workspacePath && visibleFiles.length === 0 && <p className="muted-copy">当前标签下没有文件。</p>}

          {!workspacePath && recentWorkspaces.length > 0 && (
            <div className="workspace-files recent-files" aria-label="最近阅读库">
              <div className="workspace-subheading">最近阅读库</div>
              {recentWorkspaces.map((workspace) => (
                <button
                  type="button"
                  className="workspace-file"
                  key={workspace.path}
                  title={workspace.path}
                  onClick={() => onOpenWorkspace(workspace.path)}
                >
                  <span>{workspace.name}</span>
                  <small>{workspace.path}</small>
                </button>
              ))}
            </div>
          )}

          {!workspacePath && recentFiles.length > 0 && (
            <div className="workspace-files recent-files" aria-label="最近打开">
              <div className="workspace-subheading">最近打开</div>
              {recentFiles.map((file) => (
                <button
                  type="button"
                  className="workspace-file"
                  key={file.path}
                  title={file.path}
                  onClick={() => onOpenFile(file.path)}
                >
                  <span>{file.name}</span>
                  <small>{file.path}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
