import { escapeHtml } from "../lib/text";
import type { ExportMargin, ExportOrientation, ExportPaper, TocItem, WorkspaceExportFailure } from "./types";
import type JSZip from "jszip";

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

export function pathWithExportTempSuffix(path: string, nonce: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const directory = separator >= 0 ? path.slice(0, separator + 1) : "";
  const name = separator >= 0 ? path.slice(separator + 1) : path;
  const baseName = name.replace(/\.[^./\\]+$/, "") || "moyang-reader";
  return `${directory}.${baseName}.moyang-export-part-${nonce}.tmp`;
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
export const BATCH_EXPORT_MAX_ESTIMATED_BYTES = 8 * 1024 * 1024;
const EXPORT_YIELD_INTERVAL = 4;
const EXPORT_STREAM_WRITE_CHUNK_BYTES = 256 * 1024;
const DOCX_TEXT_WRITE_CHUNK_CHARS = 16 * 1024;

export function shouldFlushBatchExport(documentCount: number, estimatedBytes: number): boolean {
  return documentCount >= BATCH_EXPORT_CHUNK_SIZE || estimatedBytes >= BATCH_EXPORT_MAX_ESTIMATED_BYTES;
}

export function yieldToExportScheduler(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof globalThis.setTimeout === "function") {
      globalThis.setTimeout(resolve, 0);
      return;
    }
    queueMicrotask(resolve);
  });
}

function mergeExportChunks(chunks: readonly Uint8Array[], byteLength: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const merged = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

type RawCompressionStream = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

type RawCompressionStreamConstructor = new (format: string) => RawCompressionStream;

function getRawCompressionStreamConstructor(): RawCompressionStreamConstructor | null {
  const candidate = (globalThis as typeof globalThis & { CompressionStream?: unknown }).CompressionStream;
  return typeof candidate === "function" ? (candidate as RawCompressionStreamConstructor) : null;
}

function supportsRawDeflate(): boolean {
  const constructor = getRawCompressionStreamConstructor();
  if (!constructor || typeof TextEncoder === "undefined") return false;

  try {
    new constructor("deflate-raw");
    return true;
  } catch {
    return false;
  }
}

class Crc32 {
  private value = 0xffffffff;

  update(bytes: Uint8Array): void {
    for (const byte of bytes) this.value = CRC32_TABLE[(this.value ^ byte) & 0xff] ^ (this.value >>> 8);
  }

  digest(): number {
    return (this.value ^ 0xffffffff) >>> 0;
  }
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

class ExportChunkSink {
  private pendingChunks: Uint8Array[] = [];
  private pendingBytes = 0;
  private writtenBytes = 0;

  constructor(
    private readonly writeChunk: (chunk: Uint8Array) => Promise<void>,
    private readonly signal?: AbortSignal,
  ) {}

  get position(): number {
    return this.writtenBytes + this.pendingBytes;
  }

  async write(chunk: Uint8Array): Promise<void> {
    throwIfExportAborted(this.signal);
    if (chunk.byteLength === 0) return;

    this.pendingChunks.push(chunk);
    this.pendingBytes += chunk.byteLength;
    if (this.pendingBytes >= EXPORT_STREAM_WRITE_CHUNK_BYTES) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.pendingBytes === 0) return;

    const chunks = this.pendingChunks;
    const byteLength = this.pendingBytes;
    this.pendingChunks = [];
    this.pendingBytes = 0;
    await this.writeChunk(mergeExportChunks(chunks, byteLength));
    this.writtenBytes += byteLength;
    throwIfExportAborted(this.signal);
  }
}

type ZipCompressionMethod = 0 | 8;

type ZipEntryRecord = {
  nameBytes: Uint8Array;
  method: ZipCompressionMethod;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
};

function setUint16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, true);
}

function setUint32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value >>> 0, true);
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

class StreamingZipEntry {
  private readonly crc32 = new Crc32();
  private uncompressedSize = 0;
  private compressedSize = 0;
  private closed = false;
  private compressionWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private compressionDrain: Promise<void> | null = null;

  private constructor(
    private readonly zip: StreamingZipWriter,
    private readonly nameBytes: Uint8Array,
    private readonly method: ZipCompressionMethod,
    private readonly offset: number,
  ) {}

