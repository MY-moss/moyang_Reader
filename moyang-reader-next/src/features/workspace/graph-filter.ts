import type { WorkspaceIndexEntry } from "../../shared/types";
import { createLinkIndex, findLinkedEntry } from "./workspace-index";

export type GraphFilter = {
  query: string;
  tag: string;
  scope: "neighbors" | "workspace";
  direction: "both" | "incoming" | "outgoing";
};
export function filterGraphEntries(current: WorkspaceIndexEntry, entries: WorkspaceIndexEntry[], filter: GraphFilter) {
  const linkIndex = createLinkIndex(entries);
  const outgoing = new Set(current.links.map((link) => findLinkedEntry(entries, current, link, linkIndex)?.file.path));
  const query = filter.query.toLocaleLowerCase().trim();
  return entries.filter((entry) => {
    if (entry.file.path === current.file.path) return false;
    const searchablePath = query.includes(".")
      ? entry.file.relativePath
      : entry.file.relativePath.replace(/\.[^./\\]+$/, "");
    if (query && !`${entry.title} ${searchablePath}`.toLocaleLowerCase().includes(query)) return false;
    if (filter.tag && !entry.tags.includes(filter.tag)) return false;
    if (filter.scope === "workspace") return true;
    const incoming = entry.links.some(
      (link) => findLinkedEntry(entries, entry, link, linkIndex)?.file.path === current.file.path,
    );
    return (
      (filter.direction !== "incoming" && outgoing.has(entry.file.path)) ||
      (filter.direction !== "outgoing" && incoming)
    );
  });
}
