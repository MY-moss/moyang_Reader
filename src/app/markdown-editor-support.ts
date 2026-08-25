export type MarkdownEditorSafety = {
  safe: boolean;
  reason?: string;
};

export type EditorSourceSyncTracker = {
  markEditorSource: (source: string) => void;
  shouldApplyExternalSource: (source: string) => boolean;
};

const safetyChecks: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, reason: "包含 frontmatter，先使用源码模式保护属性。" },
  { pattern: /!\[\[/, reason: "包含文档或附件嵌入，暂时保留源码语法。" },
  { pattern: /(^|\n)\s*(?:\$\$|\\\[)/, reason: "包含数学公式，暂时保留源码语法。" },
  { pattern: /(^|\n)\s*<([a-z][\w-]*)(?:\s|>)/i, reason: "包含原始 HTML，暂时保留源码结构。" },
  { pattern: /\^[-\w]+(?:\s|$)/m, reason: "包含块引用 ID，暂时保留源码语法。" },
];

export function checkMarkdownEditorSafety(source: string): MarkdownEditorSafety {
  const match = safetyChecks.find(({ pattern }) => pattern.test(source));
  return match ? { safe: false, reason: match.reason } : { safe: true };
}

export function createEditorSourceSyncTracker(initialSource: string): EditorSourceSyncTracker {
  let lastKnownSource = initialSource;

  return {
    markEditorSource(source) {
      lastKnownSource = source;
    },
    shouldApplyExternalSource(source) {
      if (source === lastKnownSource) return false;
      lastKnownSource = source;
      return true;
    },
  };
}
