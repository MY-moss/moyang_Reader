import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  DocumentKind,
  ExportMargin,
  ExportOrientation,
  ExportPaper,
  ReadingScale,
  ReadingWidth,
  ReaderMode,
  ThemeMode,
} from "../types";
import { translate, type Locale, type MessageKey } from "../i18n";
import type { UpdateStatus } from "../updater";

type TopBarProps = {
  fileName: string | null;
  mode: ReaderMode;
  documentKind: DocumentKind | null;
  canEdit: boolean;
  modified: boolean;
  externallyModified: boolean;
  onShowExternalChange: () => void;
  searchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  searchResultIndex: number;
  theme: ThemeMode;
  locale: Locale;
  readingScale: ReadingScale;
  readingWidth: ReadingWidth;
  exportPaper: ExportPaper;
  exportOrientation: ExportOrientation;
  exportMargin: ExportMargin;
  onReadingScaleChange: (scale: ReadingScale) => void;
  onReadingWidthChange: (width: ReadingWidth) => void;
  onExportPaperChange: (paper: ExportPaper) => void;
  onExportOrientationChange: (orientation: ExportOrientation) => void;
  onExportMarginChange: (margin: ExportMargin) => void;
  onOpen: () => void;
  onAddWorkspace: () => void;
  onQuickOpen: () => void;
  workspaceOpen: boolean;
  workspaceLimitReached: boolean;
  draftCount: number;
  onOpenRecovery: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onToggleMode: () => void;
  onCycleMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onOpenCommandPalette: () => void;
  onSave: () => void;
  onCopy: () => void;
  copyFeedback: boolean;
  canCopy: boolean;
  onExport: () => void;
  exportLabel?: string;
  canPreviewPrint: boolean;
  onPreviewPrint: () => void;
  canExportMarkdown: boolean;
  canExportHtml: boolean;
  canExportDocx: boolean;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportDocx: () => void;
  updateStatus: UpdateStatus;
  updateVersion: string | null;
  onCheckUpdates: () => void;
  allowRemoteResources: boolean;
  startupUpdateCheck: boolean;
  onAllowRemoteResourcesChange: (allowed: boolean) => void;
  onStartupUpdateCheckChange: (enabled: boolean) => void;
  onExportSettings: () => void;
  onImportSettings: () => void;
  onToggleSearch: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  onCloseSearch: () => void;
  onCycleTheme: () => void;
  onLocaleChange: (locale: Locale) => void;
};

