import { PERSISTED_STORAGE_KEYS } from "./compatibility-contract";

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
  | "action.saveDocument"
  | "action.copy"
  | "action.copied"
  | "action.theme.system"
  | "action.theme.light"
  | "action.theme.dark"
  | "action.theme.porcelain"
  | "action.theme.paper"
  | "action.theme.ink"
  | "action.readingAppearance"
  | "action.more"
  | "action.moreTools"
  | "action.primaryTools"
  | "action.openTools"
  | "action.readingTools"
  | "action.viewTools"
  | "action.documentTools"
  | "action.appearance"
  | "tabs.openDocuments"
  | "tabs.externalModified"
  | "tabs.close"
  | "tabs.manage"
  | "tabs.manageTitle"
  | "tabs.group"
  | "tabs.closeTab"
  | "tabs.closeOthers"
  | "tabs.closeRight"
  | "tabs.closeAll"
  | "tabs.middleClick"
  | "status.label"
  | "status.waiting"
  | "status.pdf"
  | "status.image"
  | "status.characters"
  | "status.externalChange"
  | "reader.focusProgress"
  | "reader.progressRead"
  | "reader.documentStart"
  | "reader.exitFocus"
  | "settings.title"
  | "settings.localFirst"
  | "settings.allowRemoteImages"
  | "settings.remoteImagesNote"
  | "settings.annotations"
  | "settings.annotationsNote"
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
  | "settings.theme"
  | "settings.typeface"
  | "settings.typeface.system"
  | "settings.typeface.serif"
  | "settings.typeface.sans"
  | "settings.lineSpacing"
  | "settings.lineSpacing.compact"
  | "settings.lineSpacing.comfortable"
  | "settings.lineSpacing.relaxed"
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
  | "settings.diagnostics"
  | "settings.exportDiagnostics"
  | "settings.diagnosticsNote"
  | "settings.exportNote"
  | "settings.language"
  | "settings.language.zh"
  | "settings.language.en"
  | "error.fileRead"
  | "error.fileWrite"
  | "error.fileConflict"
  | "error.workspaceAccessDenied"
  | "error.workspaceOperation"
  | "error.export"
  | "error.updateSignature"
  | "error.updatePermission"
  | "error.updateConfiguration"
  | "error.updateNetwork"
  | "error.updateFailed"
  | "error.ipcInvalidResponse";

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
    "action.search": "文内查找",
    "action.edit": "编辑",
    "action.showContext": "显示上下文",
    "action.hideContext": "隐藏上下文",
    "action.commands": "命令面板",
    "action.source": "源文本",
    "action.read": "阅读",
    "action.save": "保存",
    "action.saveDocument": "保存当前文档",
    "action.copy": "复制",
    "action.copied": "已复制",
    "action.theme.system": "系统",
    "action.theme.light": "浅色",
    "action.theme.dark": "深色",
    "action.theme.porcelain": "瓷白",
    "action.theme.paper": "纸色",
    "action.theme.ink": "墨黑",
    "action.readingAppearance": "阅读外观",
    "action.more": "更多",
    "action.moreTools": "更多文档工具",
    "action.primaryTools": "文档主要操作",
    "action.openTools": "打开与定位",
    "action.readingTools": "阅读与编辑",
    "action.viewTools": "搜索与面板",
    "action.documentTools": "文档操作",
    "action.appearance": "外观与更新",
    "tabs.openDocuments": "已打开文档",
    "tabs.externalModified": "文件已被外部修改",
    "tabs.close": "关闭",
    "tabs.manage": "标签页管理菜单",
    "tabs.manageTitle": "标签页",
    "tabs.group": "标签管理",
    "tabs.closeTab": "关闭标签",
    "tabs.closeOthers": "关闭其他标签",
    "tabs.closeRight": "关闭右侧标签",
    "tabs.closeAll": "关闭全部标签",
    "tabs.middleClick": "中键",
    "status.label": "文档状态",
    "status.waiting": "等待打开文件",
    "status.pdf": "PDF",
    "status.image": "图片",
    "status.characters": "字符",
    "status.externalChange": "外部修改待处理",
    "reader.focusProgress": "专注阅读进度",
    "reader.progressRead": "已读",
    "reader.documentStart": "文档开始",
    "reader.exitFocus": "退出专注",
    "settings.title": "设置",
    "settings.localFirst": "本地优先",
    "settings.allowRemoteImages": "允许远程图片",
    "settings.remoteImagesNote": "关闭时只显示本地附件，减少文档追踪请求。",
    "settings.annotations": "启用阅读批注",
    "settings.annotationsNote": "将高亮和备注保存在工作区 .moyang sidecar，不改动 Markdown 正文。",
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
    "settings.theme": "界面主题",
    "settings.typeface": "正文字体",
    "settings.typeface.system": "跟随系统",
    "settings.typeface.serif": "衬线",
    "settings.typeface.sans": "无衬线",
    "settings.lineSpacing": "正文行距",
    "settings.lineSpacing.compact": "紧凑",
    "settings.lineSpacing.comfortable": "舒适",
    "settings.lineSpacing.relaxed": "宽松",
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
    "settings.diagnostics": "诊断",
    "settings.exportDiagnostics": "导出诊断摘要",
    "settings.diagnosticsNote": "仅包含版本、环境、能力、错误 code 和性能摘要；不包含正文、完整路径或密钥。",
    "settings.exportNote": "应用于打印 / PDF、HTML 和 Word 导出。",
    "settings.language": "界面语言",
    "settings.language.zh": "简体中文",
    "settings.language.en": "English",
    "error.fileRead": "无法读取文件。",
    "error.fileWrite": "无法保存文件。",
    "error.fileConflict": "文件已被外部修改，未覆盖本地内容。",
    "error.workspaceAccessDenied": "当前路径未获授权，请重新选择阅读库或文件。",
    "error.workspaceOperation": "工作区操作失败，请重试。",
    "error.export": "导出失败，请检查目标路径后重试。",
    "error.updateSignature": "更新包签名校验失败，已停止安装。请从 GitHub Release 页面手动下载可信版本。",
    "error.updatePermission": "更新需要系统权限，安装没有完成。可以稍后重试或从 GitHub Release 页面手动安装。",
    "error.updateConfiguration": "更新服务尚未配置完成，当前版本仍可正常使用。",
    "error.updateNetwork": "暂时无法连接更新服务器，请检查网络后重试。",
    "error.updateFailed": "更新失败：",
    "error.ipcInvalidResponse": "应用收到无效的本机响应。请重试；若持续出现，请导出诊断信息。",
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
    "action.search": "Find in document",
    "action.edit": "Edit",
    "action.showContext": "Show context",
    "action.hideContext": "Hide context",
    "action.commands": "Commands",
    "action.source": "Source",
    "action.read": "Read",
    "action.save": "Save",
    "action.saveDocument": "Save current document",
    "action.copy": "Copy",
    "action.copied": "Copied",
    "action.theme.system": "System",
    "action.theme.light": "Light",
    "action.theme.dark": "Dark",
    "action.theme.porcelain": "Porcelain",
    "action.theme.paper": "Paper",
    "action.theme.ink": "Ink",
    "action.readingAppearance": "Reading appearance",
    "action.more": "More",
    "action.moreTools": "More document tools",
    "action.primaryTools": "Primary document actions",
    "action.openTools": "Open and locate",
    "action.readingTools": "Read and edit",
    "action.viewTools": "Search and panels",
    "action.documentTools": "Document actions",
    "action.appearance": "Appearance & updates",
    "tabs.openDocuments": "Open documents",
    "tabs.externalModified": "File changed externally",
    "tabs.close": "Close",
    "tabs.manage": "Tab management menu",
    "tabs.manageTitle": "Tab",
    "tabs.group": "Tab management",
    "tabs.closeTab": "Close tab",
    "tabs.closeOthers": "Close other tabs",
    "tabs.closeRight": "Close tabs to the right",
    "tabs.closeAll": "Close all tabs",
    "tabs.middleClick": "Middle click",
    "status.label": "Document status",
    "status.waiting": "Waiting for a document",
    "status.pdf": "PDF",
    "status.image": "Image",
    "status.characters": "characters",
    "status.externalChange": "External change needs attention",
    "reader.focusProgress": "Focus reading progress",
    "reader.progressRead": "read",
    "reader.documentStart": "Document start",
    "reader.exitFocus": "Exit focus",
    "settings.title": "Settings",
    "settings.localFirst": "LOCAL FIRST",
    "settings.allowRemoteImages": "Allow remote images",
    "settings.remoteImagesNote": "When off, only local attachments are shown and tracking requests are reduced.",
    "settings.annotations": "Enable reading annotations",
    "settings.annotationsNote": "Highlights and notes stay in the workspace .moyang sidecar, not in Markdown.",
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
    "settings.theme": "Interface theme",
    "settings.typeface": "Reading typeface",
    "settings.typeface.system": "System",
    "settings.typeface.serif": "Serif",
    "settings.typeface.sans": "Sans serif",
    "settings.lineSpacing": "Line spacing",
    "settings.lineSpacing.compact": "Compact",
    "settings.lineSpacing.comfortable": "Comfortable",
    "settings.lineSpacing.relaxed": "Relaxed",
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
    "settings.diagnostics": "Diagnostics",
    "settings.exportDiagnostics": "Export diagnostic summary",
    "settings.diagnosticsNote":
      "Includes version, environment, capabilities, error codes, and performance summary only; no content, full paths, or secrets.",
    "settings.exportNote": "Used by print / PDF, HTML, and Word exports.",
    "settings.language": "Interface language",
    "settings.language.zh": "简体中文",
    "settings.language.en": "English",
    "error.fileRead": "Unable to read the file.",
    "error.fileWrite": "Unable to save the file.",
    "error.fileConflict": "The file changed externally; local content was not overwritten.",
    "error.workspaceAccessDenied": "This path is not authorized. Choose the library or file again.",
    "error.workspaceOperation": "The workspace operation failed. Try again.",
    "error.export": "Export failed. Check the destination and try again.",
    "error.updateSignature":
      "The update signature could not be verified. Installation stopped. Download a trusted version from GitHub Releases.",
    "error.updatePermission":
      "The update needs system permission and was not installed. Try again later or install it from GitHub Releases.",
    "error.updateConfiguration": "The update service is not configured yet. The current version remains usable.",
    "error.updateNetwork": "The update server could not be reached. Check the network and try again.",
    "error.updateFailed": "Update failed: ",
    "error.ipcInvalidResponse":
      "The app received an invalid local response. Try again; if it persists, export diagnostics.",
  },
};

const localeKey = PERSISTED_STORAGE_KEYS.locale;

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages["zh-CN"][key];
}

export function getMessageKeys(locale: Locale): readonly MessageKey[] {
  return Object.keys(messages[locale]) as MessageKey[];
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
