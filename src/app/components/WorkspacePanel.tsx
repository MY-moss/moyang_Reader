import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

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
import { formatRecentFileTime, MAX_MOUNTED_WORKSPACES } from "../storage";
import { ReadingHistoryPanel } from "./ReadingHistoryPanel";
import type { ReadingHistoryEntry } from "../reading-history";
import { translate, type Locale, type MessageKey } from "../i18n";
import { Icon } from "./Icon";

const workspaceKindOptions: WorkspaceKindFilter[] = ["all", "markdown", "text", "docx", "pdf", "image"];

type WorkspacePanelProps = {
  locale?: Locale;
  workspacePath: string | null;
  files: WorkspaceFile[];
  folders?: WorkspaceDirectory[];
  visibleFiles: WorkspaceFile[];
  visibleResultCount: number;
  exportableFiles: WorkspaceFile[];
  recentFiles: RecentFile[];
  readingHistory: ReadingHistoryEntry[];
  onRequestClearReadingHistory: () => void;
  recentWorkspaces: RecentWorkspace[];
  mountedWorkspaces: RecentWorkspace[];
  activePath: string | null;
  searchInputRef?: RefObject<HTMLInputElement>;
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
  locale = "zh-CN",
  workspacePath,
  files,
  folders = [],
  visibleFiles,
  visibleResultCount,
  exportableFiles,
  recentFiles,
  readingHistory,
  onRequestClearReadingHistory,
  recentWorkspaces,
  mountedWorkspaces,
  activePath,
  searchInputRef,
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
  const createMenuRef = useRef<HTMLDetailsElement>(null);
  const manageMenuRef = useRef<HTMLDetailsElement>(null);
  const previousWorkspacePath = useRef(workspacePath);
  const [searchExpanded, setSearchExpanded] = useState(
    Boolean(searchQuery.trim() || selectedTag || selectedKind !== "all"),
  );
  const [historyOpen, setHistoryOpen] = useState(!workspacePath || readingHistory.length > 0);
  const t = (key: MessageKey) => translate(locale, key);
  const selectedKindLabel = t(`workspace.kind.${selectedKind}`);
  const hasFilters = Boolean(selectedTag) || selectedKind !== "all";
  const switchableWorkspaces = filterSwitchableWorkspaces(mountedWorkspaces, workspacePath);
  const canBatchExport = Boolean(workspacePath && exportableFiles.some(isBatchExportable));
  const treeFolders = hasFilters ? [] : folders;

  const closeOtherWorkspaceMenus = (activeMenu: HTMLDetailsElement | null) => {
    for (const menu of [createMenuRef.current, manageMenuRef.current]) {
      if (menu !== activeMenu) menu?.removeAttribute("open");
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const menu = event.currentTarget;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    if (items.length === 0) return;
    event.preventDefault();
    menu.open = true;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : current < 0
            ? event.key === "ArrowDown"
              ? 0
              : items.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % items.length
              : (current + items.length - 1) % items.length;
    items[next]?.focus();
  };

  useEffect(() => {
    if (searchQuery.trim() || hasFilters) setSearchExpanded(true);
  }, [searchQuery, hasFilters]);

  useEffect(() => {
    if (previousWorkspacePath.current === workspacePath) return;
    previousWorkspacePath.current = workspacePath;
    setHistoryOpen(!workspacePath || readingHistory.length > 0);
  }, [workspacePath, readingHistory.length]);

  useEffect(() => {
    const closeWorkspaceMenus = () => {
      createMenuRef.current?.removeAttribute("open");
      manageMenuRef.current?.removeAttribute("open");
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        [createMenuRef.current, manageMenuRef.current].some((menu) => menu?.contains(target))
      )
        return;
      closeWorkspaceMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!createMenuRef.current?.open && !manageMenuRef.current?.open)) return;
      const target = event.target;
      const activeTrigger = [createMenuRef.current, manageMenuRef.current]
        .find((menu) => menu?.open)
        ?.querySelector<HTMLElement>("summary");
      closeWorkspaceMenus();
      event.preventDefault();
      activeTrigger?.focus();
      if (
        target instanceof Node &&
        [createMenuRef.current, manageMenuRef.current].some((menu) => menu?.contains(target))
      ) {
        event.stopPropagation();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return (
    <section className="workspace-panel" aria-labelledby="workspace-title">
      <div className="workspace-heading">
        <div className="workspace-heading-copy">
          <h2 id="workspace-title">{t("workspace.title")}</h2>
        </div>
        {workspacePath && (
          <div className="workspace-actions" aria-label={t("workspace.actions")}>
            {onCreateNote && onCreateFolder && (
              <details
                ref={createMenuRef}
                className="workspace-create-menu workspace-action-menu"
                onKeyDown={handleMenuKeyDown}
                onClick={() => closeOtherWorkspaceMenus(createMenuRef.current)}
                onToggle={() => {
                  if (createMenuRef.current?.open) closeOtherWorkspaceMenus(createMenuRef.current);
                }}
              >
                <summary className="quiet-button workspace-create-button workspace-action-trigger">
                  {t("workspace.create")}
                </summary>
                <div className="workspace-create-menu-panel" role="menu">
                  <div className="workspace-switcher-label">{t("workspace.root")}</div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      onCreateNote("");
                    }}
                  >
                    {t("workspace.createNote")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      onCreateFolder("");
                    }}
                  >
                    {t("workspace.createFolder")}
                  </button>
                </div>
              </details>
            )}
            <button
              type="button"
              className="quiet-button workspace-search-toggle"
              aria-expanded={searchExpanded}
              aria-controls="workspace-search-controls"
              onClick={() => {
                setSearchExpanded((current) => !current);
                if (!searchExpanded) requestAnimationFrame(() => searchInputRef?.current?.focus());
              }}
            >
              <Icon name="search" size={15} />
              {t("workspace.search")}
              {hasFilters && <span className="workspace-active-dot" aria-hidden="true" />}
            </button>
            <details
              ref={manageMenuRef}
              className="workspace-manage-menu workspace-action-menu"
              onKeyDown={handleMenuKeyDown}
              onClick={() => closeOtherWorkspaceMenus(manageMenuRef.current)}
              onToggle={() => {
                if (manageMenuRef.current?.open) closeOtherWorkspaceMenus(manageMenuRef.current);
              }}
            >
              <summary className="quiet-button workspace-action-trigger" aria-label={t("workspace.manage")}>
                <Icon name="more-horizontal" size={18} />
              </summary>
              <div className="workspace-manage-panel" role="menu">
                <div className="workspace-switcher-label">{t("workspace.manage")}</div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={workspaceLimitReached}
                  title={
                    workspaceLimitReached
                      ? t("workspace.limitReached").replace("{count}", String(MAX_MOUNTED_WORKSPACES))
                      : t("workspace.addTitle")
                  }
                  onClick={() => {
                    manageMenuRef.current?.removeAttribute("open");
                    onAddWorkspace();
                  }}
                >
                  {t("workspace.add")}
                </button>
                {switchableWorkspaces.length > 0 && (
                  <>
                    <div className="workspace-switcher-label">
                      {t("workspace.mounted")} · {mountedWorkspaces.length} / {MAX_MOUNTED_WORKSPACES}
                    </div>
                    {switchableWorkspaces.map((workspace) => (
                      <div className="workspace-switcher-item" role="none" key={workspace.path}>
                        <button
                          type="button"
                          role="menuitem"
                          title={workspace.path}
                          onClick={() => {
                            manageMenuRef.current?.removeAttribute("open");
                            onOpenWorkspace(workspace.path);
                          }}
                        >
                          <strong>{workspace.name}</strong>
                          <span>{workspace.path}</span>
                        </button>
                        <button
                          type="button"
                          className="workspace-switcher-remove"
                          title={t("workspace.remove").replace("{name}", workspace.name)}
                          aria-label={t("workspace.remove").replace("{name}", workspace.name)}
                          onClick={() => onRemoveWorkspace(workspace.path)}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
                {(canBatchExport || workspaceExporting) && (
                  <>
                    <div className="workspace-switcher-label">{t("workspace.batchExport")}</div>
                    {(["html", "docx", "pdf"] as const).map((format) => (
                      <button
                        type="button"
                        role="menuitem"
                        key={format}
                        disabled={!canBatchExport || workspaceExporting}
                        onClick={() => {
                          manageMenuRef.current?.removeAttribute("open");
                          onExportWorkspace(format);
                        }}
                      >
                        {t(`workspace.export.${format}`)}
                      </button>
                    ))}
                    {workspaceExporting && (
                      <button
                        type="button"
                        role="menuitem"
                        className="workspace-export-cancel"
                        onClick={() => {
                          manageMenuRef.current?.removeAttribute("open");
                          onCancelWorkspaceExport();
                        }}
                      >
                        {t("workspace.cancelExport")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </details>
          </div>
        )}
      </div>

      {workspacePath ? (
        <div className="workspace-location" title={workspacePath}>
          <span className="workspace-dot" aria-hidden="true" />
          <span className="workspace-location-name">{pathName(workspacePath)}</span>
          <small>
            {t("workspace.counts")
              .replace("{files}", String(files.length))
              .replace("{libraries}", String(mountedWorkspaces.length))}
          </small>
        </div>
      ) : (
        <p className="workspace-help">{t("workspace.help")}</p>
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
              {t("workspace.exportProgress")} {workspaceExportProgress.current} / {workspaceExportProgress.total}
            </span>
            <strong title={workspaceExportProgress.fileName}>{workspaceExportProgress.fileName}</strong>
          </div>
          <div
            className="workspace-export-progress-track"
            role="progressbar"
            aria-label={t("workspace.exportProgressLabel")}
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
          <summary>{t("workspace.exportFailures").replace("{count}", String(workspaceExportFailures.length))}</summary>
          <div className="workspace-export-failure-actions">
            <button type="button" className="quiet-button" onClick={onCopyExportFailures}>
              {t("workspace.copyList")}
            </button>
            <button type="button" className="quiet-button" onClick={onSaveExportFailures}>
              {t("workspace.saveList")}
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
          {t("workspace.indexLoading")}
        </div>
      )}
      {workspaceListingStatus.truncated && (
        <div className="workspace-limit-note" role="status">
          {t("workspace.truncated")}
        </div>
      )}

      {workspacePath && (
        <>
          <div
            id="workspace-search-controls"
            className={`workspace-search-controls${searchExpanded ? " is-open" : ""}`}
          >
            <div className="workspace-filter-summary" role="status">
              <span>
                {searchQuery.trim()
                  ? searchLoading
                    ? t("workspace.searchLoading")
                    : t("workspace.matchCount").replace("{count}", String(visibleResultCount))
                  : t("workspace.visibleCount")
                      .replace("{visible}", String(visibleFiles.length))
                      .replace("{total}", String(files.length))}
              </span>
              {hasFilters && (
                <>
                  <span className="workspace-filter-label">
                    · {selectedKind !== "all" ? selectedKindLabel : ""}
                    {selectedKind !== "all" && selectedTag ? " · " : ""}
                    {selectedTag ? `#${selectedTag}` : ""}
                  </span>
                  <button type="button" className="workspace-clear-filter" onClick={onClearFilters}>
                    {t("workspace.clearFilters")}
                  </button>
                </>
              )}
            </div>
            <input
              ref={searchInputRef}
              className={`workspace-search${searchExpanded ? "" : " is-collapsed"}`}
              type="search"
              aria-label={t("workspace.searchLabel")}
              placeholder={t("workspace.searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onFocus={() => setSearchExpanded(true)}
            />
            {tagOptions.length > 0 && (
              <label className="tag-filter">
                <span>{t("workspace.tags")}</span>
                <select
                  aria-label={t("workspace.tagFilter")}
                  value={selectedTag ?? ""}
                  onChange={(event) => onTagChange(event.target.value || null)}
                >
                  <option value="">{t("workspace.allTags")}</option>
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      #{tag}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="tag-filter">
              <span>{t("workspace.kind")}</span>
              <select
                aria-label={t("workspace.kindFilter")}
                value={selectedKind}
                onChange={(event) => onKindChange(event.target.value as WorkspaceKindFilter)}
              >
                {workspaceKindOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(`workspace.kind.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {searchQuery.trim() ? (
        <div className="workspace-results" aria-live="polite">
          {searchQuery.trim().length < 2 && <p className="muted-copy">{t("workspace.searchHint")}</p>}
          {searchLoading && <p className="muted-copy">{t("workspace.searching")}</p>}
          {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
            <p className="muted-copy">{t("workspace.noMatches")}</p>
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
            <div className="workspace-files" aria-label={t("workspace.filesLabel")}>
              <div className="workspace-subheading">{t("workspace.files")}</div>
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

          {workspacePath && visibleFiles.length === 0 && <p className="muted-copy">{t("workspace.noFiles")}</p>}

          {!workspacePath && recentWorkspaces.length > 0 && (
            <div className="workspace-files recent-files" aria-label={t("workspace.recentLibraries")}>
              <div className="workspace-subheading">{t("workspace.recentLibraries")}</div>
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
            <div className="workspace-files recent-files" aria-label={t("workspace.recentFiles")}>
              <div className="workspace-subheading">{t("workspace.recentFiles")}</div>
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
                  <small>
                    {t("workspace.lastOpened")}
                    {locale === "zh-CN" ? "：" : ": "}
                    {formatRecentFileTime(file.lastOpenedAt, undefined, locale)}
                  </small>
                </button>
              ))}
            </div>
          )}

          <details
            className="workspace-history-disclosure"
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary>
              <Icon name="history" size={16} />
              {t("workspace.historyToggle")}
            </summary>
            <ReadingHistoryPanel
              entries={readingHistory}
              onRequestClear={onRequestClearReadingHistory}
              locale={locale}
            />
          </details>
        </>
      )}
    </section>
  );
}
