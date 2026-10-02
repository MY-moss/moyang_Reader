import type { Locale } from "./i18n";
import type { WorkspaceNameValidation } from "./workspace-name-input";
import { ERROR_CODES, normalizeAppError } from "./error-contract";

const zh = {
  createNote: "新建笔记",
  createFolder: "新建文件夹",
  renameFile: "重命名文件",
  renameFolder: "重命名文件夹",
  create: "创建",
  rename: "重命名",
  cancel: "取消",
  busy: "正在完成操作…",
  directory: "所在目录",
  currentName: "当前名称",
  name: "名称",
  newName: "新名称",
  untitledNote: "未命名笔记",
  untitledFolder: "新建文件夹",
  noteHint: "省略扩展名会自动添加 .md；笔记只支持 Markdown 格式。",
  folderHint: "在上方目录内创建一个文件夹，不包含子路径。",
  renameHint: "只修改名称，不移动位置。文件省略扩展名时沿用原扩展名。",
  empty: "请输入名称，不能使用 . 或 ..。",
  separator: "名称不能包含 / 或 \\。只填写名称，不填写路径。",
  characters: '请移除 < > " | ? * : 等 Windows 不允许的字符。',
  ending: "名称不能以句点结尾。",
  reserved: "这是 Windows 保留设备名，请换一个名称。",
  markdownOnly: "新笔记只支持 .md、.markdown、.mdown 或 .mkd 扩展名。",
  unsupportedType: "请保留为 Markdown、文本、Word、PDF 或图片，或省略扩展名以沿用原类型。",
  unchanged: "请输入与当前名称不同的名称。",
  operationFailed: "操作未完成。请检查名称是否已存在、原条目是否仍在，以及目录是否可写，修改后重试。",
  accessDenied: "无法访问这个目录。请检查权限，或重新打开阅读库后重试。",
  saveFailed: "当前修改尚未保存，名称未改变。请先解决保存问题，再重试。",
  requireWorkspace: "请先打开一个本机阅读库，再创建笔记或文件夹。",
  created: "已创建：{name}",
  refreshFailed: "条目已创建，但文件树未刷新。请刷新阅读库；不要重复创建。",
  openFailed: "笔记已创建，但未能打开。请从文件树打开它；不要重复创建。",
};
const en: Record<keyof typeof zh, string> = {
  createNote: "New note",
  createFolder: "New folder",
  renameFile: "Rename file",
  renameFolder: "Rename folder",
  create: "Create",
  rename: "Rename",
  cancel: "Cancel",
  busy: "Completing operation…",
  directory: "Directory",
  currentName: "Current name",
  name: "Name",
  newName: "New name",
  untitledNote: "Untitled note",
  untitledFolder: "New folder",
  noteHint: "Leave out the extension to add .md automatically. Notes use Markdown only.",
  folderHint: "Create one folder in the directory above. Do not include a subpath.",
  renameHint: "Rename without moving. Leave out a file extension to keep the original extension.",
  empty: 'Enter a name; "." and ".." are not allowed.',
  separator: "Do not include / or \\. Enter a name, not a path.",
  characters: 'Remove Windows-invalid characters: < > " | ? * :',
  ending: "A name cannot end with a period.",
  reserved: "This is a reserved Windows device name. Choose another name.",
  markdownOnly: "Notes support .md, .markdown, .mdown or .mkd extensions only.",
  unsupportedType: "Keep a Markdown, text, Word, PDF or image type, or omit the extension to retain it.",
  unchanged: "Enter a name different from the current name.",
  operationFailed:
    "The operation did not finish. Check for an existing name, a missing original, or a read-only directory. Edit the name and retry.",
  accessDenied: "Cannot access this directory. Check permissions or reopen the library, then retry.",
  saveFailed: "Your edits have not been saved. The name has not changed. Resolve the save problem before retrying.",
  requireWorkspace: "Open a local reading library before creating a note or folder.",
  created: "Created: {name}",
  refreshFailed: "The entry was created, but the tree did not refresh. Refresh the library; do not create it again.",
  openFailed: "The note was created but could not be opened. Open it from the file tree; do not create it again.",
};
export const workspaceNameMessages = { "zh-CN": zh, "en-US": en };
export type WorkspaceNameMessageKey = keyof typeof zh;
export function workspaceNameText(
  locale: Locale,
  key: WorkspaceNameMessageKey | WorkspaceNameValidation,
  values: Record<string, string> = {},
): string {
  return workspaceNameMessages[locale][key].replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) => values[name] ?? placeholder,
  );
}
export function workspaceNameError(
  locale: Locale,
  cause: unknown,
  action: "rename" | "create-note" | "create-folder" = "rename",
): string {
  const { code } = normalizeAppError(cause);
  const key =
    code === ERROR_CODES.WORKSPACE_ACCESS_DENIED
      ? "accessDenied"
      : code === ERROR_CODES.FILE_WRITE_FAILED && action === "rename"
        ? "saveFailed"
        : "operationFailed";
  return workspaceNameText(locale, key);
}
