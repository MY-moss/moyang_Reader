import { escapeHtml } from "../lib/text";
import type { ExportMargin, ExportOrientation, ExportPaper, TocItem } from "./types";

export type ExportOptions = {
  paper: ExportPaper;
  orientation: ExportOrientation;
  margin: ExportMargin;
};

export const defaultExportOptions: ExportOptions = {
  paper: "a4",
  orientation: "portrait",
  margin: "standard",
};

export function fileNameWithExtension(name: string, extension: string): string {
  const baseName = name.replace(/\.[^./\\]+$/, "") || "moyang-reader";
  return baseName + "." + extension;
}

export function pathWithExtension(path: string, extension: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const directory = separator >= 0 ? path.slice(0, separator + 1) : "";
  const name = separator >= 0 ? path.slice(separator + 1) : path;
  return directory + fileNameWithExtension(name, extension);
}

export function pathWithNameSuffix(path: string, suffix: string, extension: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const directory = separator >= 0 ? path.slice(0, separator + 1) : "";
  const name = separator >= 0 ? path.slice(separator + 1) : path;
  const baseName = name.replace(/\.[^./\\]+$/, "") || "moyang-reader";
  return directory + baseName + suffix + "." + extension;
}

function normalizeExportLinks(html: string): string {
  return html
    .replace(/(src|href)="moyang-embed:([^"]+)"/g, '$1="$2"')
    .replace(/href="moyang-wiki:([^"]+)"/g, (_match, target: string) => {
      const [rawPath, rawAnchor] = target.split("#", 2);
      const path = /\.[A-Za-z0-9]+$/.test(rawPath) ? rawPath : rawPath + ".md";
      return 'href="' + path + (rawAnchor ? "#" + rawAnchor : "") + '"';
    });
}

export function htmlToPlainText(html: string): string {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return (parsed.body.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function copyRichText(html: string): Promise<void> {
  const normalizedHtml = normalizeExportLinks(html);
  const plainText = htmlToPlainText(normalizedHtml);

  if (!navigator.clipboard) throw new Error("当前环境不支持复制到剪贴板。");

  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
    const clipboardItem = new ClipboardItem({
      "text/html": new Blob([normalizedHtml], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });
    await navigator.clipboard.write([clipboardItem]);
    return;
  }

  if (typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(plainText);
    return;
  }

  throw new Error("当前环境不支持复制到剪贴板。");
}

const MAX_INLINE_IMAGE_BYTES = 12 * 1024 * 1024;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type DocxImageExtent = {
  cx: number;
  cy: number;
};

const DEFAULT_DOCX_IMAGE_EXTENT: DocxImageExtent = { cx: 5486400, cy: 3657600 };
const DOCX_MAX_IMAGE_EXTENT = DEFAULT_DOCX_IMAGE_EXTENT;
export const BATCH_EXPORT_CHUNK_SIZE = 32;
const DOCX_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function ascii(bytes: Uint8Array, offset: number, value: string): boolean {
  return Array.from(value, (character) => character.charCodeAt(0)).every(
    (character, index) => bytes[offset + index] === character,
  );
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function validImageDimensions(width: number, height: number): ImageDimensions | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24 || !ascii(bytes, 0, "\x89PNG\r\n\x1a\n") || !ascii(bytes, 12, "IHDR")) return null;
  return validImageDimensions(readUint32BigEndian(bytes, 16), readUint32BigEndian(bytes, 20));
}

function gifDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 10 || (!ascii(bytes, 0, "GIF87a") && !ascii(bytes, 0, "GIF89a"))) return null;
  return validImageDimensions(readUint16LittleEndian(bytes, 6), readUint16LittleEndian(bytes, 8));
}

