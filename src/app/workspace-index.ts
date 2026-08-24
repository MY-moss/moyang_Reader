import type { WorkspaceIndexEntry } from "./types";

function stripLinkFragment(value: string): string {
  return value.trim().split(/[?#]/, 1)[0].trim().replace(/^<|>$/g, "");
}

function normalizeWorkspacePath(value: string): string {
  const parts: string[] = [];
  for (const part of value.replace(/[\\/]+/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/").toLocaleLowerCase();
}

function withoutMarkdownExtension(value: string): string {
  return normalizeWorkspacePath(stripLinkFragment(value)).replace(/\.(?:md|markdown|mdown|mkd)$/i, "");
}

function entryKeys(entry: WorkspaceIndexEntry): string[] {
  return [entry.file.relativePath, entry.file.name].map(withoutMarkdownExtension);
}

export type WorkspaceBacklinkIndex = ReadonlyMap<string, ReadonlySet<string>>;

export type WorkspaceLinkIndex = Readonly<{
  exact: ReadonlyMap<string, readonly WorkspaceIndexEntry[]>;
  suffix: ReadonlyMap<string, readonly WorkspaceIndexEntry[]>;
}>;

/** Build a reusable link-target index for the current workspace snapshot. */
export function createBacklinkIndex(entries: WorkspaceIndexEntry[]): WorkspaceBacklinkIndex {
  const index = new Map<string, Set<string>>();

  for (const entry of entries) {
    for (const link of entry.links) {
      const target = withoutMarkdownExtension(link);
      if (!target) continue;

      const sources = index.get(target) ?? new Set<string>();
      sources.add(entry.file.path);
      index.set(target, sources);
    }
  }

  return index;
}

function addLinkCandidate(index: Map<string, WorkspaceIndexEntry[]>, key: string, entry: WorkspaceIndexEntry): void {
  if (!key) return;
  const candidates = index.get(key) ?? [];
  candidates.push(entry);
  index.set(key, candidates);
}

/** Build reusable exact and suffix maps for wiki-link resolution. */
export function createLinkIndex(entries: WorkspaceIndexEntry[]): WorkspaceLinkIndex {
  const exact = new Map<string, WorkspaceIndexEntry[]>();
  const suffix = new Map<string, WorkspaceIndexEntry[]>();

  for (const entry of entries) {
    const relativeKey = withoutMarkdownExtension(entry.file.relativePath);
    if (!relativeKey) continue;

    addLinkCandidate(exact, relativeKey, entry);
    const parts = relativeKey.split("/");
    for (let start = 0; start < parts.length; start += 1) {
      addLinkCandidate(suffix, parts.slice(start).join("/"), entry);
    }
  }

  return { exact, suffix };
}

export function linkMatchesEntry(link: string, entry: WorkspaceIndexEntry): boolean {
  const target = withoutMarkdownExtension(link);
  if (!target) return false;

  return entryKeys(entry).some((key) => key === target || key.endsWith(`/${target}`));
}

function directoryOf(relativePath: string): string {
  const normalized = relativePath.replace(/[\\/]+/g, "/");
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

/** Resolve a wiki link with same-folder and full relative-path priority. */
export function findLinkedEntry(
  entries: WorkspaceIndexEntry[],
  current: WorkspaceIndexEntry | undefined,
  link: string,
  linkIndex: WorkspaceLinkIndex = createLinkIndex(entries),
): WorkspaceIndexEntry | undefined {
  const target = stripLinkFragment(link);
  if (!target) return undefined;

  if (current) {
    const relativeTarget = withoutMarkdownExtension(`${directoryOf(current.file.relativePath)}/${target}`);
    const sameFolderMatch = linkIndex.exact.get(relativeTarget)?.[0];
    if (sameFolderMatch) return sameFolderMatch;
  }

  const targetKey = withoutMarkdownExtension(target);
  const exactMatch = linkIndex.exact.get(targetKey)?.[0];
  if (exactMatch) return exactMatch;

  return linkIndex.suffix.get(targetKey)?.[0];
}

export function findIndexEntry(entries: WorkspaceIndexEntry[], path: string): WorkspaceIndexEntry | undefined {
  return entries.find((entry) => entry.file.path === path);
}

export function findBacklinks(
  entries: WorkspaceIndexEntry[],
  current: WorkspaceIndexEntry,
  index: WorkspaceBacklinkIndex = createBacklinkIndex(entries),
): WorkspaceIndexEntry[] {
  const sourcePaths = new Set<string>();

  for (const key of entryKeys(current)) {
    const parts = key.split("/");
    for (let start = 0; start < parts.length; start += 1) {
      const sources = index.get(parts.slice(start).join("/"));
      sources?.forEach((path) => sourcePaths.add(path));
    }
  }

  return entries.filter((entry) => entry.file.path !== current.file.path && sourcePaths.has(entry.file.path));
}