  static async open(
    zip: StreamingZipWriter,
    name: string,
    method: ZipCompressionMethod,
    signal?: AbortSignal,
  ): Promise<StreamingZipEntry> {
    const nameBytes = utf8(name);
    const offset = zip.position;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    setUint32(localHeader, 0, 0x04034b50);
    setUint16(localHeader, 4, 20);
    setUint16(localHeader, 6, 0x0808);
    setUint16(localHeader, 8, method);
    setUint16(localHeader, 10, 0);
    setUint16(localHeader, 12, 0);
    setUint32(localHeader, 14, 0);
    setUint32(localHeader, 18, 0);
    setUint32(localHeader, 22, 0);
    setUint16(localHeader, 26, nameBytes.length);
    setUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    await zip.writeRaw(localHeader);

    const entry = new StreamingZipEntry(zip, nameBytes, method, offset);
    if (method === 8) {
      const constructor = getRawCompressionStreamConstructor();
      if (!constructor) throw new Error("DOCX_STREAMING_COMPRESSION_UNAVAILABLE");
      const compression = new constructor("deflate-raw");
      entry.compressionWriter = compression.writable.getWriter();
      const reader = compression.readable.getReader();
      entry.compressionDrain = (async () => {
        while (true) {
          throwIfExportAborted(signal);
          const result = await reader.read();
          if (result.done) return;
          const chunk = result.value;
          entry.compressedSize += chunk.byteLength;
          await zip.writeRaw(chunk);
        }
      })();
    }
    return entry;
  }

  async writeBytes(bytes: Uint8Array): Promise<void> {
    if (this.closed) throw new Error("DOCX_STREAMING_ENTRY_CLOSED");
    throwIfExportAborted(this.zip.signal);
    this.crc32.update(bytes);
    this.uncompressedSize += bytes.byteLength;

    if (this.compressionWriter) {
      await this.compressionWriter.write(bytes);
      return;
    }

    this.compressedSize += bytes.byteLength;
    await this.zip.writeRaw(bytes);
  }

  async writeText(value: string): Promise<void> {
    for (let offset = 0; offset < value.length;) {
      let end = Math.min(value.length, offset + DOCX_TEXT_WRITE_CHUNK_CHARS);
      const lastCodeUnit = value.charCodeAt(end - 1);
      if (end < value.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
      if (end <= offset) end = Math.min(value.length, offset + DOCX_TEXT_WRITE_CHUNK_CHARS);
      await this.writeBytes(utf8(value.slice(offset, end)));
      offset = end;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    try {
      if (this.compressionWriter) {
        await this.compressionWriter.close();
        await this.compressionDrain;
      }
      const descriptor = new Uint8Array(16);
      setUint32(descriptor, 0, 0x08074b50);
      setUint32(descriptor, 4, this.crc32.digest());
      setUint32(descriptor, 8, this.compressedSize);
      setUint32(descriptor, 12, this.uncompressedSize);
      await this.zip.writeRaw(descriptor);
      this.closed = true;
      this.zip.record({
        nameBytes: this.nameBytes,
        method: this.method,
        crc: this.crc32.digest(),
        compressedSize: this.compressedSize,
        uncompressedSize: this.uncompressedSize,
        offset: this.offset,
      });
    } catch (cause) {
      await this.abort(cause);
      throw cause;
    }
  }

  async abort(cause: unknown): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.compressionWriter?.abort(cause);
    } catch {
      // The temporary export file is discarded by the caller after this boundary.
    }
  }
}

class StreamingZipWriter {
  private readonly entries: ZipEntryRecord[] = [];

  constructor(
    private readonly sink: ExportChunkSink,
    readonly signal?: AbortSignal,
  ) {}

  get position(): number {
    return this.sink.position;
  }

  async writeRaw(chunk: Uint8Array): Promise<void> {
    await this.sink.write(chunk);
  }

  record(entry: ZipEntryRecord): void {
    this.entries.push(entry);
  }

  async openEntry(name: string, method: ZipCompressionMethod): Promise<StreamingZipEntry> {
    throwIfExportAborted(this.signal);
    return StreamingZipEntry.open(this, name, method, this.signal);
  }

