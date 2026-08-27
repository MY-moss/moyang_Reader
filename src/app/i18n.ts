export type Locale = "zh-CN" | "en-US";

export type MessageKey =
  | "brand.subtitle"
  | "document.empty"
  | "action.open"
  | "action.folder"
  | "action.quickOpen"
  | "action.drafts"
  | "action.showSidebar"
  | "action.hideSidebar"
  | "action.focus"
  | "action.exitFocus"
  | "action.search"
  | "action.edit"
  | "action.showContext"
  | "action.hideContext"
  | "action.commands"
  | "action.source"
  | "action.read"
  | "action.save"
  | "action.copy"
  | "action.copied"
  | "action.theme.system"
  | "action.theme.light"
  | "action.theme.dark"
  | "action.more"
  | "action.moreTools"
  | "action.documentTools"
  | "action.appearance"
  | "settings.title"
  | "settings.localFirst"
  | "settings.allowRemoteImages"
  | "settings.remoteImagesNote"
  | "settings.startupUpdates"
  | "settings.startupUpdatesNote"
  | "settings.reading"
  | "settings.fontSize"
  | "settings.fontSize.compact"
  | "settings.fontSize.standard"
  | "settings.fontSize.comfortable"
  | "settings.zoomHint"
  | "settings.zoomReset"
  | "settings.width"
  | "settings.width.narrow"
  | "settings.width.standard"
  | "settings.width.wide"
  | "settings.export"
  | "settings.paper"
  | "settings.orientation"
  | "settings.orientation.portrait"
  | "settings.orientation.landscape"
  | "settings.margin"
  | "settings.margin.compact"
  | "settings.margin.standard"
  | "settings.margin.wide"
  | "settings.migration"
  | "settings.exportSettings"
  | "settings.importSettings"
  | "settings.backupNote"
  | "settings.exportNote"
  | "settings.language"
  | "settings.language.zh"
  | "settings.language.en";

