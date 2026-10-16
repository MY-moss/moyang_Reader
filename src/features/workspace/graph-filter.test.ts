import { expect, it } from "vitest";
import type { WorkspaceIndexEntry } from "../../shared/types";
import { filterGraphEntries } from "./graph-filter";
function entry(name: string, links: string[] = [], tags: string[] = []): WorkspaceIndexEntry {
  return {
    title: name,
    links,
    tags,
    file: { name: name + ".md", path: "C:/" + name + ".md", relativePath: name + ".md", kind: "markdown", size: 5 },
  };
}
it("filters incoming, outgoing, whole-library, tag and title without silently truncating", () => {
  const current = entry("A", ["B"]),
    entries = [current, entry("B", [], ["阅读"]), entry("C", ["A"]), entry("D")];
  const filter = { query: "", tag: "", scope: "neighbors", direction: "both" } as const;
  expect(filterGraphEntries(current, entries, filter).map((e) => e.title)).toEqual(["B", "C"]);
  expect(filterGraphEntries(current, entries, { ...filter, direction: "incoming" })[0].title).toBe("C");
  expect(filterGraphEntries(current, entries, { ...filter, tag: "阅读" })[0].title).toBe("B");
  expect(filterGraphEntries(current, entries, { ...filter, scope: "workspace", query: "D" })[0].title).toBe("D");
});