  async close(): Promise<void> {
    throwIfExportAborted(this.signal);
    const centralDirectoryOffset = this.position;
    for (const entry of this.entries) {
      const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
      setUint32(centralHeader, 0, 0x02014b50);
      setUint16(centralHeader, 4, 20);
      setUint16(centralHeader, 6, 20);
      setUint16(centralHeader, 8, 0x0808);
      setUint16(centralHeader, 10, entry.method);
      setUint16(centralHeader, 12, 0);
      setUint16(centralHeader, 14, 0);
      setUint32(centralHeader, 16, entry.crc);
      setUint32(centralHeader, 20, entry.compressedSize);
      setUint32(centralHeader, 24, entry.uncompressedSize);
      setUint16(centralHeader, 28, entry.nameBytes.length);
      setUint16(centralHeader, 30, 0);
      setUint16(centralHeader, 32, 0);
      setUint16(centralHeader, 34, 0);
      setUint16(centralHeader, 36, 0);
      setUint32(centralHeader, 38, 0);
      setUint32(centralHeader, 42, entry.offset);
      centralHeader.set(entry.nameBytes, 46);
      await this.writeRaw(centralHeader);
    }

    const centralDirectorySize = this.position - centralDirectoryOffset;
    const endRecord = new Uint8Array(22);
    setUint32(endRecord, 0, 0x06054b50);
    setUint16(endRecord, 4, 0);
    setUint16(endRecord, 6, 0);
    setUint16(endRecord, 8, this.entries.length);
    setUint16(endRecord, 10, this.entries.length);
    setUint32(endRecord, 12, centralDirectorySize);
    setUint32(endRecord, 16, centralDirectoryOffset);
    setUint16(endRecord, 20, 0);
    await this.writeRaw(endRecord);
    await this.sink.flush();
  }
}

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
  for (const [index, element] of images.entries()) {
    throwIfExportAborted(signal);
    const source = element.getAttribute("src") ?? "";
    const image = parseDataImage(source);
    if (image && ["image/avif", "image/webp"].includes(image.contentType)) {
      const converted = await rasterizeDocxImage(source, image);
      if (converted) element.setAttribute("src", converted);
    }
    if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }

  return root.innerHTML;
}

