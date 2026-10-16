import { useEffect, useRef, useState } from "react";
import { translate, type MessageKey } from "../../features/settings/i18n";
import { SettingsDialog } from "./SettingsDialog";
import type { TopBarProps } from "./toolbar-types";
import { Icon } from "../../shared/components/Icon";

/** Keep reading actions visible and give secondary tools a single home. */
export function TopBar(p: TopBarProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const exportRef = useRef<HTMLDetailsElement>(null);
  const t = (key: MessageKey) => translate(p.locale, key);
  const closeMenus = () => {
    for (const ref of [menuRef, exportRef]) ref.current?.removeAttribute("open");
  };
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) closeMenus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menuRef.current?.open) return;
      event.preventDefault();
      event.stopPropagation();
      closeMenus();
      menuRef.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);
  const run = (action: () => void) => {
    closeMenus();
    p.onCloseSearch();
    action();
  };
  const toggleSearch = () => {
    closeMenus();
    p.searchOpen ? p.onCloseSearch() : p.onToggleSearch();
  };
  return (
    <header className="topbar">
      <div className="workbench-navigation">
        <button
          className="toolbar-button sidebar-toggle"
          onClick={p.onToggleSidebar}
          aria-pressed={!p.sidebarCollapsed}
          aria-label={p.sidebarCollapsed ? "显示侧栏" : "隐藏侧栏"}
          title={p.sidebarCollapsed ? "显示侧栏 (Ctrl+Shift+B)" : "隐藏侧栏 (Ctrl+Shift+B)"}
        >
          <Icon name="sidebar" />
        </button>
        {p.navigation}
      </div>
      <button
        className="quick-entry"
        aria-label="快速打开"
        onClick={() => run(p.onQuickOpen)}
        title="快速打开文档 (Ctrl+P)"
      >
        <span className="document-title">{p.fileName ?? "查找并打开文档"}</span>
        <kbd>Ctrl P</kbd>
        {p.modified && <span className="modified-dot" aria-label="有未保存修改" />}
      </button>
      <nav className="toolbar" aria-label="文档操作">
        {p.sidebarCollapsed && (
          <button
            className="toolbar-button"
            disabled={p.workspaceLimitReached}
            onClick={() => run(p.onAddWorkspace)}
            title={`${p.workspaceOpen ? "添加阅读库" : "添加整个文件夹"} (Ctrl+Shift+O)`}
          >
            {t("action.folder")}
          </button>
        )}
        {p.externallyModified && (
          <button
            className="external-modified-indicator"
            aria-label="文件已被外部修改，查看处理选项"
            onClick={p.onShowExternalChange}
          >
            !
          </button>
        )}
        {p.draftCount > 0 && (
          <button className="toolbar-button recovery-button" onClick={p.onOpenRecovery}>
            {t("action.drafts")} {p.draftCount}
          </button>
        )}
        <button
          className="toolbar-button context-toggle"
          aria-label={p.rightPanelOpen ? "隐藏上下文" : "显示上下文"}
          disabled={!p.fileName}
          onClick={p.onToggleRightPanel}
          aria-pressed={Boolean(p.fileName && p.rightPanelOpen)}
          title={p.rightPanelOpen ? "隐藏上下文面板 (Ctrl+Shift+R)" : "显示上下文面板 (Ctrl+Shift+R)"}
        >
          <Icon name="context" />
        </button>
        <button
          className="toolbar-button focus-button"
          aria-label={p.focusMode ? "退出专注" : "专注阅读"}
          onClick={p.onToggleFocusMode}
          disabled={!p.fileName}
          title={p.focusMode ? "退出专注阅读 (Esc)" : "进入专注阅读 (Ctrl+Shift+Enter)"}
        >
          <Icon name="focus" />
        </button>
        <button
          className="toolbar-button"
          aria-label="查找当前文档"
          onClick={toggleSearch}
          title="查找文档内容 (Ctrl+F)"
        >
          <Icon name="search" />
        </button>
        <details
          ref={menuRef}
          className="toolbar-overflow"
          onToggle={() => {
            if (menuRef.current?.open) p.onCloseSearch();
            else {
              exportRef.current?.removeAttribute("open");
            }
          }}
        >
          <summary
            className="toolbar-button toolbar-overflow-trigger"
            aria-label="更多操作"
            title={t("action.moreTools")}
          >
            <Icon name="more" />
          </summary>
          <div className="toolbar-overflow-panel">
            <div className="toolbar-overflow-group">
              <div className="toolbar-overflow-label">{t("action.documentTools")}</div>
              <div className="toolbar-overflow-actions">
                <button className="toolbar-button" onClick={() => run(p.onOpen)} title="打开文件 (Ctrl+O)">
                  {t("action.open")}
                </button>
                <button className="toolbar-button" onClick={() => run(p.onOpenCommandPalette)}>
                  {t("action.commands")}
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => run(p.onCycleMode)}
                  disabled={!p.fileName || !p.canEdit}
                >
                  {p.mode === "source"
                    ? t("action.read")
                    : p.mode === "wysiwyg"
                      ? t("action.source")
                      : t("action.edit")}
                </button>
                {!p.modified && (
                  <button className="toolbar-button" onClick={p.onSave} disabled>
                    {t("action.save")}
                  </button>
                )}
                <button className="toolbar-button" onClick={p.onCopy} disabled={!p.canCopy}>
                  {p.copyFeedback ? t("action.copied") : t("action.copy")}
                </button>
              </div>
            </div>
            <div className="toolbar-overflow-group">
              <div className="toolbar-overflow-label">{t("action.appearance")}</div>
              <div className="toolbar-overflow-actions">
                <button className="toolbar-button" onClick={p.onCycleTheme} title="切换阅读主题">
                  {t(`action.theme.${p.theme}`)}
                </button>
              </div>
            </div>
            {!!p.extensionActions?.commands.length && (
              <details className="toolbar-overflow-group">
                <summary>阅读插件</summary>
                <div className="toolbar-overflow-actions">
                  {p.extensionActions.commands.map((command) => (
                    <button
                      key={command.id}
                      className="toolbar-button"
                      disabled={command.disabled}
                      onClick={() => run(() => p.extensionActions?.execute(command.id))}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>
              </details>
            )}
            <button className="toolbar-button settings-trigger" onClick={() => run(() => setSettingsOpen(true))}>
              {t("settings.title")}
              <span aria-hidden="true">↗</span>
            </button>
            <div className="toolbar-overflow-group export-actions">
              <button className="toolbar-button primary" onClick={() => run(p.onExport)} disabled={!p.fileName}>
                {p.exportLabel ?? "打印 / PDF"}
              </button>
              {(p.canExportMarkdown || p.canExportHtml || p.canExportDocx) && (
                <details ref={exportRef} className="export-menu">
                  <summary className="toolbar-button" title="导出文件">
                    导出
                  </summary>
                  <div className="export-menu-panel">
                    {p.canPreviewPrint && <button onClick={() => run(p.onPreviewPrint)}>预览打印版式</button>}
                    {p.canExportMarkdown && (
                      <button onClick={() => run(p.onExportMarkdown)}>导出 Markdown / 文本</button>
                    )}
                    {p.canExportHtml && <button onClick={() => run(p.onExportHtml)}>导出 HTML（含图片）</button>}
                    {p.canExportDocx && <button onClick={() => run(p.onExportDocx)}>导出 Word（DOCX）</button>}
                  </div>
                </details>
              )}
            </div>
          </div>
        </details>
      </nav>
      {(settingsOpen || p.settingsOpen) && (
        <SettingsDialog
          {...p}
          onClose={() => {
            setSettingsOpen(false);
            p.onSettingsClose?.();
          }}
        />
      )}
      {p.searchOpen && (
        <div className="findbar" role="search">
          <input
            autoFocus
            type="search"
            aria-label="搜索文档"
            placeholder={p.fileName ? "在当前文档中查找" : "先打开一个文档"}
            value={p.searchQuery}
            onChange={(e) => p.onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") p.onCloseSearch();
              if (e.key === "Enter") e.shiftKey ? p.onSearchPrevious() : p.onSearchNext();
            }}
          />
          <span className="find-count">
            {p.searchResultCount ? `${p.searchResultIndex + 1} / ${p.searchResultCount}` : "无结果"}
          </span>
          <button className="find-button" onClick={p.onSearchPrevious} aria-label="上一个结果">
            ↑
          </button>
          <button className="find-button" onClick={p.onSearchNext} aria-label="下一个结果">
            ↓
          </button>
          <button className="find-button" onClick={p.onCloseSearch} aria-label="关闭搜索">
            ×
          </button>
        </div>
      )}
    </header>
  );
}