function isJpegSofMarker(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;

    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (isJpegSofMarker(marker) && segmentLength >= 7) {
      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      return validImageDimensions(width, height);
    }
    offset += segmentLength;
  }

  return null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 16 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = readUint32LittleEndian(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > bytes.length) return null;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return validImageDimensions(
        1 + readUint24LittleEndian(bytes, dataOffset + 4),
        1 + readUint24LittleEndian(bytes, dataOffset + 7),
      );
    }
    if (chunkType === "VP8 " && chunkSize >= 10 && ascii(bytes, dataOffset + 3, "\x9d\x01\x2a")) {
      return validImageDimensions(
        readUint16LittleEndian(bytes, dataOffset + 6) & 0x3fff,
        readUint16LittleEndian(bytes, dataOffset + 8) & 0x3fff,
      );
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const bits =
        bytes[dataOffset + 1] |
        (bytes[dataOffset + 2] << 8) |
        (bytes[dataOffset + 3] << 16) |
        (bytes[dataOffset + 4] << 24);
      const width = 1 + (bits & 0x3fff);
      const height = 1 + ((bits >>> 14) & 0x3fff);
      return validImageDimensions(width, height);
    }

    offset += 8 + chunkSize + (chunkSize & 1);
  }

  return null;
}

function avifDimensions(bytes: Uint8Array): ImageDimensions | null {
  // AVIF is an ISO Base Media File. The `ispe` box stores the decoded canvas size.
  for (let offset = 4; offset + 16 <= bytes.length; offset += 1) {
    if (!ascii(bytes, offset, "ispe")) continue;
    const width = readUint32BigEndian(bytes, offset + 8);
    const height = readUint32BigEndian(bytes, offset + 12);
    const dimensions = validImageDimensions(width, height);
    if (dimensions) return dimensions;
  }
  return null;
}

function svgLength(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(?:[a-z]+)?$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function svgDimensions(bytes: Uint8Array): ImageDimensions | null {
  const markup = new TextDecoder().decode(bytes);
  const root = markup.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return null;

  const width = svgLength(root.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1] ?? null);
  const height = svgLength(root.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1] ?? null);
  if (width && height) return validImageDimensions(Math.round(width), Math.round(height));

  const viewBox = root.match(
    /\bviewBox\s*=\s*["']\s*([\d.+-]+)[\s,]+([\d.+-]+)[\s,]+([\d.+-]+)[\s,]+([\d.+-]+)\s*["']/i,
  );
  if (!viewBox) return null;
  const viewBoxWidth = Number(viewBox[3]);
  const viewBoxHeight = Number(viewBox[4]);
  if (!Number.isFinite(viewBoxWidth) || !Number.isFinite(viewBoxHeight)) return null;
  if (width && viewBoxHeight > 0)
    return validImageDimensions(Math.round(width), Math.round((width * viewBoxHeight) / viewBoxWidth));
  if (height && viewBoxWidth > 0)
    return validImageDimensions(Math.round((height * viewBoxWidth) / viewBoxHeight), Math.round(height));
  return validImageDimensions(Math.round(viewBoxWidth), Math.round(viewBoxHeight));
}

export function readImageDimensions(bytes: Uint8Array, contentType: string): ImageDimensions | null {
  const normalizedType = contentType.toLowerCase();
  if (normalizedType === "image/png") return pngDimensions(bytes);
  if (normalizedType === "image/gif") return gifDimensions(bytes);
  if (normalizedType === "image/jpeg") return jpegDimensions(bytes);
  if (normalizedType === "image/webp") return webpDimensions(bytes);
  if (normalizedType === "image/avif") return avifDimensions(bytes);
  if (normalizedType === "image/svg+xml") return svgDimensions(bytes);
  return null;
}

