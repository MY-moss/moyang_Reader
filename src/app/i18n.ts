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
  | "workspace.title"
  | "workspace.actions"
  | "workspace.create"
  | "workspace.root"
  | "workspace.createNote"
  | "workspace.createFolder"
  | "workspace.search"
  | "workspace.manage"
  | "workspace.limitReached"
  | "workspace.addTitle"
  | "workspace.add"
  | "workspace.mounted"
  | "workspace.remove"
  | "workspace.batchExport"
  | "workspace.export.html"
  | "workspace.export.docx"
  | "workspace.export.pdf"
  | "workspace.cancelExport"
  | "workspace.counts"
  | "workspace.help"
  | "workspace.exportProgress"
  | "workspace.exportProgressLabel"
  | "workspace.exportFailures"
  | "workspace.copyList"
  | "workspace.saveList"
  | "workspace.indexLoading"
  | "workspace.truncated"
  | "workspace.searchLoading"
  | "workspace.matchCount"
  | "workspace.visibleCount"
  | "workspace.clearFilters"
  | "workspace.searchLabel"
  | "workspace.searchPlaceholder"
  | "workspace.tags"
  | "workspace.tagFilter"
  | "workspace.allTags"
  | "workspace.kind"
  | "workspace.kindFilter"
  | "workspace.kind.all"
  | "workspace.kind.markdown"
  | "workspace.kind.text"
  | "workspace.kind.docx"
  | "workspace.kind.pdf"
  | "workspace.kind.image"
  | "workspace.searchHint"
  | "workspace.searching"
  | "workspace.noMatches"
  | "workspace.filesLabel"
  | "workspace.files"
  | "workspace.noFiles"
  | "workspace.recentLibraries"
  | "workspace.recentFiles"
  | "workspace.lastOpened"
  | "workspace.history"
  | "workspace.historyToggle"
  | "history.range"
  | "history.summary"
  | "history.documents"
  | "history.duration"
  | "history.dailyDuration"
  | "history.empty"
  | "history.emptyWeek"
  | "history.clear"
  | "workspaceEntry.busy"
  | "workspaceEntry.requireWorkspace"
  | "workspaceEntry.actionRename"
  | "workspaceEntry.actionDelete"
  | "workspaceEntry.actionMove"
  | "workspaceEntry.actionCopy"
  | "workspaceEntry.kindFile"
  | "workspaceEntry.kindFolder"
  | "workspaceEntry.renameFile"
  | "workspaceEntry.renameFolder"
  | "workspaceEntry.confirmDirty"
  | "workspaceEntry.confirmDeleteFile"
  | "workspaceEntry.confirmDeleteFolder"
  | "workspaceEntry.renamed"
  | "workspaceEntry.deletedFile"
  | "workspaceEntry.deletedFolder"
  | "workspaceEntry.moved"
  | "workspaceEntry.copied"
  | "workspaceEntry.staleEdits"
  | "workspaceEntry.refreshFailure"
  | "workspaceEntry.copyRefreshFailure"
  | "workspaceEntry.renameFailure"
  | "workspaceEntry.deleteFailure"
  | "workspaceEntry.transferFailure"
  | "workspaceEntry.renameReopenFailure"
  | "workspaceEntry.moveReopenFailure"
  | "workspaceEntry.deleteReopenFailure"
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
    "workspace.title": "阅读库",
    "workspace.actions": "阅读库操作",
    "workspace.create": "新建",
    "workspace.root": "阅读库根目录",
    "workspace.createNote": "新建笔记",
    "workspace.createFolder": "新建文件夹",
    "workspace.search": "搜索",
    "workspace.manage": "阅读库管理",
    "workspace.limitReached": "已达到 {count} 个阅读库上限，请先移除一个已挂载阅读库。",
    "workspace.addTitle": "添加另一个阅读库",
    "workspace.add": "添加阅读库",
    "workspace.mounted": "已挂载阅读库",
    "workspace.remove": "从已挂载阅读库移除 {name}",
    "workspace.batchExport": "批量导出",
    "workspace.export.html": "单文件 HTML",
    "workspace.export.docx": "单文件 Word",
    "workspace.export.pdf": "批量打印 / PDF",
    "workspace.cancelExport": "取消导出",
    "workspace.counts": "{files} 项 · {libraries} 个阅读库",
    "workspace.help": "添加一个文件夹，递归读取其中的文档并开启目录浏览和阅读库搜索。",
    "workspace.exportProgress": "正在整理",
    "workspace.exportProgressLabel": "批量导出进度",
    "workspace.exportFailures": "查看 {count} 个未导出文件",
    "workspace.copyList": "复制清单",
    "workspace.saveList": "保存清单",
    "workspace.indexLoading": "目录已打开，正在整理链接与标签…",
    "workspace.truncated": "工作区较大，文件树和工作区索引只加载了安全范围内的内容；未加载部分需要缩小工作区后查看。",
    "workspace.searchLoading": "正在整理当前阅读库搜索结果…",
    "workspace.matchCount": "当前阅读库匹配 {count} 项",
    "workspace.visibleCount": "显示 {visible} / {total} 项",
    "workspace.clearFilters": "清除筛选",
    "workspace.searchLabel": "当前阅读库搜索",
    "workspace.searchPlaceholder": "搜索当前阅读库内容",
    "workspace.tags": "标签",
    "workspace.tagFilter": "按标签筛选工作区",
    "workspace.allTags": "全部标签",
    "workspace.kind": "类型",
    "workspace.kindFilter": "按类型筛选工作区",
    "workspace.kind.all": "全部类型",
    "workspace.kind.markdown": "Markdown",
    "workspace.kind.text": "纯文本",
    "workspace.kind.docx": "Word",
    "workspace.kind.pdf": "PDF",
    "workspace.kind.image": "图片",
    "workspace.searchHint": "至少输入 2 个字符后搜索当前阅读库。",
    "workspace.searching": "正在搜索当前阅读库…",
    "workspace.noMatches": "当前阅读库没有匹配文档。",
    "workspace.filesLabel": "工作区文件",
    "workspace.files": "文件",
    "workspace.noFiles": "当前标签下没有文件。",
    "workspace.recentLibraries": "最近阅读库",
    "workspace.recentFiles": "最近打开",
    "workspace.lastOpened": "最近打开",
    "workspace.history": "本周阅读",
    "workspace.historyToggle": "阅读历史",
    "history.range": "周一—周日",
    "history.summary": "本周阅读摘要：{count} 篇文档，累计 {duration}",
    "history.documents": "篇文档",
    "history.duration": "累计时长",
    "history.dailyDuration": "{day} 阅读时长",
    "history.empty": "还没有本机阅读记录。",
    "history.emptyWeek": "本周还没有阅读时长。",
    "history.clear": "清理本机记录",
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
    "workspaceEntry.busy": "正在处理另一项工作区操作，请稍后重试。",
    "workspaceEntry.requireWorkspace": "请先添加工作区，再{action}文件或文件夹。",
    "workspaceEntry.actionRename": "重命名",
    "workspaceEntry.actionDelete": "删除",
    "workspaceEntry.actionMove": "移动",
    "workspaceEntry.actionCopy": "复制",
    "workspaceEntry.kindFile": "文件",
    "workspaceEntry.kindFolder": "文件夹",
    "workspaceEntry.renameFile": "重命名文件",
    "workspaceEntry.renameFolder": "重命名文件夹",
    "workspaceEntry.confirmDirty": "当前文档有未保存修改，是否先保存后{action}？",
    "workspaceEntry.confirmDeleteFile": "确定将文件“{name}”移入 Windows 回收站吗？",
    "workspaceEntry.confirmDeleteFolder": "确定将文件夹“{name}”及其中的全部内容移入 Windows 回收站吗？",
    "workspaceEntry.renamed": "已重命名{kind}：{name}",
    "workspaceEntry.deletedFile": "已移入 Windows 回收站：文件 {name}",
    "workspaceEntry.deletedFolder": "已移入 Windows 回收站：文件夹及其内容 {name}",
    "workspaceEntry.moved": "已移动{kind}：{name}",
    "workspaceEntry.copied": "已复制{kind}：{name}",
    "workspaceEntry.staleEdits": "内容位置已变更，当前编辑内容仍保留在内存中，请确认后另存。",
    "workspaceEntry.refreshFailure": "操作已完成，但阅读库列表刷新失败，请手动刷新。",
    "workspaceEntry.copyRefreshFailure": "复制已完成，但阅读库列表刷新失败，请手动刷新。",
    "workspaceEntry.renameFailure": "无法重命名工作区内容。",
    "workspaceEntry.deleteFailure": "无法删除工作区内容。",
    "workspaceEntry.transferFailure": "{action}工作区内容失败。",
    "workspaceEntry.renameReopenFailure": "文件已重命名，但重新打开失败，请从文件树中再次打开。",
    "workspaceEntry.moveReopenFailure": "内容已移动，但重新打开当前文档失败，请从文件树中再次打开。",
    "workspaceEntry.deleteReopenFailure": "内容已删除，但无法打开相邻标签页。",
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
    "workspace.title": "Library",
    "workspace.actions": "Library actions",
    "workspace.create": "New",
    "workspace.root": "Library root",
    "workspace.createNote": "New note",
    "workspace.createFolder": "New folder",
    "workspace.search": "Search",
    "workspace.manage": "Manage library",
    "workspace.limitReached": "The limit of {count} libraries is reached. Remove one before adding another.",
    "workspace.addTitle": "Add another library",
    "workspace.add": "Add library",
    "workspace.mounted": "Mounted libraries",
    "workspace.remove": "Remove {name} from mounted libraries",
    "workspace.batchExport": "Batch export",
    "workspace.export.html": "Single HTML file",
    "workspace.export.docx": "Single Word file",
    "workspace.export.pdf": "Batch print / PDF",
    "workspace.cancelExport": "Cancel export",
    "workspace.counts": "{files} items · {libraries} libraries",
    "workspace.help": "Add a folder to browse its documents and search the library.",
    "workspace.exportProgress": "Preparing",
    "workspace.exportProgressLabel": "Batch export progress",
    "workspace.exportFailures": "View {count} files not exported",
    "workspace.copyList": "Copy list",
    "workspace.saveList": "Save list",
    "workspace.indexLoading": "Folder opened. Indexing links and tags…",
    "workspace.truncated":
      "This library is large. The file tree and index show only the safe loading range; narrow the library to see the rest.",
    "workspace.searchLoading": "Preparing library search results…",
    "workspace.matchCount": "{count} matches in this library",
    "workspace.visibleCount": "Showing {visible} / {total} items",
    "workspace.clearFilters": "Clear filters",
    "workspace.searchLabel": "Search this library",
    "workspace.searchPlaceholder": "Search library contents",
    "workspace.tags": "Tags",
    "workspace.tagFilter": "Filter library by tag",
    "workspace.allTags": "All tags",
    "workspace.kind": "Type",
    "workspace.kindFilter": "Filter library by type",
    "workspace.kind.all": "All types",
    "workspace.kind.markdown": "Markdown",
    "workspace.kind.text": "Plain text",
    "workspace.kind.docx": "Word",
    "workspace.kind.pdf": "PDF",
    "workspace.kind.image": "Image",
    "workspace.searchHint": "Enter at least 2 characters to search this library.",
    "workspace.searching": "Searching this library…",
    "workspace.noMatches": "No matching documents in this library.",
    "workspace.filesLabel": "Library files",
    "workspace.files": "Files",
    "workspace.noFiles": "No files with the selected tag.",
    "workspace.recentLibraries": "Recent libraries",
    "workspace.recentFiles": "Recently opened",
    "workspace.lastOpened": "Last opened",
    "workspace.history": "Reading this week",
    "workspace.historyToggle": "Reading history",
    "history.range": "Mon–Sun",
    "history.summary": "Reading this week: {count} documents, {duration} total",
    "history.documents": "documents",
    "history.duration": "Total time",
    "history.dailyDuration": "{day} reading time",
    "history.empty": "No local reading history yet.",
    "history.emptyWeek": "No reading time this week.",
    "history.clear": "Clear local history",
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
    "workspaceEntry.busy": "Another workspace operation is in progress. Try again shortly.",
    "workspaceEntry.requireWorkspace": "Add a workspace before you {action} a file or folder.",
    "workspaceEntry.actionRename": "rename",
    "workspaceEntry.actionDelete": "delete",
    "workspaceEntry.actionMove": "move",
    "workspaceEntry.actionCopy": "copy",
    "workspaceEntry.kindFile": "file",
    "workspaceEntry.kindFolder": "folder",
    "workspaceEntry.renameFile": "Rename file",
    "workspaceEntry.renameFolder": "Rename folder",
    "workspaceEntry.confirmDirty": "The current document has unsaved changes. Save before you {action} it?",
    "workspaceEntry.confirmDeleteFile": "Move “{name}” to the Windows Recycle Bin?",
    "workspaceEntry.confirmDeleteFolder": "Move “{name}” and everything inside it to the Windows Recycle Bin?",
    "workspaceEntry.renamed": "Renamed {kind}: {name}",
    "workspaceEntry.deletedFile": "Moved file to the Windows Recycle Bin: {name}",
    "workspaceEntry.deletedFolder": "Moved folder and its contents to the Windows Recycle Bin: {name}",
    "workspaceEntry.moved": "Moved {kind}: {name}",
    "workspaceEntry.copied": "Copied {kind}: {name}",
    "workspaceEntry.staleEdits":
      "The location changed. Your current edits remain in memory; review them and save a copy.",
    "workspaceEntry.refreshFailure": "The operation finished, but the library did not refresh. Refresh it manually.",
    "workspaceEntry.copyRefreshFailure": "The copy finished, but the library did not refresh. Refresh it manually.",
    "workspaceEntry.renameFailure": "Could not rename the workspace item.",
    "workspaceEntry.deleteFailure": "Could not delete the workspace item.",
    "workspaceEntry.transferFailure": "Could not {action} the workspace item.",
    "workspaceEntry.renameReopenFailure":
      "The file was renamed, but could not be reopened. Open it from the file tree.",
    "workspaceEntry.moveReopenFailure":
      "The item was moved, but the current document could not be reopened. Open it from the file tree.",
    "workspaceEntry.deleteReopenFailure": "The item was deleted, but the adjacent tab could not be opened.",
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
