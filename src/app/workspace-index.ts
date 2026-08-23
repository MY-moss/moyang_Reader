import type { WorkspaceIndexEntry } from "./types";

function stripLinkFragment(value: string): string {
  return value
    .trim()
    .split(/[?#]/, 1)[0]
    .trim()
    .replace(/^<|>$/g, "");
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
  return normalizeWorkspacePath(stripLinkFragment(value))
    .replace(/\.(?:md|markdown|mdown|mkd)$/i, "");
}

function entryKeys(entry: WorkspaceIndexEntry): string[] {
  return [entry.file.relativePath, entry.file.name].map(withoutMarkdownExtension);
}

export function linkMatchesEntry(link: string, entry: WorkspaceIndexEntry): boolean {
  const target = withoutMarkdownExtension(link);
  if (!target) return false;

  return entryKeys(entry).some((key) => (
    key === target || key.endsWith(`/${target}`)
  ));
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
): WorkspaceIndexEntry | undefined {
  const target = stripLinkFragment(link);
  if (!target) return undefined;

  if (current) {
    const relativeTarget = withoutMarkdownExtension(`${directoryOf(current.file.relativePath)}/${target}`);
    const sameFolderMatch = entries.find((entry) => (
      withoutMarkdownExtension(entry.file.relativePath) === relativeTarget
    ));
    if (sameFolderMatch) return sameFolderMatch;
  }

  const exactMatch = entries.find((entry) => (
    withoutMarkdownExtension(entry.file.relativePath) === withoutMarkdownExtension(target)
  ));
  if (exactMatch) return exactMatch;

  return entries.find((entry) => linkMatchesEntry(target, entry));
}

export function findIndexEntry(entries: WorkspaceIndexEntry[], path: string): WorkspaceIndexEntry | undefined {
  return entries.find((entry) => entry.file.path === path);
}

export function findBacklinks(entries: WorkspaceIndexEntry[], current: WorkspaceIndexEntry): WorkspaceIndexEntry[] {
  return entries.filter((entry) => (
    entry.file.path !== current.file.path && entry.links.some((link) => linkMatchesEntry(link, current))
  ));
}
