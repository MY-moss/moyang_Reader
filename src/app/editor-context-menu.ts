export type EditorContextAction =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "select-all"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "ordered-list"
  | "quote"
  | "code-block"
  | "link"
  | "wikilink"
  | "image"
  | "table"
  | "horizontal-rule";

export type EditorContextMenuItem = {
  action: EditorContextAction;
  label: string;
  shortcut?: string;
  disabled?: boolean;
};

export type EditorContextMenuGroup = {
  label: string;
  items: readonly EditorContextMenuItem[];
};

export const editorContextMenuGroups: readonly EditorContextMenuGroup[] = [
  {
    label: "编辑",
    items: [
      { action: "undo", label: "撤销", shortcut: "Ctrl Z" },
      { action: "redo", label: "重做", shortcut: "Ctrl Y" },
      { action: "cut", label: "剪切", shortcut: "Ctrl X" },
      { action: "copy", label: "复制", shortcut: "Ctrl C" },
      { action: "paste", label: "粘贴", shortcut: "Ctrl V" },
      { action: "select-all", label: "全选", shortcut: "Ctrl A" },
    ],
  },
  {
    label: "格式",
    items: [
      { action: "bold", label: "粗体", shortcut: "Ctrl B" },
      { action: "italic", label: "斜体", shortcut: "Ctrl I" },
      { action: "strike", label: "删除线" },
      { action: "inline-code", label: "行内代码" },
    ],
  },
  {
    label: "段落",
    items: [
      { action: "paragraph", label: "正文段落" },
      { action: "heading-1", label: "标题 1" },
      { action: "heading-2", label: "标题 2" },
      { action: "heading-3", label: "标题 3" },
      { action: "bullet-list", label: "无序列表" },
      { action: "ordered-list", label: "有序列表" },
      { action: "quote", label: "引用" },
      { action: "code-block", label: "代码块" },
    ],
  },
  {
    label: "插入",
    items: [
      { action: "link", label: "链接", shortcut: "Ctrl K" },
      { action: "wikilink", label: "双链" },
      { action: "image", label: "图片" },
      { action: "table", label: "表格" },
      { action: "horizontal-rule", label: "分隔线" },
    ],
  },
];
