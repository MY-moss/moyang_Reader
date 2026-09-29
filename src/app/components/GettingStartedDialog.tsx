import { useRef } from "react";
import type { Locale } from "../i18n";
import { useModalBehavior } from "./useModalBehavior";

type GettingStartedDialogProps = {
  locale: Locale;
  onClose: () => void;
  onOpenDocument: () => void;
  onAddWorkspace: () => void;
};

type GuideCopy = {
  title: string;
  intro: string;
  close: string;
  open: string;
  folder: string;
  done: string;
  stepsLabel: string;
  steps: Array<{ title: string; detail: string; shortcut?: string }>;
  settingsNote: string;
};

const guideCopy: Record<Locale, GuideCopy> = {
  "zh-CN": {
    title: "从本地文档开始",
    intro: "打开一份文档，或添加文件夹作为阅读库。文件始终保留在原位置。",
    close: "关闭使用教程",
    open: "打开文档",
    folder: "添加阅读库",
    done: "知道了",
    stepsLabel: "使用步骤",
    steps: [
      {
        title: "打开一份文档",
        detail: "点击“打开文档”，也可以把 Markdown、TXT、Word、PDF 或图片拖进窗口。",
        shortcut: "Ctrl+O",
      },
      {
        title: "添加整个文件夹",
        detail: "把文件夹添加为阅读库，多个阅读库可以同时保留；从左侧文件树选择文档。",
        shortcut: "Ctrl+Shift+O",
      },
      {
        title: "边读边改",
        detail: "Markdown 默认使用所见即所得编辑，需要时切换源文本；Ctrl+S 会写回原文件。",
        shortcut: "Ctrl+E · Ctrl+S",
      },
      {
        title: "快速找到上下文",
        detail: "用快速打开、搜索和右侧目录/关联面板跳转，不必离开当前阅读位置。",
        shortcut: "Ctrl+P · Ctrl+F",
      },
      {
        title: "导出并分享",
        detail: "在顶部导出 Markdown、HTML、Word 或 PDF；设置和布局会自动保存在本机。",
      },
    ],
    settingsNote:
      "设置保存到本机，不会上传文档正文。若浏览器存储不可用，桌面版会使用应用配置文件兜底；可在设置中导出一份备份。",
  },
  "en-US": {
    title: "Start with your local documents",
    intro: "Open one document or add a folder as a library. Your files stay where they are.",
    close: "Close getting started guide",
    open: "Open a document",
    folder: "Add a library",
    done: "Got it",
    stepsLabel: "Getting started steps",
    steps: [
      {
        title: "Open a document",
        detail: "Choose Open, or drop Markdown, TXT, Word, PDF, or image files into the window.",
        shortcut: "Ctrl+O",
      },
      {
        title: "Add a whole folder",
        detail: "Keep multiple libraries mounted at once and choose files from the left tree.",
        shortcut: "Ctrl+Shift+O",
      },
      {
        title: "Read and edit",
        detail: "Markdown opens in WYSIWYG mode; switch to source when needed and save with Ctrl+S.",
        shortcut: "Ctrl+E · Ctrl+S",
      },
      {
        title: "Find context quickly",
        detail: "Use quick open, search, and the right outline/links panel without losing your place.",
        shortcut: "Ctrl+P · Ctrl+F",
      },
      {
        title: "Export and share",
        detail: "Export Markdown, HTML, Word, or PDF from the top bar; settings stay on this device.",
      },
    ],
    settingsNote:
      "Settings stay on this device and document bodies are never uploaded. If browser storage is unavailable, the desktop app uses its config file as a fallback; you can export a backup from Settings.",
  },
};

export function GettingStartedDialog({ locale, onClose, onOpenDocument, onAddWorkspace }: GettingStartedDialogProps) {
  const copy = guideCopy[locale];
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });

  return (
    <div
      className="quick-open-backdrop getting-started-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="quick-open-dialog getting-started-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="getting-started-title"
        aria-describedby="getting-started-intro"
        tabIndex={-1}
      >
        <header className="quick-open-header getting-started-header">
          <div>
            <h2 id="getting-started-title">{copy.title}</h2>
            <p id="getting-started-intro">{copy.intro}</p>
          </div>
          <button ref={closeButtonRef} type="button" className="quiet-button" onClick={onClose} aria-label={copy.close}>
            ×
          </button>
        </header>
        <div className="getting-started-body" role="region" aria-label={copy.stepsLabel} tabIndex={0}>
          <ol className="getting-started-grid">
            {copy.steps.map((step, index) => (
              <li className="getting-started-step" key={step.title}>
                <span className="getting-started-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="getting-started-step-copy">
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                  {step.shortcut && <kbd>{step.shortcut}</kbd>}
                </div>
              </li>
            ))}
          </ol>
          <p className="getting-started-settings-note">{copy.settingsNote}</p>
        </div>
        <footer className="quick-open-footer getting-started-footer">
          <button type="button" className="toolbar-button primary" onClick={onOpenDocument}>
            {copy.open}
          </button>
          <button type="button" className="quiet-button" onClick={onAddWorkspace}>
            {copy.folder}
          </button>
          <button type="button" className="quiet-button" onClick={onClose}>
            {copy.done}
          </button>
        </footer>
      </section>
    </div>
  );
}
