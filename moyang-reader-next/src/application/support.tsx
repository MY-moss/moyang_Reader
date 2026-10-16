import { lazy } from "react";
import { scrollHeadingInContainer } from "../features/reader/heading-navigation";
import { type AppSettingsSnapshot } from "../features/settings/app-settings";
import { type WorkspaceKindFilter } from "../features/workspace/workspace-filter";
import { normalizePathKey } from "../platform/path-key";
import { saveWorkspaceSession } from "../platform/storage";
import type {
  DocumentKind,
  ExportMargin,
  ExportOrientation,
  ExportPaper,
  RecentFile,
  RecentWorkspace,
  ThemeMode,
  WorkspaceDirectory,
  WorkspaceExportFailure,
  WorkspaceFile,
  WorkspaceIndexEntry,
} from "../shared/types";
export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function duplicateEntryName(path: string, kind: "file" | "folder"): string {
  const name = fileNameFromPath(path);
  if (kind === "folder") return `${name} 副本`;
  const extensionIndex = name.lastIndexOf(".");
  if (extensionIndex > 0) return `${name.slice(0, extensionIndex)} 副本${name.slice(extensionIndex)}`;
  return `${name} 副本`;
}

export function focusEditorSurface(surface: Element | null): void {
  if (!surface) return;
  const target = surface.matches('textarea, [contenteditable="true"], .cm-content')
    ? surface
    : surface.querySelector<HTMLElement>('.cm-content, [contenteditable="true"], textarea');
  if (target instanceof HTMLElement) target.focus();
}

export async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("当前环境不支持访问剪贴板。");
  } finally {
    textarea.remove();
  }
}

export const LazyMarkdownWysiwygEditor = lazy(() =>
  import("../features/editor/components/MarkdownWysiwygEditor").then(({ MarkdownWysiwygEditor }) => ({
    default: MarkdownWysiwygEditor,
  })),
);

export function fileTypeLabel(kind: DocumentKind): string {
  return kind === "markdown" ? "MD" : kind === "image" ? "IMG" : kind.toUpperCase();
}

export function startsWithHeading(html: string): boolean {
  return /^\s*<h1(?:\s[^>]*)?>/i.test(html);
}

export function comparablePath(path: string): string {
  return normalizePathKey(path);
}

export function pathBelongsToWorkspace(path: string, workspacePath: string): boolean {
  const candidate = comparablePath(path);
  const root = comparablePath(workspacePath);
  return candidate === root || candidate.startsWith(`${root}\\`);
}

export function resolveRelativePath(basePath: string, target: string): string | null {
  if (basePath.startsWith("browser://")) return null;

  const cleanTarget = target.split(/[?#]/, 1)[0].trim();
  if (!cleanTarget) return null;

  const normalizedTarget = cleanTarget.replace(/[\\/]+/g, "\\");
  const isAbsolute = /^[A-Za-z]:\\/.test(normalizedTarget) || normalizedTarget.startsWith("\\\\");
  const baseDirectory = basePath.replace(/[\\/][^\\/]*$/, "");
  return isAbsolute ? normalizedTarget : `${baseDirectory}\\${normalizedTarget}`;
}

export function resolveWikiPath(basePath: string, target: string): string | null {
  const resolved = resolveRelativePath(basePath, target);
  if (!resolved) return null;

  return /\.[A-Za-z0-9]+$/.test(resolved) ? resolved : `${resolved}.md`;
}

export function scrollToHeading(anchor: string, contentArea: HTMLElement | null, article: HTMLElement | null): void {
  let attempts = 0;
  const attempt = () => {
    if (scrollHeadingInContainer(anchor, contentArea, article)) return;
    if (attempts >= 4) return;
    attempts += 1;
    window.requestAnimationFrame(attempt);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(attempt);
  });
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export type CurrentHeading = {
  id: string;
  text: string;
};

export function currentHeadingFromArticle(
  article: HTMLElement | null,
  contentArea: HTMLElement | null,
): CurrentHeading | null {
  if (!article) return null;

  const headings = Array.from(article.querySelectorAll<HTMLElement>("h1, h2, h3, h4"));
  if (headings.length === 0) return null;

  const maxScrollTop = contentArea ? Math.max(0, contentArea.scrollHeight - contentArea.clientHeight) : 0;
  const isAtBottom = Boolean(contentArea && contentArea.scrollTop >= maxScrollTop - 2);
  let currentHeading: HTMLElement | undefined;
  if (isAtBottom) {
    currentHeading = headings[headings.length - 1];
  } else {
    const threshold = (contentArea?.getBoundingClientRect().top ?? 0) + 72;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= threshold) currentHeading = heading;
      else break;
    }
  }

  const heading = currentHeading ?? headings[0];
  const text = heading.textContent?.trim() ?? "";
  return text ? { id: heading.id, text } : null;
}

export function readSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem("moyang-reader-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch {
    return "system";
  }
}

export function downloadText(name: string, contents: string, mimeType = "text/markdown"): void {
  const blob = new Blob([contents], { type: mimeType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(name: string, contents: Uint8Array, mimeType: string): void {
  const buffer = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type BrowserDocument = {
  kind: DocumentKind;
  source?: string;
  bytes?: Uint8Array;
  previewUrl?: string;
};

export type PrintPreviewState = {
  template?: import("../features/settings/appearance").ExportTemplate;
  title: string;
  html: string;
  defaultPath?: string;
  actionLabel?: string;
  actionHint?: string;
  paper: ExportPaper;
  orientation: ExportOrientation;
  margin: ExportMargin;
};

export type WorkspaceExportProgress = {
  current: number;
  total: number;
  fileName: string;
};

export type PdfBatchExportState = {
  files: WorkspaceFile[];
  nextIndex: number;
  volumeNumber: number;
  exported: number;
  skippedFiles: WorkspaceExportFailure[];
  title: string;
  options: {
    template?: import("../features/settings/appearance").ExportTemplate;
    paper: ExportPaper;
    orientation: ExportOrientation;
    margin: ExportMargin;
  };
};

export type CachedWorkspace = {
  path: string;
  name: string;
  files: WorkspaceFile[];
  folders: WorkspaceDirectory[];
  index: WorkspaceIndexEntry[];
  revision: number;
  selectedTag: string | null;
  selectedFileKind: WorkspaceKindFilter;
  searchQuery: string;
  tabs: RecentFile[];
  activeDocumentPath: string | null;
};

export type DraftFlushOutcome = "not-needed" | "saved" | "unavailable" | "failed";

export type PendingAppSettingsWrite = {
  snapshot: AppSettingsSnapshot;
  localSaved: boolean;
};

export function updateCachedWorkspace(
  cache: Map<string, CachedWorkspace>,
  root: string,
  changes: Partial<Omit<CachedWorkspace, "path">>,
): void {
  const key = comparablePath(root);
  const current = cache.get(key);
  if (!current) return;
  cache.set(key, { ...current, ...changes });
}

export function persistCachedWorkspaceSession(cache: Map<string, CachedWorkspace>, root: string): void {
  const cached = cache.get(comparablePath(root));
  if (!cached) return;
  saveWorkspaceSession({
    path: cached.path,
    tabs: cached.tabs,
    activeDocumentPath: cached.activeDocumentPath,
  });
}

export function pruneWorkspaceCache(cache: Map<string, CachedWorkspace>, mounted: RecentWorkspace[]): void {
  const mountedKeys = new Set(mounted.map((workspace) => comparablePath(workspace.path)));
  for (const key of cache.keys()) {
    if (!mountedKeys.has(key)) cache.delete(key);
  }
}
