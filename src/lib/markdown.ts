import { unified } from "unified";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { PhrasingContent, Root } from "mdast";
import type { RenderedMarkdown, TocItem } from "../app/types";

const wikiPattern = /(!?)\[\[([^\]]+)\]\]/g;

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "moyang-wiki"],
    src: [...(defaultSchema.protocols?.src ?? []), "moyang-embed"],
  },
};

function remarkWikiLinks() {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof index !== "number" || !wikiPattern.test(node.value)) {
        wikiPattern.lastIndex = 0;
        return;
      }

      wikiPattern.lastIndex = 0;
      const replacement: PhrasingContent[] = [];
      let cursor = 0;

      for (const match of node.value.matchAll(wikiPattern)) {
        const start = match.index ?? 0;
        const embed = match[1] === "!";
        const rawTarget = match[2].trim();
        const [targetPart, aliasPart] = rawTarget.split("|");
        const label = aliasPart?.trim() || targetPart.trim();

        if (start > cursor) {
          replacement.push({ type: "text", value: node.value.slice(cursor, start) });
        }

        if (embed) {
          replacement.push({
            type: "image",
            url: `moyang-embed:${targetPart.trim()}`,
            alt: label,
          });
        } else {
          replacement.push({
            type: "link",
            url: `moyang-wiki:${targetPart.trim()}`,
            children: [{ type: "text", value: label }],
          });
        }

        cursor = start + match[0].length;
      }

      if (cursor < node.value.length) {
        replacement.push({ type: "text", value: node.value.slice(cursor) });
      }

      parent.children.splice(index, 1, ...replacement);
    });
  };
}

function collectToc(tree: Root): TocItem[] {
  const toc: TocItem[] = [];

  visit(tree, "heading", (node) => {
    const text = node.children
      .map((child) => ("value" in child ? child.value : ""))
      .join("")
      .trim();

    if (text) {
      toc.push({
        id: slugify(text),
        depth: node.depth,
        text,
      });
    }
  });

  return toc;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s-]+/g, "-") || "section";
}

function readingStats(source: string): Pick<RenderedMarkdown, "wordCount" | "readingMinutes"> {
  const wordCount = source.trim() ? Array.from(source.trim()).length : 0;
  return {
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 450)),
  };
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml", "toml"])
    .use(remarkMath)
    .use(remarkWikiLinks)
    .parse(source);

  const toc = collectToc(tree);
  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml", "toml"])
    .use(remarkMath)
    .use(remarkWikiLinks)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(source);

  return {
    html: String(processed),
    toc,
    ...readingStats(source),
  };
}

function escapeHtml(source: string): string {
  return source
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderPlainText(source: string): Promise<RenderedMarkdown> {
  return {
    html: `<pre class="plain-text">${escapeHtml(source)}</pre>`,
    toc: [],
    ...readingStats(source),
  };
}
