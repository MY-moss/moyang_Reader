import type { DocumentKind } from "../../shared/types";
import type { SourceChunk } from "../../shared/bookroom-types";
import { sourceBlocks } from "../reader/source-locator";
import { renderSource, renderDocx } from "./rendering/document-adapters";

export async function contentHash(source: string | Uint8Array): Promise<string> {
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : source.slice();
  const hash = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function textChunks(path: string, text: string, hash: string, page?: number): SourceChunk[] {
  const result: SourceChunk[] = [];
  let offset = 0;
  for (const [paragraph, line] of text.split(/\n\s*\n/).entries()) {
    const start = text.indexOf(line, offset);
    offset = start + line.length;
    for (let i = 0; i < line.length; i += 1000) {
      const part = line.slice(i, i + 1120).trim();
      if (part)
        result.push({
          text: part,
          location: { path, hash, page, paragraph: paragraph + 1, offset: start + i, quote: part.slice(0, 120) },
        });
    }
  }
  return result;
}
export async function extractSourceChunks(
  path: string,
  kind: DocumentKind,
  source: string | Uint8Array,
): Promise<{ hash: string; chunks: SourceChunk[]; text: string }> {
  const hash = await contentHash(source);
  if (typeof source === "string") {
    let text = source;
    if (kind === "markdown") {
      const rendered = await renderSource(path, source, { allowRemoteResources: false });
      text = sourceBlocks(new DOMParser().parseFromString(rendered.html, "text/html"))
        .map((node) => node.textContent ?? "")
        .join("\n\n");
    }
    return { hash, chunks: textChunks(path, text, hash), text };
  }
  if (kind === "docx") {
    const rendered = await renderDocx(source, { allowRemoteResources: false });
    const dom = new DOMParser().parseFromString(rendered.html, "text/html");
    const text = sourceBlocks(dom)
      .map((node) => node.textContent ?? "")
      .join("\n\n");
    return { hash, chunks: textChunks(path, text, hash), text };
  }
  if (kind === "pdf") {
    const { loadPdf } = await import("./pdf");
    const task = loadPdf(source);
    const pdf = await task.promise;
    const chunks: SourceChunk[] = [];
    const pages: string[] = [];
    try {
      for (let page = 1; page <= pdf.numPages; page += 1) {
        const documentPage = await pdf.getPage(page);
        const content = await documentPage.getTextContent();
        const text = content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join("");
        chunks.push(...textChunks(path, text, hash, page));
        pages.push(text.trim());
        documentPage.cleanup();
      }
    } finally {
      await task.destroy();
    }
    if (!chunks.length) throw new Error("PDF 没有可提取的文字，可能是扫描件；仍可逐页阅读和摘录。");
    return { hash, chunks, text: pages.join("\n\n") };
  }
  throw new Error("此文件类型没有可检索正文。");
}
