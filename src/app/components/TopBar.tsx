import { useRef } from "react";
import type { ExportMargin, ExportOrientation, ExportPaper, ReadingScale, ReadingWidth, ThemeMode } from "../types";
import { translate, type Locale, type MessageKey } from "../i18n";
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
  onChooseWorkspace: () => void;
  onQuickOpen: () => void;
  draftCount: number;
  onOpenRecovery: () => void;
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
  canEdit,
  modified,
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
  onChooseWorkspace,
  onQuickOpen,
  draftCount,
  onOpenRecovery,
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
  const themeLabel = theme === "system" ? "系统" : theme === "light" ? "浅色" : "深色";
  const t = (key: MessageKey) => translate(locale, key);
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
          <div className="brand-subtitle">{t("brand.subtitle")}</div>
        </div>
      </div>

      <div className="document-title" title={fileName ?? undefined}>
        {fileName ?? t("document.empty")}
        {modified && <span className="modified-dot" aria-label="有未保存修改" />}
      </div>

      <nav className="toolbar" aria-label="文档操作">
        <button type="button" className="toolbar-button" onClick={onOpen} title="打开文件 (Ctrl+O)">
          {t("action.open")}
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={onChooseWorkspace}
          title="添加整个文件夹 (Ctrl+Shift+O)"
        >
          {t("action.folder")}
        </button>
        <button type="button" className="toolbar-button" onClick={onQuickOpen} title="快速打开文档 (Ctrl+P)">
          {t("action.quickOpen")}
        </button>
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
          title={sidebarCollapsed ? "显示侧栏 (Ctrl+Shift+B)" : "隐藏侧栏 (Ctrl+Shift+B)"}
        >
          {sidebarCollapsed ? t("action.showSidebar") : t("action.hideSidebar")}
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
        <button type="button" className="toolbar-button" onClick={onToggleSearch} title="查找文档内容 (Ctrl+F)">
          {t("action.search")}
        </button>
        <button type="button" className="toolbar-button" onClick={onToggleMode} disabled={!fileName || !canEdit}>
          {mode === "rendered" ? t("action.source") : t("action.read")}
        </button>
        <button type="button" className="toolbar-button" onClick={onSave} disabled={!modified}>
          {t("action.save")}
        </button>
        <button type="button" className="toolbar-button" onClick={onCopy} disabled={!canCopy} title="复制当前文档内容">
          {copyFeedback ? t("action.copied") : t("action.copy")}
        </button>
        <button type="button" className="toolbar-button" onClick={onCycleTheme} title="切换阅读主题">
          {locale === "en-US"
            ? theme === "system"
              ? t("action.theme.system")
              : theme === "light"
                ? t("action.theme.light")
                : t("action.theme.dark")
            : themeLabel}
        </button>
        <details className="settings-menu">
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
          <details ref={exportMenuRef} className="export-menu">
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
