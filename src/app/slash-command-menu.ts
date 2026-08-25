export type SlashCommandId =
  "heading1" | "heading2" | "heading3" | "bulletList" | "orderedList" | "quote" | "codeBlock" | "table" | "divider";

export type SlashCommand = {
  id: SlashCommandId;
  /** 菜单中展示的名称。 */
  label: string;
  /** 展示用的语法提示。 */
  detail: string;
  /** 过滤用的拼音/英文关键字（小写）。 */
  keywords: string;
  /** 源码模式下替换 `/查询` 的 Markdown 文本。 */
  sourceInsert: string;
  /** 源码模式下光标落在 sourceInsert 内的偏移；默认为末尾。 */
  caretOffset?: number;
};

export type SlashTrigger = {
  /** `/` 之后已输入的查询文本。 */
  query: string;
};

const maxVisibleCommands = 8;

export const slashCommands: readonly SlashCommand[] = [
  {
    id: "heading1",
    label: "标题 1",
    detail: "# 一级标题",
    keywords: "h1 heading biaoti",
    sourceInsert: "# ",
  },
  {
    id: "heading2",
    label: "标题 2",
    detail: "## 二级标题",
    keywords: "h2 heading biaoti",
    sourceInsert: "## ",
  },
  {
    id: "heading3",
    label: "标题 3",
    detail: "### 三级标题",
    keywords: "h3 heading biaoti",
    sourceInsert: "### ",
  },
  {
    id: "bulletList",
    label: "无序列表",
    detail: "- 列表项",
    keywords: "list bullet ul wuxu",
    sourceInsert: "- ",
  },
  {
    id: "orderedList",
    label: "有序列表",
    detail: "1. 列表项",
    keywords: "list ordered ol youxu",
    sourceInsert: "1. ",
  },
  {
    id: "quote",
    label: "引用",
    detail: "> 引用内容",
    keywords: "quote blockquote yinyong",
    sourceInsert: "> ",
  },
  {
    id: "codeBlock",
    label: "代码块",
    detail: "``` 代码块 ```",
    keywords: "code codeblock daima",
    sourceInsert: "```\n\n```\n",
    caretOffset: 4,
  },
  {
    id: "table",
    label: "表格",
    detail: "3×3 表格",
    keywords: "table biao",
    sourceInsert: "| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|   |   |   |\n",
  },
  {
    id: "divider",
    label: "分隔线",
    detail: "---",
    keywords: "hr divider fengexian",
    sourceInsert: "\n---\n",
  },
];

/**
 * 匹配块首的 `/查询` 片段：`/` 必须是行（源码模式）或文本块（WYSIWYG 模式）
 * 的第一个字符，其后只允许字母、数字、下划线和中文，出现空格即停止匹配。
 */
export function matchSlashTrigger(textFromBlockStartToCaret: string): SlashTrigger | null {
  const match = /^\/([\w\u4e00-\u9fa5]*)$/.exec(textFromBlockStartToCaret);
  if (!match) return null;
  return { query: match[1] };
}

function scoreCommand(command: SlashCommand, query: string): number {
  const lowerQuery = query.toLowerCase();
  const haystacks = [command.label, command.keywords, command.detail];
  let best = 0;

  for (const haystack of haystacks) {
    const lower = haystack.toLowerCase();
    if (lower.startsWith(lowerQuery)) best = Math.max(best, 3);
    else if (lower.includes(lowerQuery)) best = Math.max(best, 2);
  }

  return best;
}

/**
 * 过滤并排序命令：前缀匹配优先，其次包含匹配；最多返回 8 条。
 */
export function filterSlashCommands(commands: readonly SlashCommand[], query: string): SlashCommand[] {
  const trimmed = query.trim();
  const scored = (
    trimmed
      ? commands
          .map((command) => ({ command, score: scoreCommand(command, trimmed) }))
          .filter((entry) => entry.score > 0)
      : commands.map((command) => ({ command, score: 1 }))
  ).sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label, "zh-CN"));

  return scored.slice(0, maxVisibleCommands).map((entry) => entry.command);
}

/** 源码模式下光标在插入文本中的落点。 */
export function slashCaretOffset(command: SlashCommand): number {
  return command.caretOffset ?? command.sourceInsert.length;
}
