import { useRef, useState } from "react";
import type { Locale } from "../../features/settings/i18n";
import { useModalBehavior } from "../../shared/components/useModalBehavior";

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
  steps: Array<{ number: string; title: string; detail: string; shortcut?: string }>;
  settingsNote: string;
};

const guideCopy: Record<Locale, GuideCopy> = {
  "zh-CN": {
    title: "快速上手 Moyang Reader",
    intro: "把本地文档放到眼前，按自己的节奏阅读、编辑和分享。",
    close: "关闭使用教程",
    open: "打开文档",
    folder: "添加阅读库",
    done: "知道了",
    steps: [
      {
        number: "01",
        title: "打开一份文档",
        detail: "点击“打开文档”，也可以把 Markdown、TXT、Word、PDF 或图片拖进窗口。",
        shortcut: "Ctrl+O",
      },
      {
        number: "02",
        title: "添加整个文件夹",
        detail: "把文件夹添加为阅读库，多个阅读库可以同时保留；从左侧文件树选择文档。",
        shortcut: "Ctrl+Shift+O",
      },
      {
        number: "03",
        title: "边读边改",
        detail: "Markdown 和文本可直接编辑，停止输入后自动保存。Ctrl+E 切换阅读，需要时查看源码，Ctrl+S 随时保存。",
        shortcut: "Ctrl+E · Ctrl+S",
      },
      {
        number: "04",
        title: "快速找到上下文",
        detail: "用快速打开、搜索和右侧目录/关联面板跳转，不必离开当前阅读位置。",
        shortcut: "Ctrl+P · Ctrl+F",
      },
      {
        number: "05",
        title: "导出并分享",
        detail: "打开文档顶部的“更多操作”，导出 Markdown、HTML、Word 或 PDF；设置和布局会自动保存在本机。",
      },
    ],
    settingsNote: "阅读设置保存在本机，可在“设置 → 数据恢复”导出备份；AI 数据备份位于“接入与备份”。",
  },
  "en-US": {
    title: "Get started with Moyang Reader",
    intro: "Keep local documents in front of you, then read, edit, and share at your own pace.",
    close: "Close getting started guide",
    open: "Open a document",
    folder: "Add a library",
    done: "Got it",
    steps: [
      {
        number: "01",
        title: "Open a document",
        detail: "Choose Open, or drop Markdown, TXT, Word, PDF, or image files into the window.",
        shortcut: "Ctrl+O",
      },
      {
        number: "02",
        title: "Add a whole folder",
        detail: "Keep multiple libraries mounted at once and choose files from the left tree.",
        shortcut: "Ctrl+Shift+O",
      },
      {
        number: "03",
        title: "Read and edit",
        detail:
          "Markdown and text open for editing and save after a pause. Press Ctrl+E to read, or Ctrl+S to save immediately.",
        shortcut: "Ctrl+E · Ctrl+S",
      },
      {
        number: "04",
        title: "Find context quickly",
        detail: "Use quick open, search, and the right outline/links panel without losing your place.",
        shortcut: "Ctrl+P · Ctrl+F",
      },
      {
        number: "05",
        title: "Export and share",
        detail:
          "Open More actions in the document toolbar to export Markdown, HTML, Word, or PDF. Settings stay on this device.",
      },
    ],
    settingsNote: "Back up reading settings in Settings → Backup & help. Back up AI data in Connections & backup.",
  },
};

