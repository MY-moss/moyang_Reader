import { describe, expect, it } from "vitest";
import { reorderTabs } from "./tab-order";

const tabs = [
  { path: "C:/one.md", name: "one.md" },
  { path: "C:/two.md", name: "two.md" },
  { path: "C:/three.md", name: "three.md" },
];

describe("reorderTabs", () => {
  it("moves a tab to the dropped tab position", () => {
    expect(reorderTabs(tabs, "C:/three.md", "C:/one.md").map((tab) => tab.name)).toEqual([
      "three.md",
      "one.md",
      "two.md",
    ]);
  });

  it("does not mutate or reorder for unknown and identical paths", () => {
    expect(reorderTabs(tabs, "C:/one.md", "C:/one.md")).toEqual(tabs);
    expect(reorderTabs(tabs, "C:/missing.md", "C:/one.md")).toEqual(tabs);
    expect(tabs.map((tab) => tab.name)).toEqual(["one.md", "two.md", "three.md"]);
  });
});