export function calculateDocxImageExtent(dimensions: ImageDimensions | null): DocxImageExtent {
  if (!dimensions) return DEFAULT_DOCX_IMAGE_EXTENT;

  const scale = Math.min(DOCX_MAX_IMAGE_EXTENT.cx / dimensions.width, DOCX_MAX_IMAGE_EXTENT.cy / dimensions.height);
  return {
    cx: Math.max(1, Math.round(dimensions.width * scale)),
    cy: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

type DataImage = {
  contentType: string;
  bytes: Uint8Array;
};

function parseDataImage(source: string): DataImage | null {
  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;

  try {
    const binary = atob(match[2]);
    return {
      contentType: match[1].toLowerCase(),
      bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    };
  } catch {
    return null;
  }
}

async function rasterizeDocxImage(source: string, image: DataImage): Promise<string | null> {
  if (typeof document === "undefined") return null;

  try {
    const blob = new Blob([image.bytes.slice().buffer as ArrayBuffer], { type: image.contentType });
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, bitmap.width);
        canvas.height = Math.max(1, bitmap.height);
        const context = canvas.getContext("2d");
        if (!context) {
          bitmap.close();
          return null;
        }
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return canvas.toDataURL("image/png");
      } catch {
        // Fall through to the Image element decoder when createImageBitmap rejects the format.
      }
    }

    if (typeof Image === "undefined") return null;
    const loaded = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = source;
    });
    if (!loaded) return null;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, loaded.naturalWidth || loaded.width);
    canvas.height = Math.max(1, loaded.naturalHeight || loaded.height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(loaded, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function throwIfExportAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("EXPORT_CANCELLED");
}

async function normalizeDocxImageSources(html: string, signal?: AbortSignal): Promise<string> {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return html;

  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    images.map(async (element) => {
      throwIfExportAborted(signal);
      const source = element.getAttribute("src") ?? "";
      const image = parseDataImage(source);
      if (!image || !["image/avif", "image/webp"].includes(image.contentType)) return;
      const converted = await rasterizeDocxImage(source, image);
      if (converted) element.setAttribute("src", converted);
      throwIfExportAborted(signal);
    }),
  );

  return root.innerHTML;
}

export async function inlineLocalImages(
  html: string,
  resolveLocalPath: (source: string) => string | null,
  readBinary: (path: string) => Promise<Uint8Array>,
  mimeTypeForPath: (path: string) => string,
  getSize?: (path: string) => Promise<number>,
): Promise<string> {
  const sources = Array.from(html.matchAll(/\bsrc="([^"]+)"/g), (match) => match[1]);
  const replacements = new Map<string, string>();

  await Promise.all(
    Array.from(new Set(sources)).map(async (source) => {
      const localPath = resolveLocalPath(source);
      if (!localPath) return;

      try {
        if (getSize && (await getSize(localPath)) > MAX_INLINE_IMAGE_BYTES) return;
        const bytes = await readBinary(localPath);
        if (bytes.length > MAX_INLINE_IMAGE_BYTES) return;
        replacements.set(source, `data:${mimeTypeForPath(localPath)};base64,${bytesToBase64(bytes)}`);
      } catch {
        // Keep an unreadable local image as a relative link so export still succeeds.
      }
    }),
  );

  return html.replace(/\bsrc="([^"]+)"/g, (match, source: string) => {
    const replacement = replacements.get(source);

    return replacement ? `src="${replacement}"` : match;
  });
}

export function summarizeExportFailures(paths: string[], maxItems = 3): string {
  const unique = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
  if (unique.length === 0) return "";

  const limit = Number.isFinite(maxItems) ? Math.max(1, Math.floor(maxItems)) : 3;
  const preview = unique.slice(0, limit).join("、");
  return unique.length > limit ? `${preview} 等 ${unique.length} 个` : preview;
}

export function formatExportCancellationNotice(exported: number, writtenVolumes = 0): string {
  if (writtenVolumes > 0) return `已取消批量导出，已写入 ${writtenVolumes} 个文件，共整理 ${exported} 篇文档。`;
  return `已取消批量导出，已整理 ${exported} 篇文档，未写入文件。`;
}

function exportMargin(options: ExportOptions): string {
  return options.margin === "compact" ? "14mm 14mm" : options.margin === "wide" ? "28mm 24mm" : "22mm 18mm";
}

function exportPageSize(options: ExportOptions): string {
  return options.paper === "letter" ? "Letter" : "A4";
}

function exportTocMarkup(items: TocItem[]): string {
  if (items.length < 2) return "";

  const links = items
    .map(
      (item) =>
        `<li style="padding-left:${Math.max(0, item.depth - 1) * 12}px"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`,
    )
    .join("");
  return `<nav class="export-toc" aria-label="文档目录"><strong>文档目录</strong><ol>${links}</ol></nav>`;
}

function docxPageLayoutXml(options: ExportOptions): string {
  const isLetter = options.paper === "letter";
  const isLandscape = options.orientation === "landscape";
  const portraitWidth = isLetter ? 12240 : 11906;
  const portraitHeight = isLetter ? 15840 : 16838;
  const width = isLandscape ? portraitHeight : portraitWidth;
  const height = isLandscape ? portraitWidth : portraitHeight;
  const margin = options.margin === "compact" ? 720 : options.margin === "wide" ? 2160 : 1440;
  const orientation = isLandscape ? ' w:orient="landscape"' : "";

  return `<w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="${width}" w:h="${height}"${orientation}/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/>`;
}

