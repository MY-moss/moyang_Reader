import type { RecentFile, RecentWorkspace, WorkspaceFile, WorkspaceSearchResult } from "../types";
import { WorkspaceTreeView } from "./WorkspaceTree";

type WorkspacePanelProps = {
  workspacePath: string | null;
  files: WorkspaceFile[];
  visibleFiles: WorkspaceFile[];
  recentFiles: RecentFile[];
  recentWorkspaces: RecentWorkspace[];
  activePath: string | null;
  searchQuery: string;
  searchResults: WorkspaceSearchResult[];
  searchLoading: boolean;
  tagOptions: string[];
  selectedTag: string | null;
  onChooseWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onExportWorkspace: (format: "html" | "docx" | "pdf") => void;
  workspaceExporting: boolean;
  workspaceExportNotice: string | null;
  workspaceIndexLoading: boolean;
  onOpenFile: (path: string) => void;
  onSearchQueryChange: (query: string) => void;
  onTagChange: (tag: string | null) => void;
};

function pathName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function WorkspacePanel({
  workspacePath,
  files,
  visibleFiles,
  recentFiles,
  recentWorkspaces,
  activePath,
  searchQuery,
  searchResults,
  searchLoading,
  tagOptions,
  selectedTag,
  onChooseWorkspace,
  onOpenWorkspace,
  onExportWorkspace,
  workspaceExporting,
  workspaceExportNotice,
  workspaceIndexLoading,
  onOpenFile,
  onSearchQueryChange,
  onTagChange,
}: WorkspacePanelProps) {
  return (
    <section className="workspace-panel" aria-labelledby="workspace-title">
      <div className="workspace-heading">
        <div>
          <div className="panel-kicker">WORKSPACE</div>
          <h2 id="workspace-title">阅读库</h2>
        </div>
        <div className="workspace-actions">
          <details className="export-menu workspace-export-menu">
            <summary className="quiet-button">{workspaceExporting ? "导出中…" : "批量导出"}</summary>
            <div className="export-menu-panel">
              <button
                type="button"
                disabled={
                  !workspacePath ||
                  workspaceExporting ||
                  !files.some((file) => ["markdown", "text", "docx"].includes(file.kind))
                }
                onClick={() => onExportWorkspace("html")}
              >
                单文件 HTML
              </button>
              <button
                type="button"
                disabled={
                  !workspacePath ||
                  workspaceExporting ||
                  !files.some((file) => ["markdown", "text", "docx"].includes(file.kind))
                }
                onClick={() => onExportWorkspace("docx")}
              >
                单文件 Word
              </button>
              <button
                type="button"
                disabled={
                  !workspacePath ||
                  workspaceExporting ||
                  !files.some((file) => ["markdown", "text", "docx"].includes(file.kind))
                }
                onClick={() => onExportWorkspace("pdf")}
              >
                批量打印 / PDF
              </button>
            </div>
          </details>
          <button type="button" className="quiet-button" onClick={onChooseWorkspace}>
            {workspacePath ? "更换文件夹" : "添加文件夹"}
          </button>
        </div>
      </div>

      {workspacePath ? (
        <div className="workspace-location" title={workspacePath}>
          <span className="workspace-dot" aria-hidden="true" />
          <span>{pathName(workspacePath)}</span>
          <small>{files.length} 项</small>
        </div>
      ) : (
        <p className="workspace-help">添加一个文件夹，递归读取其中的文档并开启目录浏览和全文搜索。</p>
      )}
      {workspaceExportNotice && (
        <div className="workspace-export-note" role="status">
          {workspaceExportNotice}
        </div>
      )}
      {workspaceIndexLoading && (
        <div className="workspace-index-note" role="status">
          目录已打开，正在整理链接与标签…
        </div>
      )}

      {workspacePath && (
        <>
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
          {workspacePath && visibleFiles.length > 0 && (
            <div className="workspace-files" aria-label="工作区文件">
              <div className="workspace-subheading">文件</div>
              <WorkspaceTreeView files={visibleFiles} activePath={activePath} onOpenFile={onOpenFile} />
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