export async function inlineLocalImages(
  html: string,
  resolveLocalPath: (source: string) => string | null,
  readBinary: (path: string) => Promise<Uint8Array>,
  mimeTypeForPath: (path: string) => string,
  getSize?: (path: string) => Promise<number>,
  signal?: AbortSignal,
): Promise<string> {
  const sources = Array.from(html.matchAll(/\bsrc="([^"]+)"/g), (match) => match[1]);
  const replacements = new Map<string, string>();

  const uniqueSources = Array.from(new Set(sources));
  for (const [index, source] of uniqueSources.entries()) {
    throwIfExportAborted(signal);
    const localPath = resolveLocalPath(source);
    if (localPath) {
      try {
        if (!getSize || (await getSize(localPath)) <= MAX_INLINE_IMAGE_BYTES) {
          const bytes = await readBinary(localPath);
          if (bytes.length <= MAX_INLINE_IMAGE_BYTES) {
            replacements.set(source, `data:${mimeTypeForPath(localPath)};base64,${bytesToBase64(bytes)}`);
          }
        }
      } catch {
        // Keep an unreadable local image as a relative link so export still succeeds.
      }
    }
    if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }
  throwIfExportAborted(signal);

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

export function formatExportFailureReport(failures: readonly WorkspaceExportFailure[]): string {
  return [
    "Moyang Reader 导出失败清单",
    "",
    ...failures.map((failure, index) => `${index + 1}. ${failure.fileName}：${failure.reason}`),
    "",
    "原文未被修改；请确认文件仍存在、格式受支持且未被其他程序占用。",
  ].join("\n");
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
    '    h1, h2, h3, h4, h5, h6 { color: #292825; font-family: Georgia, "Songti SC", "STSong", serif; font-weight: 500; line-height: 1.25; }\n' +
    "    h1 { margin: 0 0 30px; font-size: 42px; }\n" +
    "    h2 { margin: 50px 0 16px; font-size: 29px; }\n" +
    "    h3 { margin: 35px 0 12px; font-size: 23px; }\n" +
    "    h4 { margin: 28px 0 10px; font-size: 19px; }\n" +
    "    h5 { margin: 24px 0 8px; font-size: 17px; }\n" +
    "    h6 { margin: 20px 0 8px; color: #6d716b; font-size: 15px; font-weight: 600; letter-spacing: .02em; }\n" +
    "    .export-header { margin: 0 0 42px; padding: 0 0 18px; border-bottom: 1px solid #d9d5cc; break-after: avoid; }\n" +
    "    .export-kicker { margin-bottom: 8px; color: #6d716b; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: .12em; }\n" +
    "    .export-header h1 { margin: 0; font-size: 38px; }\n" +
    "    .export-footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #d9d5cc; color: #8a8982; font-family: Arial, sans-serif; font-size: 11px; }\n" +
    "    .export-page-number::after { content: counter(page); }\n" +
    "    @media print { .export-footer { position: fixed; right: 0; bottom: 0; left: 0; margin: 0; padding: 6px 0; border-top: 1px solid #d9d5cc; background: #fff; text-align: center; } }\n" +
    "    .export-toc { margin: 0 0 42px; padding: 16px 20px; border: 1px solid #d9d5cc; background: #f8f7f3; break-inside: avoid; }\n" +
    "    .export-toc strong { display: block; margin-bottom: 8px; color: #292825; }\n" +
    "    .export-toc ol { margin: 0; padding-left: 22px; }\n" +
    "    .export-toc li { margin: 3px 0; }\n" +
    "    .export-toc a { color: #28655f; text-decoration: none; }\n" +
    "    .batch-index { margin: 0 0 42px; padding: 16px 20px; border: 1px solid #d9d5cc; background: #f8f7f3; }\n" +
    "    .batch-index strong { display: block; margin-bottom: 8px; color: #292825; }\n" +
    "    .batch-index ol { margin: 0; padding-left: 22px; }\n" +
    "    p, ul, ol, blockquote, pre, table { margin: 0 0 20px; }\n" +
    "    ul, ol { padding-left: 1.75em; }\n" +
    "    li { margin: .35em 0; padding-left: .15em; }\n" +
    "    li > ul, li > ol { margin-top: .35em; margin-bottom: .35em; }\n" +
    "    li > p:not(:last-child) { margin-bottom: .45em; }\n" +
    "    li > p:last-child { margin-bottom: 0; }\n" +
    "    li::marker { color: #28655f; }\n" +
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
    '</main><footer class="export-footer">由 Moyang Reader 导出 · 第 <span class="export-page-number"></span> 页</footer>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

export type HtmlExportDocument = {
  title: string;
  body: string;
};

export function estimateBatchExportDocumentBytes(document: HtmlExportDocument): number {
  return (document.title.length + document.body.length) * 2;
}

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
  imageFingerprints: Map<string, number[]>;
  nextImageId: number;
  nextDrawingId: number;
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

function* docxRunXmlParts(value: string, properties = ""): Generator<string> {
  if (!value) return;
  yield `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}`;
  for (const [index, line] of value.split(/\r?\n/).entries()) {
    if (index > 0) yield "<w:br/>";
    if (!line) {
      yield '<w:t xml:space="preserve"></w:t>';
      continue;
    }

    for (let offset = 0; offset < line.length;) {
      let end = Math.min(line.length, offset + DOCX_TEXT_WRITE_CHUNK_CHARS);
      const lastCodeUnit = line.charCodeAt(end - 1);
      if (end < line.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
      if (end <= offset) end = Math.min(line.length, offset + DOCX_TEXT_WRITE_CHUNK_CHARS);
      yield `<w:t xml:space="preserve">${escapeXml(line.slice(offset, end))}</w:t>`;
      offset = end;
    }
  }
  yield "</w:r>";
}

function runXml(value: string, properties = ""): string {
  return Array.from(docxRunXmlParts(value, properties)).join("");
}

function imageExtension(contentType: string): string | null {
  return DOCX_IMAGE_EXTENSIONS[contentType] ?? null;
}

function isElementNode(node: Node): node is Element {
  return node.nodeType === 1;
}

function imageFingerprint(contentType: string, bytes: Uint8Array): string {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 16777619);
    second = Math.imul(second ^ byte, 2246822519);
  }
  return `${contentType}:${bytes.length}:${first >>> 0}:${second >>> 0}`;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function imageXml(element: Element, state: DocxRenderState): string {
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
    const fingerprint = imageFingerprint(contentType, bytes);
    const candidates = state.imageFingerprints.get(fingerprint) ?? [];
    let imageIndex = candidates.find((candidateIndex) => {
      const candidate = state.images[candidateIndex];
      return candidate?.contentType === contentType && sameBytes(candidate.bytes, bytes);
    });
    if (imageIndex === undefined) {
      imageIndex = state.images.length;
      state.images.push({
        bytes,
        contentType,
        extension,
        relationshipId: `rId${state.nextImageId}`,
      });
      state.nextImageId += 1;
      candidates.push(imageIndex);
      state.imageFingerprints.set(fingerprint, candidates);
    }

    const image = state.images[imageIndex];
    const imageId = state.nextDrawingId;
    state.nextDrawingId += 1;
    const dimensions = readImageDimensions(bytes, contentType);
    const { cx, cy } = calculateDocxImageExtent(dimensions);
    const alt = element.getAttribute("alt") ?? "";
    const description = alt ? ` descr="${escapeXml(alt)}"` : "";
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imageId}" name="图片 ${imageId}"${description}/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${imageId}" name="图片 ${imageId}"${description}/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  } catch {
    return runXml("[图片无法读取]");
  }
}