export function buildHtmlExport(
  title: string,
  body: string,
  options: ExportOptions = defaultExportOptions,
  toc: TocItem[] = [],
): string {
  const tocMarkup = exportTocMarkup(toc);
  return (
    "<!doctype html>\n" +
    '<html lang="zh-CN">\n' +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>" +
    escapeHtml(title) +
    "</title>\n" +
    "  <style>\n" +
    `    @page { size: ${exportPageSize(options)} ${options.orientation}; margin: ${exportMargin(options)}; }\n` +
    "    :root { color-scheme: light; }\n" +
    '    body { max-width: 860px; margin: 0 auto; color: #35332f; background: #fff; font-family: Georgia, "Songti SC", "STSong", serif; font-size: 17px; line-height: 1.85; }\n' +
    '    h1, h2, h3, h4 { color: #292825; font-family: Georgia, "Songti SC", "STSong", serif; font-weight: 500; line-height: 1.25; }\n' +
    "    h1 { margin: 0 0 30px; font-size: 42px; }\n" +
    "    h2 { margin: 50px 0 16px; font-size: 29px; }\n" +
    "    h3 { margin: 35px 0 12px; font-size: 23px; }\n" +
    "    .export-header { margin: 0 0 42px; padding: 0 0 18px; border-bottom: 1px solid #d9d5cc; break-after: avoid; }\n" +
    "    .export-kicker { margin-bottom: 8px; color: #6d716b; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: .12em; }\n" +
    "    .export-header h1 { margin: 0; font-size: 38px; }\n" +
    "    .export-footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #d9d5cc; color: #8a8982; font-family: Arial, sans-serif; font-size: 11px; }\n" +
    "    .export-toc { margin: 0 0 42px; padding: 16px 20px; border: 1px solid #d9d5cc; background: #f8f7f3; break-inside: avoid; }\n" +
    "    .export-toc strong { display: block; margin-bottom: 8px; color: #292825; }\n" +
    "    .export-toc ol { margin: 0; padding-left: 22px; }\n" +
    "    .export-toc li { margin: 3px 0; }\n" +
    "    .export-toc a { color: #28655f; text-decoration: none; }\n" +
    "    .batch-index { margin: 0 0 42px; padding: 16px 20px; border: 1px solid #d9d5cc; background: #f8f7f3; }\n" +
    "    .batch-index strong { display: block; margin-bottom: 8px; color: #292825; }\n" +
    "    .batch-index ol { margin: 0; padding-left: 22px; }\n" +
    "    p, ul, ol, blockquote, pre, table { margin: 0 0 20px; }\n" +
    "    .batch-document + .batch-document { break-before: page; }\n" +
    "    a { color: #28655f; }\n" +
    "    img { max-width: 100%; height: auto; }\n" +
    "    blockquote { border-left: 3px solid #9abdb4; padding-left: 16px; color: #6d716b; }\n" +
    "    code { padding: 2px 5px; background: #f0eee9; font-family: Consolas, monospace; font-size: .88em; }\n" +
    "    pre { overflow: auto; padding: 14px 16px; background: #f3f1ec; font-family: Consolas, monospace; font-size: .85em; line-height: 1.55; }\n" +
    "    table { width: 100%; border-collapse: collapse; }\n" +
    "    th, td { border: 1px solid #d9d5cc; padding: 7px 9px; text-align: left; }\n" +
    "    th { background: #f0eee9; }\n" +
    "  </style>\n" +
    "</head>\n" +
    "<body>\n" +
    '  <header class="export-header"><div class="export-kicker">MOYANG READER · EXPORT</div><h1>' +
    escapeHtml(title) +
    "</h1></header>\n" +
    tocMarkup +
    '  <main class="reader-content">' +
    normalizeExportLinks(body) +
    '</main><footer class="export-footer">由 Moyang Reader 导出</footer>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

export type HtmlExportDocument = {
  title: string;
  body: string;
};

export function buildBatchHtmlExport(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
): string {
  const index = documents
    .map((document, index) => `<li><a href="#moyang-document-${index}">${escapeHtml(document.title)}</a></li>`)
    .join("");
  const content = [
    `<nav class="batch-index"><strong>文档目录</strong><ol>${index}</ol></nav>`,
    ...documents.map(
      (document, index) =>
        `<section id="moyang-document-${index}" class="batch-document"><h1>${escapeHtml(document.title)}</h1>${document.body}</section>`,
    ),
  ].join("\n");

  return buildHtmlExport(title, content, options);
}

export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.title = "Moyang Reader 打印预览";
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(frame);

    let triggered = false;
    let cleanupTimer: number | null = null;
    const cleanup = () => {
      if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
      frame.remove();
    };
    const fail = (cause: unknown) => {
      cleanup();
      reject(cause instanceof Error ? cause : new Error("无法打开打印预览。"));
    };
    const triggerPrint = () => {
      if (triggered) return;
      triggered = true;

      const printWindow = frame.contentWindow;
      if (!printWindow) {
        fail(new Error("无法创建打印预览窗口。"));
        return;
      }

      printWindow.addEventListener("afterprint", cleanup, { once: true });
      try {
        printWindow.focus();
        printWindow.print();
        cleanupTimer = window.setTimeout(cleanup, 60_000);
        resolve();
      } catch (cause) {
        fail(cause);
      }
    };

    frame.onload = () => window.setTimeout(triggerPrint, 0);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      fail(new Error("无法创建打印预览文档。"));
      return;
    }
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
    window.setTimeout(triggerPrint, 120);
  });
}

