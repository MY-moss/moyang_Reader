import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import type { Root as HastRoot } from "hast";
import type { DocumentKind, RenderedMarkdown } from "../app/types";
import { collectToc, readingStats, textContent } from "./text";
import type { RenderOptions } from "./markdown";

const docxSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), "data"],
  },
};

function schemaFor(options: RenderOptions) {
  if (options.allowRemoteResources) return docxSanitizeSchema;

  return {
    ...docxSanitizeSchema,
    protocols: {
      ...docxSanitizeSchema.protocols,
      src: ["data", "moyang-embed"],
    },
  };
}

function createHtmlProcessor(options: RenderOptions) {
  return unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize, schemaFor(options)).use(rehypeSlug);
}

const localHtmlProcessor = createHtmlProcessor({ allowRemoteResources: false });
const remoteHtmlProcessor = createHtmlProcessor({ allowRemoteResources: true });

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

const markdownExtensions = ["md", "markdown", "mdown", "mkd"];

export function documentKindFromPath(path: string): DocumentKind | null {
  const extension = extensionOf(path);
  if (extension === "docx") return "docx";
  if (extension === "pdf") return "pdf";
  if (Object.hasOwn(imageMimeTypes, extension)) return "image";
  if (["txt", "text", "log"].includes(extension)) return "text";
  if (markdownExtensions.includes(extension)) return "markdown";
  return null;
}

export function imageMimeType(path: string): string {
  return imageMimeTypes[extensionOf(path)] ?? "application/octet-stream";
}

export function isEditableDocument(kind: DocumentKind): boolean {
  return kind === "markdown" || kind === "text";
}

export async function renderHtmlFragment(source: string, options: RenderOptions = {}): Promise<RenderedMarkdown> {
  const processor = options.allowRemoteResources ? remoteHtmlProcessor : localHtmlProcessor;
  const tree = processor.parse(source);
  const processed = (await processor.run(tree)) as HastRoot;
  const html = unified().use(rehypeStringify).stringify(processed);
  const plainText = processed.children.map(textContent).join(" ");

  return {
    html,
    toc: collectToc(processed),
    ...readingStats(plainText),
  };
}

export async function renderSource(
  path: string,
  source: string,
  options: RenderOptions = {},
): Promise<RenderedMarkdown> {
  const { renderMarkdown, renderPlainText } = await import("./markdown");
  const kind = documentKindFromPath(path);
  if (!kind) throw new Error("不支持的文档类型。");
  return kind === "text" ? renderPlainText(source) : renderMarkdown(source, options);
}

export async function renderDocx(bytes: Uint8Array, options: RenderOptions = {}): Promise<RenderedMarkdown> {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const bufferConstructor = (
    globalThis as typeof globalThis & {
      Buffer?: { from: (value: ArrayBuffer) => unknown };
    }
  ).Buffer;
  const input = bufferConstructor ? { buffer: bufferConstructor.from(arrayBuffer) } : { arrayBuffer };
  const result = await mammoth.convertToHtml(input as Parameters<typeof mammoth.convertToHtml>[0]);

  if (!result.value.trim()) {
    throw new Error("Word 文档没有可显示的正文内容。");
  }

  return renderHtmlFragment(result.value, options);
}

export function emptyRenderedDocument(): RenderedMarkdown {
  return { html: "", toc: [], wordCount: 0, readingMinutes: 0 };
}
