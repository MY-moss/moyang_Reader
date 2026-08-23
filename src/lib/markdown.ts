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
import type { Root as HastRoot } from "hast";
import type { PhrasingContent, Root } from "mdast";
import type { RenderedMarkdown } from "../app/types";
import { collectToc, escapeHtml, readingStats, textContent } from "./text";

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

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml", "toml"])
    .use(remarkMath)
    .use(remarkWikiLinks)
    .use(remarkRehype)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeStringify);
  const tree = processor.parse(source);
  const processed = (await processor.run(tree)) as HastRoot;

  return {
    html: processor.stringify(processed),
    toc: collectToc(processed),
    ...readingStats(processed.children.map(textContent).join(" ")),
  };
}

export async function renderPlainText(source: string): Promise<RenderedMarkdown> {
  return {
    html: `<pre class="plain-text">${escapeHtml(source)}</pre>`,
    toc: [],
    ...readingStats(source),
  };
}