type DocxImage = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  relationshipId: string;
};

type DocxLink = {
  relationshipId: string;
  target: string;
};

type DocxRenderState = {
  images: DocxImage[];
  nextImageId: number;
  links: DocxLink[];
  nextLinkId: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function runXml(value: string, properties = ""): string {
  if (!value) return "";
  const content = value
    .split(/\r?\n/)
    .map((line, index) => `${index > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`)
    .join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}${content}</w:r>`;
}

function imageExtension(contentType: string): string | null {
  return DOCX_IMAGE_EXTENSIONS[contentType] ?? null;
}

function imageXml(element: HTMLElement, state: DocxRenderState): string {
  const source = element.getAttribute("src") ?? "";
  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  const extension = match ? imageExtension(match[1].toLowerCase()) : null;
  if (!match || !extension) {
    return runXml(`[图片${element.getAttribute("alt") ? `：${element.getAttribute("alt")}` : ""}]`);
  }

  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const contentType = match[1].toLowerCase();
    const relationshipId = `rId${state.nextImageId}`;
    state.nextImageId += 1;
    state.images.push({
      bytes,
      contentType,
      extension,
      relationshipId,
    });

    const imageId = state.images.length;
    const dimensions = readImageDimensions(bytes, contentType);
    const { cx, cy } = calculateDocxImageExtent(dimensions);
    const alt = element.getAttribute("alt") ?? "";
    const description = alt ? ` descr="${escapeXml(alt)}"` : "";
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imageId}" name="图片 ${imageId}"${description}/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${imageId}" name="图片 ${imageId}"${description}/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  } catch {
    return runXml("[图片无法读取]");
  }
}

function isExternalDocxLink(value: string): boolean {
  if (/^(?:https?:\/\/|mailto:|tel:|file:)/i.test(value)) return true;
  return Boolean(value && !value.startsWith("#") && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
}

function inlineXml(node: Node, state: DocxRenderState, inheritedProperties = ""): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return runXml(node.nodeValue ?? "", inheritedProperties);
  }
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "<w:r><w:br/></w:r>";
  if (tag === "img") return imageXml(node, state);

  let properties = inheritedProperties;
  if (tag === "strong" || tag === "b") properties += "<w:b/>";
  if (tag === "em" || tag === "i") properties += "<w:i/>";
  if (tag === "u") properties += '<w:u w:val="single"/>';
  if (tag === "code" || tag === "kbd")
    properties += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F0EEE9"/>';
  if (tag === "a") properties += '<w:color w:val="28655F"/><w:u w:val="single"/>';

  if (tag === "a") {
    const content = Array.from(node.childNodes)
      .map((child) => inlineXml(child, state, properties))
      .join("");
    const target = node.getAttribute("href") ?? "";
    if (!isExternalDocxLink(target)) return content;

    const relationshipId = `rIdLink${state.nextLinkId}`;
    state.nextLinkId += 1;
    state.links.push({ relationshipId, target });
    return `<w:hyperlink r:id="${relationshipId}">${content}</w:hyperlink>`;
  }

  return Array.from(node.childNodes)
    .map((child) => inlineXml(child, state, properties))
    .join("");
}

function paragraphXml(content: string, style?: string, extraProperties = ""): string {
  const properties =
    style || extraProperties ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extraProperties}</w:pPr>` : "";
  return `<w:p>${properties}${content || "<w:r><w:t></w:t></w:r>"}</w:p>`;
}

