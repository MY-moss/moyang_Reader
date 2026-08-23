import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root as HastRoot, RootContent } from "hast";
import type { DocumentKind, RenderedMarkdown, TocItem } from "../app/types";

const docxSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), "data"],
  },
};

function extensionOf(path: string): string {
  return path.split(/[?#]/, 1)[0].split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
}

const imageMimeTypes: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export function documentKindFromPath(path: string): DocumentKind {
  const extension = extensionOf(path);
  if (extension === "docx") return "docx";
  if (extension === "pdf") return "pdf";
  if (extension in imageMimeTypes) return "image";
  if (["txt", "text", "log"].includes(extension)) return "text";
  return "markdown";
}

export function imageMimeType(path: string): string {
  return imageMimeTypes[extensionOf(path)] ?? "application/octet-stream";
}

export function isEditableDocument(kind: DocumentKind): boolean {
  return kind === "markdown" || kind === "text";
}

function readingStats(text: string): Pick<RenderedMarkdown, "wordCount" | "readingMinutes"> {
  const wordCount = text.trim() ? Array.from(text.trim()).length : 0;
  return {
    wordCount,
    readingMinutes: wordCount ? Math.max(1, Math.ceil(wordCount / 450)) : 0,
  };
}

function textContent(node: RootContent): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map(textContent).join("");
  return "";
}

function collectToc(tree: HastRoot): TocItem[] {
  const toc: TocItem[] = [];

  visit(tree, "element", (node) => {
    if (!/^h[1-4]$/.test(node.tagName)) return;
    const text = node.children.map(textContent).join("").trim();
    const id = typeof node.properties?.id === "string" ? node.properties.id : "section";
    if (text) toc.push({ id, depth: Number(node.tagName.slice(1)), text });
  });

  return toc;
}

export async function renderHtmlFragment(source: string): Promise<RenderedMarkdown> {
  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, docxSanitizeSchema)
    .use(rehypeSlug);
  const tree = processor.parse(source);
  const processed = await processor.run(tree) as HastRoot;
  const html = unified().use(rehypeStringify).stringify(processed);
  const plainText = processed.children.map(textContent).join(" ");

  return {
    html,
    toc: collectToc(processed),
    ...readingStats(plainText),
  };
}

export async function renderSource(path: string, source: string): Promise<RenderedMarkdown> {
  const { renderMarkdown, renderPlainText } = await import("./markdown");
  return documentKindFromPath(path) === "text" ? renderPlainText(source) : renderMarkdown(source);
}

export async function renderDocx(bytes: Uint8Array): Promise<RenderedMarkdown> {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const bufferConstructor = (globalThis as typeof globalThis & {
    Buffer?: { from: (value: ArrayBuffer) => unknown };
  }).Buffer;
  const input = bufferConstructor ? { buffer: bufferConstructor.from(arrayBuffer) } : { arrayBuffer };
  const result = await mammoth.convertToHtml(input as Parameters<typeof mammoth.convertToHtml>[0]);

  if (!result.value.trim()) {
    throw new Error("Word 文档没有可显示的正文内容。");
  }

  return renderHtmlFragment(result.value);
}

export function emptyRenderedDocument(): RenderedMarkdown {
  return { html: "", toc: [], wordCount: 0, readingMinutes: 0 };
}
