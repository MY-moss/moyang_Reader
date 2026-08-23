import type { ThemeMode } from "../types";
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
  onOpen: () => void;
  onToggleMode: () => void;
  onSave: () => void;
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
  onOpen,
  onToggleMode,
  onSave,
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
  onToggleSearch,
  onSearchQueryChange,
  onSearchPrevious,
  onSearchNext,
  onCloseSearch,
  onCycleTheme,
}: TopBarProps) {
  const themeLabel = theme === "system" ? "系统" : theme === "light" ? "浅色" : "深色";
  const updateLabel =
    updateStatus === "checking" ? "检查中…" :
      updateStatus === "downloading" ? "下载中…" :
        updateStatus === "available" ? "有更新" :
          updateStatus === "ready" ? "已更新" :
            updateStatus === "up-to-date" ? "已是最新" : "更新";
  const updateTitle = updateVersion
    ? "发现 v" + updateVersion.replace(/^v/i, "") + "，打开更新提示"
    : "检查应用更新";

  return (
    <header className="topbar">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true">M</span>
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
        <button type="button" className="toolbar-button" onClick={onToggleSearch} title="查找文档内容 (Ctrl+F)">
          搜索
        </button>
        <button type="button" className="toolbar-button" onClick={onToggleMode} disabled={!fileName || !canEdit}>
          {mode === "rendered" ? "源文本" : "阅读"}
        </button>
        <button type="button" className="toolbar-button" onClick={onSave} disabled={!modified}>
          保存
        </button>
        <button type="button" className="toolbar-button" onClick={onCycleTheme} title="切换阅读主题">
          {themeLabel}
        </button>
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
            <summary className="toolbar-button" title="导出文件">导出</summary>
            <div className="export-menu-panel">
              {canExportMarkdown && (
                <button type="button" onClick={onExportMarkdown}>导出 Markdown / 文本</button>
              )}
              {canExportHtml && (
                <button type="button" onClick={onExportHtml}>导出 HTML（含图片）</button>
              )}
              {canExportDocx && (
                <button type="button" onClick={onExportDocx}>导出 Word（DOCX）</button>
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
              if (event.key === "Enter") event.shiftKey ? onSearchPrevious() : onSearchNext();
            }}
          />
          <span className="find-count">
            {searchResultCount === 0 ? "无结果" : `${searchResultIndex + 1} / ${searchResultCount}`}
          </span>
          <button type="button" className="find-button" onClick={onSearchPrevious} aria-label="上一个结果">↑</button>
          <button type="button" className="find-button" onClick={onSearchNext} aria-label="下一个结果">↓</button>
          <button type="button" className="find-button" onClick={onCloseSearch} aria-label="关闭搜索">×</button>
        </div>
      )}
    </header>
  );
}