const messages: Record<Locale, Record<MessageKey, string>> = {
  "zh-CN": {
    "brand.subtitle": "本地阅读器",
    "document.empty": "选择一个文档开始阅读",
    "action.open": "打开",
    "action.folder": "文件夹",
    "action.quickOpen": "快速打开",
    "action.drafts": "草稿",
    "action.showSidebar": "显示侧栏",
    "action.hideSidebar": "侧栏",
    "action.focus": "专注",
    "action.exitFocus": "退出专注",
    "action.search": "搜索",
    "action.edit": "编辑",
    "action.showContext": "显示上下文",
    "action.hideContext": "隐藏上下文",
    "action.commands": "命令面板",
    "action.source": "源文本",
    "action.read": "阅读",
    "action.save": "保存",
    "action.copy": "复制",
    "action.copied": "已复制",
    "action.theme.system": "系统",
    "action.theme.light": "浅色",
    "action.theme.dark": "深色",
    "action.more": "更多",
    "action.moreTools": "更多文档工具",
    "action.documentTools": "文档操作",
    "action.appearance": "外观与更新",
    "settings.title": "设置",
    "settings.localFirst": "本地优先",
    "settings.allowRemoteImages": "允许远程图片",
    "settings.remoteImagesNote": "关闭时只显示本地附件，减少文档追踪请求。",
    "settings.startupUpdates": "启动时检查更新",
    "settings.startupUpdatesNote": "关闭后仍可点击“更新”手动检查。",
    "settings.reading": "阅读排版",
    "settings.fontSize": "正文字号",
    "settings.fontSize.compact": "紧凑",
    "settings.fontSize.standard": "标准",
    "settings.fontSize.comfortable": "舒适",
    "settings.zoomHint": "Ctrl+滚轮或 Ctrl+± 即时调整",
    "settings.zoomReset": "恢复标准",
    "settings.width": "正文宽度",
    "settings.width.narrow": "窄",
    "settings.width.standard": "标准",
    "settings.width.wide": "宽",
    "settings.export": "导出排版",
    "settings.paper": "导出纸张",
    "settings.orientation": "导出方向",
    "settings.orientation.portrait": "纵向",
    "settings.orientation.landscape": "横向",
    "settings.margin": "导出页边距",
    "settings.margin.compact": "紧凑",
    "settings.margin.standard": "标准",
    "settings.margin.wide": "宽松",
    "settings.migration": "迁移与备份",
    "settings.exportSettings": "导出设置",
    "settings.importSettings": "导入设置",
    "settings.backupNote": "只备份偏好、阅读库路径和标签页，不包含文档正文或私钥。",
    "settings.exportNote": "应用于打印 / PDF、HTML 和 Word 导出。",
    "settings.language": "界面语言",
    "settings.language.zh": "简体中文",
    "settings.language.en": "English",
  },
  "en-US": {
    "brand.subtitle": "LOCAL READER",
    "document.empty": "Choose a document to start reading",
    "action.open": "Open",
    "action.folder": "Folder",
    "action.quickOpen": "Quick open",
    "action.drafts": "Drafts",
    "action.showSidebar": "Show sidebar",
    "action.hideSidebar": "Sidebar",
    "action.focus": "Focus",
    "action.exitFocus": "Exit focus",
    "action.search": "Search",
    "action.edit": "Edit",
    "action.showContext": "Show context",
    "action.hideContext": "Hide context",
    "action.commands": "Commands",
    "action.source": "Source",
    "action.read": "Read",
    "action.save": "Save",
    "action.copy": "Copy",
    "action.copied": "Copied",
    "action.theme.system": "System",
    "action.theme.light": "Light",
    "action.theme.dark": "Dark",
    "action.more": "More",
    "action.moreTools": "More document tools",
    "action.documentTools": "Document actions",
    "action.appearance": "Appearance & updates",
    "settings.title": "Settings",
    "settings.localFirst": "LOCAL FIRST",
    "settings.allowRemoteImages": "Allow remote images",
    "settings.remoteImagesNote": "When off, only local attachments are shown and tracking requests are reduced.",
    "settings.startupUpdates": "Check for updates on startup",
    "settings.startupUpdatesNote": "You can still check manually with the Update button.",
    "settings.reading": "Reading layout",
    "settings.fontSize": "Text size",
    "settings.fontSize.compact": "Compact",
    "settings.fontSize.standard": "Standard",
    "settings.fontSize.comfortable": "Comfortable",
    "settings.zoomHint": "Use Ctrl+wheel or Ctrl+± to adjust instantly",
    "settings.zoomReset": "Reset",
    "settings.width": "Text width",
    "settings.width.narrow": "Narrow",
    "settings.width.standard": "Standard",
    "settings.width.wide": "Wide",
    "settings.export": "Export layout",
    "settings.paper": "Paper",
    "settings.orientation": "Orientation",
    "settings.orientation.portrait": "Portrait",
    "settings.orientation.landscape": "Landscape",
    "settings.margin": "Margins",
    "settings.margin.compact": "Compact",
    "settings.margin.standard": "Standard",
    "settings.margin.wide": "Wide",
    "settings.migration": "Migration & backup",
    "settings.exportSettings": "Export settings",
    "settings.importSettings": "Import settings",
    "settings.backupNote":
      "Only preferences, workspace paths, and tabs are backed up; document content and keys are excluded.",
    "settings.exportNote": "Used by print / PDF, HTML, and Word exports.",
    "settings.language": "Interface language",
    "settings.language.zh": "简体中文",
    "settings.language.en": "English",
  },
};

const localeKey = "moyang-reader-locale";

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages["zh-CN"][key];
}

export function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(localeKey);
    return saved === "en-US" || saved === "zh-CN" ? saved : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(localeKey, locale);
  } catch {
    // The current locale remains active when local storage is unavailable.
  }
}

