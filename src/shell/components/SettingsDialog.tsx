import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SettingsContent } from "./SettingsContent";
import type { TopBarProps } from "./toolbar-types";
import { Icon } from "../../shared/components/Icon";

/** Preferences have their own space instead of nesting inside a tool menu. */
export function SettingsDialog({ onClose, ...props }: TopBarProps & { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [section, setSection] = useState("reading");
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const english = props.locale === "en-US";
  const sections = english
    ? [
        ["reading", "Appearance"],
        ["editing", "Editing"],
        ["export", "Export layout"],
        ["general", "General & privacy"],
        ["backup", "Backup & help"],
        ["updates", "App updates"],
        ["storage", "Storage locations"],
      ]
    : [
        ["reading", "外观"],
        ["editing", "编辑"],
        ["export", "导出版式"],
        ["general", "通用与隐私"],
        ["backup", "数据恢复"],
        ["updates", "应用更新"],
        ["storage", "存储位置"],
      ];
  return createPortal(
    <section
      ref={dialogRef}
      className="settings-dialog settings-page"
      role="region"
      aria-labelledby="settings-dialog-title"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="settings-dialog-header">
        <div className="settings-heading">
          <button
            className="settings-navigation-button"
            onClick={props.onToggleSidebar}
            aria-label={english ? "Show navigation" : "显示导航"}
            aria-expanded={!props.sidebarCollapsed}
          >
            <Icon name="sidebar" />
          </button>
          <h2 id="settings-dialog-title">{english ? "Settings" : "设置"}</h2>
        </div>
        <button
          ref={closeRef}
          className="panel-close-button"
          onClick={onClose}
          aria-label={english ? "Close settings" : "关闭设置"}
        >
          <Icon name="back" />
          {english ? "Back to workspace" : "返回工作台"}
        </button>
      </header>
      <div className="settings-dialog-layout">
        <nav className="settings-section-nav" aria-label={english ? "Settings sections" : "设置分类"}>
          {sections.map(([id, label]) => (
            <button key={id} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>
              {label}
            </button>
          ))}
          <small>{english ? "Saved on this device" : "改动即时生效，保存在本机"}</small>
        </nav>
        <SettingsContent
          {...props}
          section={section}
          onOpenGuide={() => {
            onClose();
            props.onOpenGuide();
          }}
          onImportSettings={() => {
            onClose();
            props.onImportSettings();
          }}
        />
      </div>
    </section>,
    document.querySelector(".workbench-main") ?? document.body,
  );
}
