import { describe, expect, it } from "vitest";
import { getSafetyCopyKeys, safetyText } from "./safety-dialog-copy";

describe("safety dialog copy", () => {
  it("keeps Chinese and English copy and placeholders aligned", () => {
    for (const key of getSafetyCopyKeys()) {
      const zh = safetyText("zh-CN", key);
      const en = safetyText("en-US", key);
      expect(zh).not.toBe("");
      expect(en).not.toBe("");
      expect(Array.from(zh.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort()).toEqual(
        Array.from(en.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort(),
      );
    }
  });

  it("interpolates file names as text without changing the template", () => {
    expect(safetyText("en-US", "discardDescription", { name: "<note>.md" })).toContain("<note>.md");
    expect(safetyText("zh-CN", "discardDescription", { name: "笔记.md" })).toContain("笔记.md");
  });
});
