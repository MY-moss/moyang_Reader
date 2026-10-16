import type { DocumentKind, RenderedMarkdown } from "../../../shared/types";
import { documentAdapterForKind, documentAdapterForPath, extensionFromPath } from "./adapters/registry";
import type { RenderOptions } from "./markdown";

const imageMimeTypes: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export function documentKindFromPath(path: string): DocumentKind | null {
  return documentAdapterForPath(path)?.kind ?? null;
}

export function imageMimeType(path: string): string {
  return imageMimeTypes[extensionFromPath(path)] ?? "application/octet-stream";
}

export function isEditableDocument(kind: DocumentKind): boolean {
  return documentAdapterForKind(kind)?.capabilities.edit ?? false;
}

export async function renderHtmlFragment(source: string, options: RenderOptions = {}): Promise<RenderedMarkdown> {
  const module = await import("./html-fragment");
  return module.renderHtmlFragment(source, options);
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
