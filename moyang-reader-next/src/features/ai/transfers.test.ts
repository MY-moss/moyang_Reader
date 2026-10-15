import { describe, expect, it } from "vitest";
import { parseSkill, skillMarkdown } from "./transfers";
describe("portable agent skills", () => {
  it("preserves unknown metadata and markdown on roundtrip", () => {
    const source =
      "---\nname: writing-review\ndescription: 写作审校时使用\nlicense: MIT\nmetadata:\n  author: moyang\n---\n\n# 步骤\n\n检查事实。";
    const fields = parseSkill(source);
    const roundtrip = parseSkill(skillMarkdown(fields));
    expect(roundtrip.title).toBe("writing-review");
    expect(roundtrip.body).toBe(fields.body);
    expect(roundtrip.skill_meta).toEqual({ license: "MIT", metadata: { author: "moyang" } });
  });
  it("rejects ambiguous and missing skill metadata", () => {
    expect(() => parseSkill("---\nname: a\nname: b\ndescription: x\n---\nx")).toThrow();
    expect(() => parseSkill("# just a note")).toThrow();
    expect(() => parseSkill("---\nname: a\n---\nx")).toThrow();
  });
});