type GuideTopic = "reader" | "ai" | "extensions";
const extraGuides: Record<Locale, Record<Exclude<GuideTopic, "reader">, Pick<GuideCopy, "intro" | "steps">>> = {
  "zh-CN": {
    ai: {
      intro: "知识保留资料，记忆积累偏好与经验，技能整理可重复使用的方法。它们与日常笔记分开。",
      steps: [
        {
          number: "01",
          title: "留下第一条积累",
          detail:
            "侧栏切换到“AI 空间”，选择知识库、长期记忆或技能库。新建正文或显式导入资料，并补充来源；日常笔记不会自动导入。",
        },
        {
          number: "02",
          title: "连接常用 Agent",
          detail:
            "打开“接入与备份”，选择 Codex 或 Claude Code 安装连接。重启客户端并完成它的信任授权，分别检查 MCP 连接和自动沉淀状态。",
        },
        {
          number: "03",
          title: "按需召回与修正",
          detail:
            "让 Agent 按项目召回相关内容，任务结束后积累值得长期保留的结论。在“近期活动”处理矛盾或撤回，在条目历史中比较与恢复。",
        },
      ],
    },
    extensions: {
      intro: "从侧栏底部打开“插件市场”，按需要增加阅读插件、主题、AI 技能或 MCP 服务。",
      steps: [
        {
          number: "01",
          title: "选择并安装",
          detail:
            "在“发现”查看用途、来源和版本后安装，也可以导入本地扩展包。内置精选离线可用，外部目录在手动刷新时联网。",
        },
        {
          number: "02",
          title: "找到使用入口",
          detail:
            "阅读插件从命令面板运行；主题安装后生效；技能从详情进入 AI 技能库；MCP 服务需在详情选择客户端安装连接，并重启该客户端。",
          shortcut: "Ctrl+Shift+P",
        },
        {
          number: "03",
          title: "更新或恢复",
          detail:
            "在“已安装”停用或卸载；在“管理目录源”检查更新。升级后可回退上一版；技能已有修改时可保留原内容并安装副本。",
        },
      ],
    },
  },
  "en-US": {
    ai: {
      intro:
        "Keep source material as knowledge, preferences and lessons as memories, and reusable methods as skills. Reader notes stay separate.",
      steps: [
        {
          number: "01",
          title: "Create your first entry",
          detail:
            "Switch to AI space in the sidebar, choose knowledge, memories, or skills, then create or explicitly import an entry with its source. Reader notes are not imported automatically.",
        },
        {
          number: "02",
          title: "Connect an Agent",
          detail:
            "Open Connections & backup and install the Codex or Claude Code connection. Restart and authorize the client, then check MCP and automatic memory status separately.",
        },
        {
          number: "03",
          title: "Recall and refine",
          detail:
            "Ask your Agent to recall project context and retain durable conclusions after a task. Review conflicts or undo changes in Recent activity; compare and restore entry history.",
        },
      ],
    },
    extensions: {
      intro:
        "Open the extension market at the bottom of the sidebar to add reader commands, themes, AI skills, or MCP services.",
      steps: [
        {
          number: "01",
          title: "Choose and install",
          detail:
            "Review purpose, source, and version in Discover, or import a local package. Built-in selections work offline; external catalogs refresh on request.",
        },
        {
          number: "02",
          title: "Use the extension",
          detail:
            "Run reader plugins from the command palette. Themes apply when installed; open skills in the AI library. Install MCP connections for a chosen client in the details, then restart that client.",
          shortcut: "Ctrl+Shift+P",
        },
        {
          number: "03",
          title: "Update or restore",
          detail:
            "Disable or remove items in Installed. Check catalog sources for updates and roll back after upgrading. When a skill has local edits, keep it and install a copy.",
        },
      ],
    },
  },
};

export function GettingStartedDialog({ locale, onClose, onOpenDocument, onAddWorkspace }: GettingStartedDialogProps) {
  const copy = guideCopy[locale];
  const [topic, setTopic] = useState<GuideTopic>(() =>
    document.body.dataset.globalPage === "extensions"
      ? "extensions"
      : document.body.dataset.activeSpace === "ai"
        ? "ai"
        : "reader",
  );
  const content = topic === "reader" ? copy : extraGuides[locale][topic];
  const topics: [GuideTopic, string][] =
    locale === "zh-CN"
      ? [
          ["reader", "阅读空间"],
          ["ai", "AI 空间"],
          ["extensions", "插件市场"],
        ]
      : [
          ["reader", "Reading"],
          ["ai", "AI space"],
          ["extensions", "Extensions"],
        ];
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
            <p id="getting-started-intro">{content.intro}</p>
          </div>
          <button ref={closeButtonRef} type="button" className="quiet-button" onClick={onClose} aria-label={copy.close}>
            ×
          </button>
        </header>
        <nav className="getting-started-topics" aria-label={locale === "zh-CN" ? "帮助主题" : "Help topics"}>
          {topics.map(([key, label]) => (
            <button className="quiet-button" key={key} aria-pressed={topic === key} onClick={() => setTopic(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="getting-started-grid">
          {content.steps.map((step) => (
            <article className="getting-started-step" key={step.number}>
              <span className="getting-started-number">{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                {step.shortcut && <kbd>{step.shortcut}</kbd>}
              </div>
            </article>
          ))}
        </div>
        <p className="getting-started-settings-note">{copy.settingsNote}</p>
        <footer className="quick-open-footer getting-started-footer">
          {topic === "reader" && (
            <>
              <button type="button" className="quiet-button" onClick={onOpenDocument}>
                {copy.open}
              </button>
              <button type="button" className="quiet-button" onClick={onAddWorkspace}>
                {copy.folder}
              </button>
            </>
          )}
          <button type="button" className="toolbar-button primary" onClick={onClose}>
            {copy.done}
          </button>
        </footer>
      </section>
    </div>
  );
}
