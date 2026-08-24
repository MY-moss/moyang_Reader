import type { ExportMargin, ExportOrientation, ExportPaper, ReadingScale, ReadingWidth, ThemeMode } from "../types";
import type { UpdateStatus } from "../updater";

type TopBarProps = {
  fileName: string | null;
  mode: "rendered" | "source";
  canEdit: boolean;
  modified: boolean;
  searchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  searchResultIndex: number;
  theme: ThemeMode;
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
  onChooseWorkspace: () => void;
  onQuickOpen: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onToggleMode: () => void;
  onSave: () => void;
  onCopy: () => void;
  copyFeedback: boolean;
  canCopy: boolean;
  onExport: () => void;
  exportLabel?: string;
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
  onToggleSearch: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  onCloseSearch: () => void;
  onCycleTheme: () => void;
};

export function TopBar({
  fileName,
  mode,
  canEdit,
  modified,
  searchOpen,
  searchQuery,
  searchResultCount,
  searchResultIndex,
  theme,
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
  onChooseWorkspace,
  onQuickOpen,
  sidebarCollapsed,
  onToggleSidebar,
  focusMode,
  onToggleFocusMode,
  onToggleMode,
  onSave,
  onCopy,
  copyFeedback,
  canCopy,
  onExport,
  exportLabel = "打印 / PDF",
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
  onToggleSearch,
  onSearchQueryChange,
  onSearchPrevious,
  onSearchNext,
  onCloseSearch,
  onCycleTheme,
}: TopBarProps) {
  const themeLabel = theme === "system" ? "系统" : theme === "light" ? "浅色" : "深色";
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
  const updateTitle = updateVersion ? "发现 v" + updateVersion.replace(/^v/i, "") + "，打开更新提示" : "检查应用更新";

  return (
    <header className="topbar">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true">
          M
        </span>
        <div>
          <div className="brand-name">Moyang Reader</div>
          <div className="brand-subtitle">本地阅读器</div>
        </div>
      </div>

      <div className="document-title" title={fileName ?? undefined}>
        {fileName ?? "选择一个文档开始阅读"}
        {modified && <span className="modified-dot" aria-label="有未保存修改" />}
      </div>

      <nav className="toolbar" aria-label="文档操作">
        <button type="button" className="toolbar-button" onClick={onOpen} title="打开文件 (Ctrl+O)">
          打开
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={onChooseWorkspace}
          title="添加整个文件夹 (Ctrl+Shift+O)"
        >
          文件夹
        </button>
        <button type="button" className="toolbar-button" onClick={onQuickOpen} title="快速打开文档 (Ctrl+P)">
          快速打开
        </button>
        <button
          type="button"
          className="toolbar-button sidebar-toggle"
          onClick={onToggleSidebar}
          aria-pressed={sidebarCollapsed}
          title={sidebarCollapsed ? "显示侧栏 (Ctrl+Shift+B)" : "隐藏侧栏 (Ctrl+Shift+B)"}
        >
          {sidebarCollapsed ? "显示侧栏" : "侧栏"}
        </button>
        <button
          type="button"
          className="toolbar-button focus-button"
          onClick={onToggleFocusMode}
          disabled={!fileName}
          title={focusMode ? "退出专注阅读 (Esc)" : "进入专注阅读 (Ctrl+Shift+Enter)"}
        >
          {focusMode ? "退出专注" : "专注"}
        </button>
        <button type="button" className="toolbar-button" onClick={onToggleSearch} title="查找文档内容 (Ctrl+F)">
          搜索
        </button>
        <button type="button" className="toolbar-button" onClick={onToggleMode} disabled={!fileName || !canEdit}>
          {mode === "rendered" ? "源文本" : "阅读"}
        </button>
        <button type="button" className="toolbar-button" onClick={onSave} disabled={!modified}>
          保存
        </button>
        <button type="button" className="toolbar-button" onClick={onCopy} disabled={!canCopy} title="复制当前文档内容">
          {copyFeedback ? "已复制" : "复制"}
        </button>
        <button type="button" className="toolbar-button" onClick={onCycleTheme} title="切换阅读主题">
          {themeLabel}
        </button>
        <details className="settings-menu">
          <summary className="toolbar-button" title="隐私与更新设置">
            设置
          </summary>
          <div className="settings-menu-panel">
            <div className="settings-menu-title">本地优先</div>
            <label className="settings-option">
              <input
                type="checkbox"
                checked={allowRemoteResources}
                onChange={(event) => onAllowRemoteResourcesChange(event.target.checked)}
              />
              <span>
                <strong>允许远程图片</strong>
                <small>关闭时只显示本地附件，减少文档追踪请求。</small>
              </span>
            </label>
            <label className="settings-option">
              <input
                type="checkbox"
                checked={startupUpdateCheck}
                onChange={(event) => onStartupUpdateCheckChange(event.target.checked)}
              />
              <span>
                <strong>启动时检查更新</strong>
                <small>关闭后仍可点击“更新”手动检查。</small>
              </span>
            </label>
            <div className="settings-divider">阅读排版</div>
            <label className="settings-select-option">
              <span>正文字号</span>
              <select
                aria-label="正文字号"
                value={readingScale}
                onChange={(event) => onReadingScaleChange(event.target.value as ReadingScale)}
              >
                <option value="small">紧凑</option>
                <option value="medium">标准</option>
                <option value="large">舒适</option>
              </select>
            </label>
            <label className="settings-select-option">
              <span>正文宽度</span>
              <select
                aria-label="正文宽度"
                value={readingWidth}
                onChange={(event) => onReadingWidthChange(event.target.value as ReadingWidth)}
              >
                <option value="narrow">窄</option>
                <option value="standard">标准</option>
                <option value="wide">宽</option>
              </select>
            </label>
            <div className="settings-divider">导出排版</div>
            <label className="settings-select-option">
              <span>导出纸张</span>
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
              <span>导出方向</span>
              <select
                aria-label="导出方向"
                value={exportOrientation}
                onChange={(event) => onExportOrientationChange(event.target.value as ExportOrientation)}
              >
                <option value="portrait">纵向</option>
                <option value="landscape">横向</option>
              </select>
            </label>
            <label className="settings-select-option">
              <span>导出页边距</span>
              <select
                aria-label="导出页边距"
                value={exportMargin}
                onChange={(event) => onExportMarginChange(event.target.value as ExportMargin)}
              >
                <option value="compact">紧凑</option>
                <option value="standard">标准</option>
                <option value="wide">宽松</option>
              </select>
            </label>
            <small className="settings-note">应用于打印 / PDF、HTML 和 Word 导出。</small>
          </div>
        </details>
        <button
          type="button"
          className={"toolbar-button update-button" + (updateStatus === "available" ? " has-update" : "")}
          onClick={onCheckUpdates}
          disabled={updateStatus === "checking" || updateStatus === "downloading"}
          title={updateTitle}
        >
          {updateLabel}
        </button>
        <button type="button" className="toolbar-button primary" onClick={onExport} disabled={!fileName}>
          {exportLabel}
        </button>
        {(canExportMarkdown || canExportHtml || canExportDocx) && (
          <details className="export-menu">
            <summary className="toolbar-button" title="导出文件">
              导出
            </summary>
            <div className="export-menu-panel">
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