function tableXml(table: HTMLElement, state: DocxRenderState): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  const columnCount = Math.max(1, ...rows.map((row) => row.querySelectorAll(":scope > th, :scope > td").length));
  const grid = Array.from({ length: columnCount }, () => '<w:gridCol w:w="2200"/>').join("");
  const body = rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td"));
      return `<w:tr>${cells
        .map((cell) => {
          const isHeader = cell.tagName.toLowerCase() === "th";
          const content = Array.from(cell.childNodes)
            .map((child) => inlineXml(child, state, isHeader ? "<w:b/>" : ""))
            .join("");
          return `<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr>${paragraphXml(content)}</w:tc>`;
        })
        .join("")}</w:tr>`;
    })
    .join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D5CC"/><w:left w:val="single" w:sz="4" w:color="D9D5CC"/><w:bottom w:val="single" w:sz="4" w:color="D9D5CC"/><w:right w:val="single" w:sz="4" w:color="D9D5CC"/><w:insideH w:val="single" w:sz="4" w:color="D9D5CC"/><w:insideV w:val="single" w:sz="4" w:color="D9D5CC"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function blockXml(node: Node, state: DocxRenderState, listDepth = 0): string {
  if (!(node instanceof HTMLElement)) {
    return node.nodeType === Node.TEXT_NODE && node.textContent?.trim() ? paragraphXml(runXml(node.textContent)) : "";
  }

  const tag = node.tagName.toLowerCase();
  const pageBreakPrefix = node.dataset.pageBreak === "true" ? paragraphXml("", "Normal", "<w:pageBreakBefore/>") : "";
  if (tag === "table") return pageBreakPrefix + tableXml(node, state);
  if (tag === "ul" || tag === "ol") {
    return (
      pageBreakPrefix +
      Array.from(node.children)
        .map((child) => blockXml(child, state, listDepth))
        .join("")
    );
  }
  if (tag === "li") {
    const parentTag = node.parentElement?.tagName.toLowerCase();
    const orderedIndex =
      parentTag === "ol" && node.parentElement
        ? Array.from(node.parentElement.children)
            .filter((child) => child.tagName.toLowerCase() === "li")
            .indexOf(node) + 1
        : 0;
    const content = Array.from(node.childNodes)
      .filter((child) => !(child instanceof HTMLElement && ["ul", "ol"].includes(child.tagName.toLowerCase())))
      .map((child) => inlineXml(child, state))
      .join("");
    const nested = Array.from(node.children)
      .filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()))
      .map((child) => blockXml(child, state, listDepth + 1))
      .join("");
    const listIndent = listDepth > 0 ? `<w:ind w:left="${listDepth * 720}" w:hanging="360"/>` : "";
    return (
      pageBreakPrefix +
      paragraphXml(runXml(parentTag === "ol" ? `${orderedIndex}. ` : "• ") + content, "Normal", listIndent) +
      nested
    );
  }
  if (/^h[1-6]$/.test(tag)) {
    return (
      pageBreakPrefix +
      paragraphXml(
        Array.from(node.childNodes)
          .map((child) => inlineXml(child, state))
          .join(""),
        `Heading${tag.slice(1)}`,
      )
    );
  }
  if (tag === "pre") {
    return (
      pageBreakPrefix +
      paragraphXml(
        inlineXml(node, state, '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>'),
        "CodeBlock",
      )
    );
  }
  if (tag === "blockquote") {
    return (
      pageBreakPrefix +
      paragraphXml(
        Array.from(node.childNodes)
          .map((child) => inlineXml(child, state, "<w:i/>"))
          .join(""),
        "Quote",
      )
    );
  }
  if (tag === "hr") {
    return (
      pageBreakPrefix +
      paragraphXml("", "Normal", '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="D9D5CC"/></w:pBdr>')
    );
  }
  if (tag === "img") return pageBreakPrefix + paragraphXml(imageXml(node, state));

  const blockChildren = Array.from(node.children).filter((child) =>
    /^(p|div|section|article|h[1-6]|ul|ol|table|blockquote|pre|hr)$/i.test(child.tagName),
  );
  if (blockChildren.length > 0) return pageBreakPrefix + blockChildren.map((child) => blockXml(child, state)).join("");
  return (
    pageBreakPrefix +
    paragraphXml(
      Array.from(node.childNodes)
        .map((child) => inlineXml(child, state))
        .join(""),
    )
  );
}

function docxStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="等线"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="6D716B"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style></w:styles>`;
}

function docxHeaderXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="6" w:color="D9D5CC"/></w:pBdr></w:pPr><w:r><w:rPr><w:color w:val="8A8982"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Moyang Reader · ${escapeXml(title)}</w:t></w:r></w:p></w:hdr>`;
}

function docxFooterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="8A8982"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">由 Moyang Reader 导出 · 第 </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:color w:val="8A8982"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:color w:val="8A8982"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:rPr><w:color w:val="8A8982"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
}

function docxDocumentXml(title: string, body: string, state: DocxRenderState, options: ExportOptions): string {
  const parsed = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  const content = root
    ? Array.from(root.childNodes)
        .map((node) => blockXml(node, state))
        .join("")
    : "";
  const titleParagraph = paragraphXml(runXml(title), "Title");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${titleParagraph}${content}<w:sectPr>${docxPageLayoutXml(options)}</w:sectPr></w:body></w:document>`;
}

function docxContentTypesXml(images: DocxImage[]): string {
  const imageTypes = Array.from(new Map(images.map((image) => [image.extension, image.contentType])))
    .map(([extension, contentType]) => `<Default Extension="${extension}" ContentType="${contentType}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageTypes}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function docxRelationshipsXml(images: DocxImage[], links: DocxLink[]): string {
  const relationships = [
    '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
    '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
    ...images.map(
      (image, index) =>
        `<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${index + 1}.${image.extension}"/>`,
    ),
    ...links.map(
      (link) =>
        `<Relationship Id="${link.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`,
    ),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

export async function buildDocxExport(
  title: string,
  body: string,
  options: ExportOptions = defaultExportOptions,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const state: DocxRenderState = { images: [], links: [], nextImageId: 1, nextLinkId: 1 };
  const normalizedBody = await normalizeDocxImageSources(normalizeExportLinks(body), signal);
  throwIfExportAborted(signal);
  const zip = new JSZip();
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  zip.file("word/document.xml", docxDocumentXml(title, normalizedBody, state, options));
  zip.file("word/styles.xml", docxStylesXml());
  zip.file("word/header1.xml", docxHeaderXml(title));
  zip.file("word/footer1.xml", docxFooterXml());
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Moyang Reader</dc:creator></cp:coreProperties>`,
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Moyang Reader</Application></Properties>`,
  );

  // The document XML is built before the content types and relationships are finalized.
  zip.file("[Content_Types].xml", docxContentTypesXml(state.images));
  zip.file("word/_rels/document.xml.rels", docxRelationshipsXml(state.images, state.links));
  state.images.forEach((image, index) => zip.file(`word/media/image${index + 1}.${image.extension}`, image.bytes));
  return zip.generateAsync(
    {
      type: "uint8array",
      compression: "DEFLATE",
      streamFiles: true,
    },
    () => throwIfExportAborted(signal),
  );
}

export async function buildBatchDocxExport(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const sections: string[] = [];
  for (const [index, document] of documents.entries()) {
    throwIfExportAborted(signal);
    sections.push(
      `<section data-page-break="${index > 0 ? "true" : "false"}"><h1>${escapeHtml(document.title)}</h1>${document.body}</section>`,
    );
  }

  return buildDocxExport(title, sections.join(""), options, signal);
}
