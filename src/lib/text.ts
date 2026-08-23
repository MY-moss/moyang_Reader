import type { Root as HastRoot, RootContent } from "hast";
import { visit } from "unist-util-visit";
import type { RenderedMarkdown, TocItem } from "../app/types";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function readingStats(text: string): Pick<RenderedMarkdown, "wordCount" | "readingMinutes"> {
  const wordCount = text.trim() ? Array.from(text.trim()).length : 0;
  return {
    wordCount,
    readingMinutes: wordCount ? Math.max(1, Math.ceil(wordCount / 450)) : 0,
  };
}

export function textContent(node: RootContent): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map(textContent).join("");
  return "";
}

export function collectToc(tree: HastRoot): TocItem[] {
  const toc: TocItem[] = [];

  visit(tree, "element", (node) => {
    if (!/^h[1-4]$/.test(node.tagName)) return;
    const text = node.children.map(textContent).join("").trim();
    const rawId = node.properties?.id;
    const id = typeof rawId === "string" ? rawId : "section";
    if (text) toc.push({ id, depth: Number(node.tagName.slice(1)), text });
  });

  return toc;
}
