export type WikiLinkCandidate = {
  /** 在 `[[` 后插入的目标文本（不含扩展名）。 */
  value: string;
  /** 下拉列表中展示的名称。 */
  label: string;
  /** 展示用的相对路径说明。 */
  detail?: string;
};

export type WikiCandidateFile = {
  name: string;
  /** 工作区内的绝对路径。 */
  path?: string;
  /** 相对工作区根目录的路径。 */
  relativePath?: string;
  kind?: string;
};

export type WikiLinkTrigger = {
  /** `[[` 之后已输入的查询文本。 */
  query: string;
};

const markdownExtensions = [".md", ".markdown", ".mdown", ".mkd"];
const maxVisibleCandidates = 8;

function stripMarkdownExtension(name: string): string {
  for (const extension of markdownExtensions) {
    if (name.toLowerCase().endsWith(extension)) return name.slice(0, -extension.length);
  }
  return name;
}

function isMarkdownFile(file: WikiCandidateFile): boolean {
  if (file.kind) return file.kind === "markdown";
  return markdownExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));
}

/**
 * 从工作区文件构建双链候选。同名文档全部保留，用相对路径区分；
 * 当前文档自身会被排除，避免把链接指向自己。
 */
export function buildWikiLinkCandidates(
  files: readonly WikiCandidateFile[],
  currentPath?: string,
): WikiLinkCandidate[] {
  const seen = new Set<string>();
  const candidates: WikiLinkCandidate[] = [];

  for (const file of files) {
    if (!isMarkdownFile(file)) continue;
    if (currentPath && (file.path === currentPath || file.relativePath === currentPath)) continue;

    const value = stripMarkdownExtension(file.name);
    if (!value) continue;

    const dedupeKey = file.relativePath ?? file.name;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    candidates.push({
      value,
      label: value,
      detail: file.relativePath && file.relativePath !== file.name ? file.relativePath : undefined,
    });
  }

  return candidates;
}

/**
 * 匹配光标前的 `[[查询` 片段；出现 `]]`、`|` 或换行后即停止补全。
 */
export function matchWikiLinkTrigger(textBeforeCaret: string): WikiLinkTrigger | null {
  const match = /\[\[([^\][|\n]*)$/.exec(textBeforeCaret);
  if (!match) return null;
  return { query: match[1] };
}

function scoreCandidate(candidate: WikiLinkCandidate, query: string): number {
  const haystacks = [candidate.value, candidate.detail ?? ""];
  let best = 0;

  for (const haystack of haystacks) {
    if (!haystack) continue;
    const lowerHaystack = haystack.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (lowerHaystack.startsWith(lowerQuery)) best = Math.max(best, 3);
    else if (lowerHaystack.includes(lowerQuery)) best = Math.max(best, 2);
  }

  return best;
}

/**
 * 过滤并排序候选：前缀匹配优先，其次包含匹配；最多返回 8 条。
 */
export function filterWikiLinkCandidates(candidates: readonly WikiLinkCandidate[], query: string): WikiLinkCandidate[] {
  const trimmed = query.trim();
  const scored = (
    trimmed
      ? candidates
          .map((candidate) => ({ candidate, score: scoreCandidate(candidate, trimmed) }))
          .filter((entry) => entry.score > 0)
      : candidates.map((candidate) => ({ candidate, score: 1 }))
  ).sort((a, b) => b.score - a.score || a.candidate.value.localeCompare(b.candidate.value, "zh-CN"));

  return scored.slice(0, maxVisibleCandidates).map((entry) => entry.candidate);
}

export type WikiCompletionKeyAction = "next" | "previous" | "accept" | "dismiss";

/**
 * 把补全浮层内需要接管的按键映射为动作；其余按键返回 null 交给编辑器。
 */
export function wikiCompletionKeyAction(key: string): WikiCompletionKeyAction | null {
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "previous";
    case "Enter":
    case "Tab":
      return "accept";
    case "Escape":
      return "dismiss";
    default:
      return null;
  }
}

export function nextWikiCompletionIndex(index: number, count: number, action: WikiCompletionKeyAction): number {
  if (count <= 0) return 0;
  if (action === "next") return (index + 1) % count;
  if (action === "previous") return (index - 1 + count) % count;
  return index;
}

export function formatWikiLinkInsert(candidate: WikiLinkCandidate): string {
  return `[[${candidate.value}]]`;
}