export function TopBar({
  fileName,
  mode,
  documentKind,
  canEdit,
  modified,
  externallyModified,
  onShowExternalChange,
  searchOpen,
  searchQuery,
  searchResultCount,
  searchResultIndex,
  theme,
  locale,
  readingScale,
  readingWidth,
  exportPaper,
  exportOrientation,
  exportMargin,
  onReadingScaleChange,
  onReadingWidthChange,
  onExportPaperChange,
  onExportOrientationChange,
  onExportMarginChange,
  onOpen,
  onAddWorkspace,
  onQuickOpen,
  workspaceOpen,
  workspaceLimitReached,
  draftCount,
  onOpenRecovery,
  sidebarCollapsed,
  onToggleSidebar,
  focusMode,
  onToggleFocusMode,
  onToggleMode,
  onCycleMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  rightPanelOpen,
  onToggleRightPanel,
  onOpenCommandPalette,
  onSave,
  onCopy,
  copyFeedback,
  canCopy,
  onExport,
  exportLabel = "打印 / PDF",
  canPreviewPrint,
  onPreviewPrint,
  canExportMarkdown,
  canExportHtml,
  canExportDocx,
  onExportMarkdown,
  onExportHtml,
  onExportDocx,
  updateStatus,
  updateVersion,
  onCheckUpdates,
  allowRemoteResources,
  startupUpdateCheck,
  onAllowRemoteResourcesChange,
  onStartupUpdateCheckChange,
  onExportSettings,
  onImportSettings,
  onToggleSearch,
  onSearchQueryChange,
  onSearchPrevious,
  onSearchNext,
  onCloseSearch,
  onCycleTheme,
  onLocaleChange,
}: TopBarProps) {
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const settingsMenuRef = useRef<HTMLDetailsElement>(null);
  const moreMenuRef = useRef<HTMLDetailsElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const [toolbarHasOverflow, setToolbarHasOverflow] = useState(false);
  useEffect(() => {
    const menuRefs = [moreMenuRef, settingsMenuRef, exportMenuRef];
    const closeMenus = () => {
      for (const menuRef of menuRefs) {
        menuRef.current?.removeAttribute("open");
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || menuRefs.some((menuRef) => menuRef.current?.contains(target))) return;
      closeMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menuRefs.some((menuRef) => menuRef.current?.open)) return;
      const target = event.target;
      const isInsideMenu = target instanceof Node && menuRefs.some((menuRef) => menuRef.current?.contains(target));
      closeMenus();
      if (isInsideMenu) {
        event.preventDefault();
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
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const updateOverflow = () => {
      setToolbarHasOverflow(toolbar.scrollWidth > toolbar.clientWidth + 1);
    };

    const frameId = window.requestAnimationFrame(updateOverflow);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateOverflow);
    resizeObserver?.observe(toolbar);
    window.addEventListener("resize", updateOverflow);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [
    canEdit,
    copyFeedback,
    documentKind,
    draftCount,
    externallyModified,
    fileName,
    focusMode,
    locale,
    mode,
    modified,
    rightPanelOpen,
    searchOpen,
    sidebarCollapsed,
    updateStatus,
    workspaceLimitReached,
    workspaceOpen,
  ]);
  const themeLabel = theme === "system" ? "系统" : theme === "light" ? "浅色" : "深色";
  const t = (key: MessageKey) => translate(locale, key);
  const closeDropdownMenus = () => {
    settingsMenuRef.current?.removeAttribute("open");
    exportMenuRef.current?.removeAttribute("open");
    moreMenuRef.current?.removeAttribute("open");
  };
  const closeNestedMenusWhenClosed = () => {
    if (!moreMenuRef.current?.open) {
      settingsMenuRef.current?.removeAttribute("open");
      exportMenuRef.current?.removeAttribute("open");
    }
  };
  const closeSearchIfOpen = () => {
    if (searchOpen) onCloseSearch();
  };
  const dismissTopbarOverlays = () => {
    closeDropdownMenus();
    closeSearchIfOpen();
  };
  const toggleSearch = () => {
    closeDropdownMenus();
    if (searchOpen) onCloseSearch();
    else onToggleSearch();
  };
  const updateLabel =
    updateStatus === "checking"
      ? "检查中…"
      : updateStatus === "downloading"
        ? "下载中…"
        : updateStatus === "available"
          ? "有更新"
          : updateStatus === "ready"
            ? "已更新"
            : updateStatus === "up-to-date"
              ? "已是最新"
              : "更新";
  const updateTitle =
    updateStatus === "downloading"
      ? "打开更新进度"
      : updateVersion
        ? "发现 v" + updateVersion.replace(/^v/i, "") + "，打开更新提示"
        : "检查应用更新";

  return (
    <header className="topbar">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true">
          M
        </span>
        <div>
          <div className="brand-name">Moyang Reader</div>
          <div className="brand-subtitle">{t("brand.subtitle")}</div>
        </div>
      </div>

      <div className="document-title" title={fileName ?? undefined}>
        {fileName ?? t("document.empty")}
        {modified && <span className="modified-dot" aria-label="有未保存修改" />}
        {externallyModified && (
          <button
            type="button"
            className="external-modified-indicator"
            aria-label="文件已被外部修改，查看处理选项"
            title="文件已被外部修改，查看处理选项"
            onClick={onShowExternalChange}
          >
            !
          </button>
        )}
      </div>

      <nav
        ref={toolbarRef}
        className={"toolbar" + (toolbarHasOverflow ? " has-overflow" : "")}
        title={toolbarHasOverflow ? "还有更多操作，可横向滚动" : undefined}
        aria-label="文档操作"
      >
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            dismissTopbarOverlays();
            onOpen();
          }}
          title="打开文件 (Ctrl+O)"
        >
          {t("action.open")}
        </button>
        {sidebarCollapsed && (
          <button
            type="button"
            className="toolbar-button"
            onClick={() => {
              dismissTopbarOverlays();
              onAddWorkspace();
            }}
            disabled={workspaceLimitReached}
            title={
              workspaceLimitReached
                ? "已达到阅读库上限，请先移除一个已挂载阅读库"
                : `${workspaceOpen ? "添加阅读库" : "添加整个文件夹"} (Ctrl+Shift+O)`
            }
          >
            {workspaceOpen ? "添加阅读库" : t("action.folder")}
          </button>
        )}
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            dismissTopbarOverlays();
            onQuickOpen();
          }}
          title="快速打开文档 (Ctrl+P)"
        >
          {t("action.quickOpen")}
        </button>
        {fileName && canEdit && (
          <button
            type="button"
            className="toolbar-button editor-mode-button"
            onClick={() => {
              dismissTopbarOverlays();
              onToggleMode();
            }}
            aria-pressed={mode !== "rendered"}
            aria-label={mode === "rendered" ? "直接进入编辑模式" : "直接返回阅读模式"}
            aria-keyshortcuts="Control+E"
            title={`${mode === "rendered" ? "进入编辑模式" : "返回阅读模式"} (Ctrl+E)`}
          >
            {mode === "rendered" ? t("action.edit") : t("action.read")}
          </button>
        )}
        {fileName && canEdit && mode !== "rendered" && (
          <div className="toolbar-history" role="group" aria-label="编辑历史">
            <button
              type="button"
              className="toolbar-button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="撤销"
              aria-keyshortcuts="Control+Z"
              title="撤销 (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="重做"
              aria-keyshortcuts="Control+Y"
              title="重做 (Ctrl+Y)"
            >
              ↷
            </button>
          </div>
        )}
        {draftCount > 0 && (
          <button
            type="button"
            className="toolbar-button recovery-button"
            onClick={onOpenRecovery}
            title="查看未保存草稿"
          >
            {t("action.drafts")} {draftCount}
          </button>
        )}
        <button
          type="button"
          className="toolbar-button sidebar-toggle"
          onClick={onToggleSidebar}
          aria-pressed={sidebarCollapsed}
          aria-keyshortcuts="Control+Shift+B"
          title={sidebarCollapsed ? "显示侧栏 (Ctrl+Shift+B)" : "隐藏侧栏 (Ctrl+Shift+B)"}
        >
          {sidebarCollapsed ? t("action.showSidebar") : t("action.hideSidebar")}
        </button>
        <button
          type="button"
          className="toolbar-button context-toggle"
          onClick={onToggleRightPanel}
          aria-pressed={rightPanelOpen}
          aria-keyshortcuts="Control+Shift+R"
          title={rightPanelOpen ? "隐藏上下文面板 (Ctrl+Shift+R)" : "显示上下文面板 (Ctrl+Shift+R)"}
        >
          {rightPanelOpen ? t("action.hideContext") : t("action.showContext")}
        </button>
        <button
          type="button"
          className="toolbar-button focus-button"
          onClick={onToggleFocusMode}
          disabled={!fileName}
          title={focusMode ? "退出专注阅读 (Esc)" : "进入专注阅读 (Ctrl+Shift+Enter)"}
        >
          {focusMode ? t("action.exitFocus") : t("action.focus")}
        </button>
        <button type="button" className="toolbar-button" onClick={toggleSearch} title="查找文档内容 (Ctrl+F)">
          {t("action.search")}
        </button>
        <details ref={moreMenuRef} className="toolbar-overflow" onToggle={closeNestedMenusWhenClosed}>
          <summary className="toolbar-button toolbar-overflow-trigger" title={t("action.moreTools")}>
            {t("action.more")}
          </summary>
          <div className="toolbar-overflow-panel">
            <div className="toolbar-overflow-group">
              <div className="toolbar-overflow-label">{t("action.documentTools")}</div>
              <div className="toolbar-overflow-actions">
                <button type="button" className="toolbar-button" onClick={onOpenCommandPalette}>
                  {t("action.commands")}
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => {
                    dismissTopbarOverlays();
                    onCycleMode();
                  }}
                  disabled={!fileName || !canEdit}
                >
                  {mode === "rendered"
                    ? documentKind === "markdown"
                      ? t("action.edit")
                      : t("action.source")
                    : mode === "wysiwyg"
                      ? t("action.source")
                      : t("action.read")}
                </button>
                <button type="button" className="toolbar-button" onClick={onSave} disabled={!modified}>
                  {t("action.save")}
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={onCopy}
                  disabled={!canCopy}
                  title="复制当前文档内容"
                >
                  {copyFeedback ? t("action.copied") : t("action.copy")}
                </button>
              </div>
            </div>
            <div className="toolbar-overflow-group">
              <div className="toolbar-overflow-label">{t("action.appearance")}</div>
              <div className="toolbar-overflow-actions">
                <button type="button" className="toolbar-button" onClick={onCycleTheme} title="切换阅读主题">
                  {locale === "en-US"
                    ? theme === "system"
                      ? t("action.theme.system")
                      : theme === "light"
                        ? t("action.theme.light")
                        : t("action.theme.dark")
                    : themeLabel}
                </button>
                <button
                  type="button"
                  className={"toolbar-button update-button" + (updateStatus === "available" ? " has-update" : "")}
                  onClick={onCheckUpdates}
                  disabled={updateStatus === "checking"}
                  title={updateTitle}
                >
                  {updateLabel}
                </button>
              </div>
            </div>
            <div className="toolbar-overflow-group toolbar-overflow-settings">
              <details
                ref={settingsMenuRef}
                className="settings-menu"
                onClick={() => {
                  closeSearchIfOpen();
                  exportMenuRef.current?.removeAttribute("open");
                }}
              >
                <summary className="toolbar-button" title="隐私与更新设置">
                  {t("settings.title")}
                </summary>
                <div className="settings-menu-panel">
                  <div className="settings-menu-title">{t("settings.localFirst")}</div>
                  <label className="settings-select-option">
                    <span>{t("settings.language")}</span>
                    <select
                      aria-label={t("settings.language")}
                      value={locale}
                      onChange={(event) => onLocaleChange(event.target.value as Locale)}
                    >
                      <option value="zh-CN">{t("settings.language.zh")}</option>
                      <option value="en-US">{t("settings.language.en")}</option>
                    </select>
                  </label>
                  <label className="settings-option">
                    <input
                      type="checkbox"
                      checked={allowRemoteResources}
                      onChange={(event) => onAllowRemoteResourcesChange(event.target.checked)}
                    />
                    <span>
                      <strong>{t("settings.allowRemoteImages")}</strong>
                      <small>{t("settings.remoteImagesNote")}</small>
                    </span>
                  </label>
                  <label className="settings-option">
                    <input
                      type="checkbox"
                      checked={startupUpdateCheck}
                      onChange={(event) => onStartupUpdateCheckChange(event.target.checked)}
                    />
                    <span>
                      <strong>{t("settings.startupUpdates")}</strong>
                      <small>{t("settings.startupUpdatesNote")}</small>
                    </span>
                  </label>
                  <div className="settings-divider">{t("settings.reading")}</div>
                  <label className="settings-select-option">
                    <span>{t("settings.fontSize")}</span>
                    <select
                      aria-label="正文字号"
                      value={readingScale}
                      onChange={(event) => onReadingScaleChange(event.target.value as ReadingScale)}
                    >
                      <option value="small">{t("settings.fontSize.compact")}</option>
                      <option value="medium">{t("settings.fontSize.standard")}</option>
                      <option value="large">{t("settings.fontSize.comfortable")}</option>
                    </select>
                  </label>
                  <label className="settings-select-option">
                    <span>{t("settings.width")}</span>
                    <select
                      aria-label="正文宽度"
                      value={readingWidth}
                      onChange={(event) => onReadingWidthChange(event.target.value as ReadingWidth)}
                    >
                      <option value="narrow">{t("settings.width.narrow")}</option>
                      <option value="standard">{t("settings.width.standard")}</option>
                      <option value="wide">{t("settings.width.wide")}</option>
                    </select>
                  </label>
                  <div className="settings-divider">{t("settings.export")}</div>
                  <label className="settings-select-option">
                    <span>{t("settings.paper")}</span>
                    <select
                      aria-label="导出纸张"
                      value={exportPaper}
                      onChange={(event) => onExportPaperChange(event.target.value as ExportPaper)}
                    >
                      <option value="a4">A4</option>
                      <option value="letter">Letter</option>
                    </select>
                  </label>
                  <label className="settings-select-option">
                    <span>{t("settings.orientation")}</span>
                    <select
                      aria-label="导出方向"
                      value={exportOrientation}
                      onChange={(event) => onExportOrientationChange(event.target.value as ExportOrientation)}
                    >
                      <option value="portrait">{t("settings.orientation.portrait")}</option>
                      <option value="landscape">{t("settings.orientation.landscape")}</option>
                    </select>
                  </label>
                  <label className="settings-select-option">
                    <span>{t("settings.margin")}</span>
                    <select
                      aria-label="导出页边距"
                      value={exportMargin}
                      onChange={(event) => onExportMarginChange(event.target.value as ExportMargin)}
                    >
                      <option value="compact">{t("settings.margin.compact")}</option>
                      <option value="standard">{t("settings.margin.standard")}</option>
                      <option value="wide">{t("settings.margin.wide")}</option>
                    </select>
                  </label>
                  <small className="settings-note">{t("settings.exportNote")}</small>
                  <div className="settings-divider">{t("settings.migration")}</div>
                  <div className="settings-actions">
                    <button type="button" className="quiet-button" onClick={onExportSettings}>
                      {t("settings.exportSettings")}
                    </button>
                    <button type="button" className="quiet-button" onClick={onImportSettings}>
                      {t("settings.importSettings")}
                    </button>
                  </div>
                  <small className="settings-note">{t("settings.backupNote")}</small>
                </div>
              </details>
            </div>
            <div className="toolbar-overflow-group toolbar-overflow-settings">
              <button type="button" className="toolbar-button primary" onClick={onExport} disabled={!fileName}>
                {exportLabel}
              </button>
              {(canExportMarkdown || canExportHtml || canExportDocx) && (
                <details
                  ref={exportMenuRef}
                  className="export-menu"
                  onClick={() => {
                    closeSearchIfOpen();
                    settingsMenuRef.current?.removeAttribute("open");
                  }}
                >
                  <summary className="toolbar-button" title="导出文件">
                    导出
                  </summary>
                  <div className="export-menu-panel">
                    {canPreviewPrint && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const menu = exportMenuRef.current;
                          if (menu) {
                            menu.open = false;
                            menu.removeAttribute("open");
                          }
                          onPreviewPrint();
                        }}
                      >
                        预览打印版式
                      </button>
                    )}
                    {canExportMarkdown && (
                      <button type="button" onClick={onExportMarkdown}>
                        导出 Markdown / 文本
                      </button>
                    )}
                    {canExportHtml && (
                      <button type="button" onClick={onExportHtml}>
                        导出 HTML（含图片）
                      </button>
                    )}
                    {canExportDocx && (
                      <button type="button" onClick={onExportDocx}>
                        导出 Word（DOCX）
                      </button>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </details>
      </nav>

      {searchOpen && (
        <div className="findbar" role="search">
          <input
            autoFocus
            type="search"
            aria-label="搜索文档"
            placeholder={fileName ? "在当前文档中查找" : "先打开一个文档"}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCloseSearch();
              if (event.key === "Enter") {
                if (event.shiftKey) onSearchPrevious();
                else onSearchNext();
              }
            }}
          />
          <span className="find-count">
            {searchResultCount === 0 ? "无结果" : `${searchResultIndex + 1} / ${searchResultCount}`}
          </span>
          <button type="button" className="find-button" onClick={onSearchPrevious} aria-label="上一个结果">
            ↑
          </button>
          <button type="button" className="find-button" onClick={onSearchNext} aria-label="下一个结果">
            ↓
          </button>
          <button type="button" className="find-button" onClick={onCloseSearch} aria-label="关闭搜索">
            ×
          </button>
        </div>
      )}
    </header>
  );
}