function isExternalDocxLink(value: string): boolean {
  if (/^(?:https?:\/\/|mailto:|tel:|file:)/i.test(value)) return true;
  return Boolean(value && !value.startsWith("#") && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
}

function inlineXml(node: Node, state: DocxRenderState, inheritedProperties = ""): string {
  if (node.nodeType === 3) {
    return runXml(node.nodeValue ?? "", inheritedProperties);
  }
  if (!isElementNode(node)) return "";

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

function tableXml(table: Element, state: DocxRenderState): string {
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
  if (!isElementNode(node)) {
    return node.nodeType === 3 && node.textContent?.trim() ? paragraphXml(runXml(node.textContent)) : "";
  }

  const tag = node.tagName.toLowerCase();
  const pageBreakPrefix =
    node.getAttribute("data-page-break") === "true" ? paragraphXml("", "Normal", "<w:pageBreakBefore/>") : "";
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
      .filter((child) => !(isElementNode(child) && ["ul", "ol"].includes(child.tagName.toLowerCase())))
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

type DocxInlineWriter = (value: string) => Promise<void>;

async function streamDocxRun(value: string, properties: string, writeText: DocxInlineWriter): Promise<boolean> {
  let written = false;
  for (const part of docxRunXmlParts(value, properties)) {
    await writeText(part);
    written = true;
  }
  return written;
}

async function streamInlineXml(
  node: Node,
  state: DocxRenderState,
  writeText: DocxInlineWriter,
  inheritedProperties = "",
  signal?: AbortSignal,
): Promise<boolean> {
  throwIfExportAborted(signal);
  if (node.nodeType === 3) return streamDocxRun(node.nodeValue ?? "", inheritedProperties, writeText);
  if (!isElementNode(node)) return false;

  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    await writeText("<w:r><w:br/></w:r>");
    return true;
  }
  if (tag === "img") {
    await writeText(imageXml(node, state));
    return true;
  }

  let properties = inheritedProperties;
  if (tag === "strong" || tag === "b") properties += "<w:b/>";
  if (tag === "em" || tag === "i") properties += "<w:i/>";
  if (tag === "u") properties += '<w:u w:val="single"/>';
  if (tag === "code" || tag === "kbd")
    properties += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F0EEE9"/>';
  if (tag === "a") properties += '<w:color w:val="28655F"/><w:u w:val="single"/>';

  if (tag === "a") {
    const target = node.getAttribute("href") ?? "";
    if (!isExternalDocxLink(target)) {
      let written = false;
      for (const child of node.childNodes) {
        written = (await streamInlineXml(child, state, writeText, properties, signal)) || written;
      }
      return written;
    }

    const relationshipId = `rIdLink${state.nextLinkId}`;
    state.nextLinkId += 1;
    state.links.push({ relationshipId, target });
    await writeText(`<w:hyperlink r:id="${relationshipId}">`);
    for (const child of node.childNodes) {
      await streamInlineXml(child, state, writeText, properties, signal);
    }
    await writeText("</w:hyperlink>");
    return true;
  }

  let written = false;
  for (const child of node.childNodes) {
    written = (await streamInlineXml(child, state, writeText, properties, signal)) || written;
  }
  return written;
}

async function streamParagraphXml(
  children: Iterable<Node>,
  state: DocxRenderState,
  writeText: DocxInlineWriter,
  style?: string,
  extraProperties = "",
  leadingText?: string,
  signal?: AbortSignal,
  inheritedProperties = "",
): Promise<void> {
  const properties =
    style || extraProperties ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extraProperties}</w:pPr>` : "";
  await writeText(`<w:p>${properties}`);
  let written = false;
  if (leadingText) written = await streamDocxRun(leadingText, "", writeText);
  for (const child of children) {
    written = (await streamInlineXml(child, state, writeText, inheritedProperties, signal)) || written;
  }
  if (!written) await writeText("<w:r><w:t></w:t></w:r>");
  await writeText("</w:p>");
}

async function streamTableXml(
  table: Element,
  state: DocxRenderState,
  writeText: DocxInlineWriter,
  signal?: AbortSignal,
): Promise<void> {
  const rows = Array.from(table.querySelectorAll("tr"));
  const columnCount = Math.max(1, ...rows.map((row) => row.querySelectorAll(":scope > th, :scope > td").length));
  const grid = Array.from({ length: columnCount }, () => '<w:gridCol w:w="2200"/>').join("");
  await writeText(
    '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D5CC"/><w:left w:val="single" w:sz="4" w:color="D9D5CC"/><w:bottom w:val="single" w:sz="4" w:color="D9D5CC"/><w:right w:val="single" w:sz="4" w:color="D9D5CC"/><w:insideH w:val="single" w:sz="4" w:color="D9D5CC"/><w:insideV w:val="single" w:sz="4" w:color="D9D5CC"/></w:tblBorders></w:tblPr><w:tblGrid>' +
      grid +
      "</w:tblGrid>",
  );

  for (const [rowIndex, row] of rows.entries()) {
    throwIfExportAborted(signal);
    await writeText("<w:tr>");
    const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td"));
    for (const cell of cells) {
      throwIfExportAborted(signal);
      const isHeader = cell.tagName.toLowerCase() === "th";
      await writeText('<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr><w:p>');
      let written = false;
      for (const child of cell.childNodes) {
        written = (await streamInlineXml(child, state, writeText, isHeader ? "<w:b/>" : "", signal)) || written;
      }
      if (!written) await writeText("<w:r><w:t></w:t></w:r>");
      await writeText("</w:p></w:tc>");
    }
    await writeText("</w:tr>");
    if ((rowIndex + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }
  await writeText("</w:tbl>");
}

async function streamBlockXml(
  node: Node,
  state: DocxRenderState,
  writeText: DocxInlineWriter,
  listDepth = 0,
  signal?: AbortSignal,
): Promise<void> {
  throwIfExportAborted(signal);
  if (!isElementNode(node)) {
    if (node.nodeType === 3 && node.textContent?.trim()) {
      await streamParagraphXml([node], state, writeText, undefined, "", undefined, signal);
    }
    return;
  }

  const tag = node.tagName.toLowerCase();
  if (node.getAttribute("data-page-break") === "true") {
    await writeText(paragraphXml("", "Normal", "<w:pageBreakBefore/>"));
  }
  if (tag === "table") {
    await streamTableXml(node, state, writeText, signal);
    return;
  }
  if (tag === "ul" || tag === "ol") {
    for (const child of node.children) await streamBlockXml(child, state, writeText, listDepth, signal);
    return;
  }
  if (tag === "li") {
    const parentTag = node.parentElement?.tagName.toLowerCase();
    const orderedIndex =
      parentTag === "ol" && node.parentElement
        ? Array.from(node.parentElement.children)
            .filter((child) => child.tagName.toLowerCase() === "li")
            .indexOf(node) + 1
        : 0;
    const listIndent = listDepth > 0 ? `<w:ind w:left="${listDepth * 720}" w:hanging="360"/>` : "";
    await streamParagraphXml(
      Array.from(node.childNodes).filter(
        (child) => !(isElementNode(child) && ["ul", "ol"].includes(child.tagName.toLowerCase())),
      ),
      state,
      writeText,
      "Normal",
      listIndent,
      parentTag === "ol" ? `${orderedIndex}. ` : "• ",
      signal,
    );
    for (const child of node.children) {
      if (["ul", "ol"].includes(child.tagName.toLowerCase())) {
        await streamBlockXml(child, state, writeText, listDepth + 1, signal);
      }
    }
    return;
  }
  if (/^h[1-6]$/.test(tag)) {
    await streamParagraphXml(node.childNodes, state, writeText, `Heading${tag.slice(1)}`, "", undefined, signal);
    return;
  }
  if (tag === "pre") {
    await streamParagraphXml(
      node.childNodes,
      state,
      writeText,
      "CodeBlock",
      "",
      undefined,
      signal,
      '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>',
    );
    return;
  }
  if (tag === "blockquote") {
    await streamParagraphXml(node.childNodes, state, writeText, "Quote", "", undefined, signal, "<w:i/>");
    return;
  }
  if (tag === "hr") {
    await writeText(
      paragraphXml("", "Normal", '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="D9D5CC"/></w:pBdr>'),
    );
    return;
  }
  if (tag === "img") {
    await writeText("<w:p>");
    await writeText(imageXml(node, state));
    await writeText("</w:p>");
    return;
  }

  const blockChildren = Array.from(node.children).filter((child) =>
    /^(p|div|section|article|h[1-6]|ul|ol|table|blockquote|pre|hr)$/i.test(child.tagName),
  );
  if (blockChildren.length > 0) {
    for (const child of blockChildren) await streamBlockXml(child, state, writeText, 0, signal);
    return;
  }
  await streamParagraphXml(node.childNodes, state, writeText, undefined, "", undefined, signal);
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

async function docxBodyXml(body: string, state: DocxRenderState, signal?: AbortSignal): Promise<string> {
  const parsed = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";

  const content: string[] = [];
  for (const [index, node] of Array.from(root.childNodes).entries()) {
    throwIfExportAborted(signal);
    content.push(blockXml(node, state));
    if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }
  return content.join("");
}

async function streamDocxBodyXml(
  body: string,
  state: DocxRenderState,
  writeText: DocxInlineWriter,
  signal?: AbortSignal,
): Promise<void> {
  const parsed = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return;

  for (const [index, node] of Array.from(root.childNodes).entries()) {
    throwIfExportAborted(signal);
    await streamBlockXml(node, state, writeText, 0, signal);
    if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }
}

function docxDocumentXmlPrefix(title: string): string {
  const titleParagraph = paragraphXml(runXml(title), "Title");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${titleParagraph}`;
}

function docxDocumentXmlSuffix(options: ExportOptions): string {
  return `<w:sectPr>${docxPageLayoutXml(options)}</w:sectPr></w:body></w:document>`;
}

function docxDocumentXml(title: string, content: string, options: ExportOptions): string {
  return docxDocumentXmlPrefix(title) + content + docxDocumentXmlSuffix(options);
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

function docxPackageRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function docxCorePropertiesXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Moyang Reader</dc:creator></cp:coreProperties>`;
}

function docxAppPropertiesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Moyang Reader</Application></Properties>`;
}

export async function buildDocxExport(
  title: string,
  body: string,
  options: ExportOptions = defaultExportOptions,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const state: DocxRenderState = {
    images: [],
    imageFingerprints: new Map(),
    nextImageId: 1,
    nextDrawingId: 1,
    links: [],
    nextLinkId: 1,
  };
  const normalizedBody = await normalizeDocxImageSources(normalizeExportLinks(body), signal);
  throwIfExportAborted(signal);
  const content = await docxBodyXml(normalizedBody, state, signal);
  const zip = await createDocxArchive(title, content, options, state, signal);
  return zip.generateAsync(
    {
      type: "uint8array",
      compression: "DEFLATE",
      streamFiles: true,
    },
    () => throwIfExportAborted(signal),
  );
}

async function createDocxArchive(
  title: string,
  content: string,
  options: ExportOptions,
  state: DocxRenderState,
  signal?: AbortSignal,
): Promise<JSZip> {
  const { default: JSZipConstructor } = await import("jszip");
  throwIfExportAborted(signal);
  const zip = new JSZipConstructor();
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  zip.file("word/document.xml", docxDocumentXml(title, content, options));
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
  return zip;
}

async function prepareBatchDocxArchive(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  signal?: AbortSignal,
): Promise<JSZip> {
  const state: DocxRenderState = {
    images: [],
    imageFingerprints: new Map(),
    nextImageId: 1,
    nextDrawingId: 1,
    links: [],
    nextLinkId: 1,
  };
  let content = "";
  for (const [index, document] of documents.entries()) {
    throwIfExportAborted(signal);
    const normalizedBody = await normalizeDocxImageSources(normalizeExportLinks(document.body), signal);
    const pageBreak = index > 0 ? paragraphXml("", "Normal", "<w:pageBreakBefore/>") : "";
    content += `${pageBreak}${paragraphXml(runXml(document.title), "Heading1")}${await docxBodyXml(normalizedBody, state, signal)}`;
    if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }

  throwIfExportAborted(signal);
  return createDocxArchive(title, content, options, state, signal);
}

export async function buildBatchDocxExport(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const zip = await prepareBatchDocxArchive(title, documents, options, signal);
  return zip.generateAsync(
    {
      type: "uint8array",
      compression: "DEFLATE",
      streamFiles: true,
    },
    () => throwIfExportAborted(signal),
  );
}

async function streamDocxExportWithJsZip(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  writeChunk: (chunk: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const zip = await prepareBatchDocxArchive(title, documents, options, signal);
  const stream = zip.generateInternalStream<"uint8array">({
    type: "uint8array",
    compression: "DEFLATE",
    streamFiles: true,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let writing = false;
    let abortRequested = false;
    let endReceived = false;
    let pendingChunks: Uint8Array[] = [];
    let pendingBytes = 0;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const finish = () => {
      if (settled) return;
      settled = true;
      pendingChunks = [];
      pendingBytes = 0;
      cleanup();
      resolve();
    };
    const fail = (cause: unknown) => {
      if (settled) return;
      settled = true;
      stream.pause();
      pendingChunks = [];
      pendingBytes = 0;
      cleanup();
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    };
    const onAbort = () => {
      abortRequested = true;
      stream.pause();
      if (!writing) fail(new Error("EXPORT_CANCELLED"));
    };
    const flushPending = async () => {
      if (writing || pendingBytes === 0 || settled) return;
      writing = true;
      const chunks = pendingChunks;
      const byteLength = pendingBytes;
      pendingChunks = [];
      pendingBytes = 0;
      try {
        throwIfExportAborted(signal);
        await writeChunk(mergeExportChunks(chunks, byteLength));
        writing = false;
        if (abortRequested || signal?.aborted) {
          fail(new Error("EXPORT_CANCELLED"));
          return;
        }
        if (settled) return;
        if (endReceived) finish();
        else stream.resume();
      } catch (cause) {
        writing = false;
        fail(abortRequested || signal?.aborted ? new Error("EXPORT_CANCELLED") : cause);
      }
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    stream
      .on("data", (chunk) => {
        if (settled) return;
        stream.pause();
        try {
          throwIfExportAborted(signal);
        } catch (cause) {
          fail(cause);
          return;
        }
        pendingChunks.push(chunk);
        pendingBytes += chunk.length;
        if (pendingBytes >= EXPORT_STREAM_WRITE_CHUNK_BYTES) {
          void flushPending();
        } else {
          stream.resume();
        }
      })
      .on("end", () => {
        endReceived = true;
        if (pendingBytes > 0) void flushPending();
        else finish();
      })
      .on("error", fail);

    try {
      throwIfExportAborted(signal);
      stream.resume();
    } catch (cause) {
      fail(cause);
    }
  });
}

async function writeStreamingDocxEntry(
  zip: StreamingZipWriter,
  name: string,
  content: string | Uint8Array,
  method: ZipCompressionMethod,
  signal?: AbortSignal,
): Promise<void> {
  const entry = await zip.openEntry(name, method);
  try {
    if (typeof content === "string") await entry.writeText(content);
    else await entry.writeBytes(content);
    await entry.close();
  } catch (cause) {
    await entry.abort(cause);
    throw cause;
  }
  throwIfExportAborted(signal);
}

async function streamDocxExportIncremental(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions,
  writeChunk: (chunk: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const sink = new ExportChunkSink(writeChunk, signal);
  const zip = new StreamingZipWriter(sink, signal);
  const state: DocxRenderState = {
    images: [],
    imageFingerprints: new Map(),
    nextImageId: 1,
    nextDrawingId: 1,
    links: [],
    nextLinkId: 1,
  };
  let documentEntry: StreamingZipEntry | null = null;

  try {
    documentEntry = await zip.openEntry("word/document.xml", 8);
    await documentEntry.writeText(docxDocumentXmlPrefix(title));
    for (const [index, document] of documents.entries()) {
      throwIfExportAborted(signal);
      const normalizedBody = await normalizeDocxImageSources(normalizeExportLinks(document.body), signal);
      const pageBreak = index > 0 ? paragraphXml("", "Normal", "<w:pageBreakBefore/>") : "";
      await documentEntry.writeText(`${pageBreak}${paragraphXml(runXml(document.title), "Heading1")}`);
      await streamDocxBodyXml(normalizedBody, state, (value) => documentEntry!.writeText(value), signal);
      if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
    }
    await documentEntry.writeText(docxDocumentXmlSuffix(options));
    await documentEntry.close();
    documentEntry = null;

    await writeStreamingDocxEntry(zip, "_rels/.rels", docxPackageRelationshipsXml(), 8, signal);
    await writeStreamingDocxEntry(zip, "word/styles.xml", docxStylesXml(), 8, signal);
    await writeStreamingDocxEntry(zip, "word/header1.xml", docxHeaderXml(title), 8, signal);
    await writeStreamingDocxEntry(zip, "word/footer1.xml", docxFooterXml(), 8, signal);
    await writeStreamingDocxEntry(zip, "docProps/core.xml", docxCorePropertiesXml(title), 8, signal);
    await writeStreamingDocxEntry(zip, "docProps/app.xml", docxAppPropertiesXml(), 8, signal);
    await writeStreamingDocxEntry(zip, "[Content_Types].xml", docxContentTypesXml(state.images), 8, signal);
    await writeStreamingDocxEntry(
      zip,
      "word/_rels/document.xml.rels",
      docxRelationshipsXml(state.images, state.links),
      8,
      signal,
    );

    for (const [index, image] of state.images.entries()) {
      throwIfExportAborted(signal);
      await writeStreamingDocxEntry(zip, `word/media/image${index + 1}.${image.extension}`, image.bytes, 0, signal);
    }
    await zip.close();
  } catch (cause) {
    await documentEntry?.abort(cause);
    throw cause;
  }
}

export async function streamDocxExport(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  writeChunk: (chunk: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (!supportsRawDeflate()) {
    await streamDocxExportWithJsZip(title, documents, options, writeChunk, signal);
    return;
  }

  await streamDocxExportIncremental(title, documents, options, writeChunk, signal);
}

export async function buildBatchHtmlExportAsync(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  signal?: AbortSignal,
): Promise<string> {
  const index: string[] = [];
  const content: string[] = [];
  for (const [documentIndex, document] of documents.entries()) {
    throwIfExportAborted(signal);
    index.push(`<li><a href="#moyang-document-${documentIndex}">${escapeHtml(document.title)}</a></li>`);
    content.push(
      `<section id="moyang-document-${documentIndex}" class="batch-document"><h1>${escapeHtml(document.title)}</h1>${document.body}</section>`,
    );
    if ((documentIndex + 1) % EXPORT_YIELD_INTERVAL === 0) await yieldToExportScheduler();
  }

  throwIfExportAborted(signal);
  return buildHtmlExport(
    title,
    [`<nav class="batch-index"><strong>文档目录</strong><ol>${index.join("")}</ol></nav>`, ...content].join("\n"),
    options,
  );
}
