import { normalizePathKey } from "./path-key";

export const ANNOTATION_CONTEXT_CHARS = 80;
export const MAX_ANNOTATIONS = 2_000;
const MAX_ANNOTATION_TEXT_CHARS = 64 * 1024;
const MAX_ANNOTATION_NOTE_CHARS = 16 * 1024;

export type AnnotationSelection = {
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
};

export type TextAnnotation = AnnotationSelection & {
  id: string;
  path: string;
  /** Rust's optional note is serialized as null when no note is stored. */
  note?: string | null;
  createdAt: number;
  updatedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAnnotationText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeRelativePath(value: string): string | null {
  const path = value.trim().replace(/[\\/]+/g, "/");
  if (!path || path.startsWith("/") || /^[A-Za-z]:/.test(path)) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

function optionalNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const note = value.trim();
  return note && note.length <= MAX_ANNOTATION_NOTE_CHARS ? note : undefined;
}

function validOffset(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function normalizeAnnotation(value: unknown): TextAnnotation | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 128) return null;
  if (typeof value.path !== "string") return null;
  const path = normalizeRelativePath(value.path);
  const quote = typeof value.quote === "string" ? normalizeAnnotationText(value.quote) : "";
  const prefix = typeof value.prefix === "string" ? normalizeAnnotationText(value.prefix) : "";
  const suffix = typeof value.suffix === "string" ? normalizeAnnotationText(value.suffix) : "";
  if (!path || !quote || quote.length > MAX_ANNOTATION_TEXT_CHARS) return null;
  if (prefix.length > ANNOTATION_CONTEXT_CHARS || suffix.length > ANNOTATION_CONTEXT_CHARS) return null;
  if (!validOffset(value.start) || !validOffset(value.end) || value.end <= value.start) return null;
  if (value.end - value.start > MAX_ANNOTATION_TEXT_CHARS) return null;
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || value.createdAt < 0) return null;
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) return null;

  const note = optionalNote(value.note);
  return {
    id: value.id.trim(),
    path,
    quote,
    prefix,
    suffix,
    start: value.start,
    end: value.end,
    ...(note ? { note } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function normalizeAnnotations(value: unknown): TextAnnotation[] {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.annotations)
      ? value.annotations
      : [];
  const seen = new Set<string>();
  const annotations: TextAnnotation[] = [];
  for (const candidate of candidates) {
    const annotation = normalizeAnnotation(candidate);
    if (!annotation || seen.has(annotation.id)) continue;
    seen.add(annotation.id);
    annotations.push(annotation);
    if (annotations.length >= MAX_ANNOTATIONS) break;
  }
  return annotations;
}

export function annotationIdentity(annotation: Pick<TextAnnotation, "path" | "quote" | "start" | "end">): string {
  return [normalizePathKey(annotation.path), annotation.start, annotation.end, annotation.quote].join("\u0000");
}

export function addAnnotation(annotations: readonly TextAnnotation[], annotation: TextAnnotation): TextAnnotation[] {
  const normalized = normalizeAnnotation(annotation);
  if (!normalized) return normalizeAnnotations(annotations);
  const identity = annotationIdentity(normalized);
  return normalizeAnnotations([
    normalized,
    ...annotations.filter((candidate) => annotationIdentity(candidate) !== identity),
  ]);
}

export function removeAnnotation(annotations: readonly TextAnnotation[], id: string): TextAnnotation[] {
  return normalizeAnnotations(annotations).filter((annotation) => annotation.id !== id);
}

export function createAnnotation(
  path: string,
  selection: AnnotationSelection,
  note = "",
  now = Date.now(),
  id = createAnnotationId(),
): TextAnnotation {
  const annotation = normalizeAnnotation({
    id,
    path,
    ...selection,
    note,
    createdAt: now,
    updatedAt: now,
  });
  if (!annotation) throw new Error("无法创建无效的阅读批注。");
  return annotation;
}

function createAnnotationId(): string {
  const runtimeCrypto = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  return runtimeCrypto?.randomUUID?.() ?? `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isNodeWithin(root: HTMLElement, node: Node): boolean {
  return node === root || root.contains(node);
}

export function createSelectionAnchor(root: HTMLElement, selection: Selection | null): AnnotationSelection | null {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !isNodeWithin(root, range.startContainer) || !isNodeWithin(root, range.endContainer))
    return null;

  const quote = normalizeAnnotationText(range.toString());
  if (!quote) return null;

  const before = root.ownerDocument.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const approximateStart = normalizeAnnotationText(before.toString()).length;
  const rootText = normalizeAnnotationText(
    typeof root.innerText === "string" ? root.innerText : (root.textContent ?? ""),
  );
  const nearbyStart = rootText.indexOf(quote, Math.max(0, approximateStart - quote.length - 4));
  const start = nearbyStart >= 0 ? nearbyStart : Math.min(approximateStart, rootText.length);
  const end = start + quote.length;

  return {
    quote,
    prefix: rootText.slice(Math.max(0, start - ANNOTATION_CONTEXT_CHARS), start),
    suffix: rootText.slice(end, end + ANNOTATION_CONTEXT_CHARS),
    start,
    end,
  };
}

export function workspaceRelativePath(workspaceRoot: string, absolutePath: string): string | null {
  const rootKey = normalizePathKey(workspaceRoot);
  const pathKey = normalizePathKey(absolutePath);
  if (!rootKey || pathKey === rootKey || !pathKey.startsWith(`${rootKey}\\`)) return null;

  const root = workspaceRoot.replace(/[\\/]+$/, "");
  const path = absolutePath.replace(/[\\/]+/g, "/");
  const rootWithSlashes = root.replace(/[\\/]+/g, "/");
  if (!path.toLowerCase().startsWith(`${rootWithSlashes.toLowerCase()}/`)) return null;
  return path.slice(rootWithSlashes.length + 1);
}
