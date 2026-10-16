import { expect, it } from "vitest";
import {
  commonProperties,
  updateCommonProperty,
  replaceProperties,
  splitFrontmatter,
  validateProperties,
} from "./frontmatter";
it("updates full YAML without touching body, comments or unknown fields", () => {
  const source = "---\r\ntitle: old\r\n---\r\n\r\n# 正文\r\n原文  \r\n";
  const yaml = "title: new\n# keep\ncustom:\n  nested: [a, b]\ntags: [阅读]";
  const next = replaceProperties(source, yaml);
  expect(splitFrontmatter(next).body).toBe(splitFrontmatter(source).body);
  expect(next).toContain("# keep\r\ncustom:\r\n  nested: [a, b]");
});
it("adds a property block and rejects invalid mappings or delimiters", () => {
  expect(replaceProperties("# Note", "title: Note")).toBe("---\ntitle: Note\n---\n# Note");
  expect(() => validateProperties("title: [oops")).toThrow();
  expect(() => validateProperties("title: a\ntitle: b")).toThrow();
  expect(() => validateProperties("- list")).toThrow();
  expect(() => splitFrontmatter("---\ntitle: missing")).toThrow();
});
it("edits ordinary property fields without dropping custom nodes and comments", () => {
  const yaml = "# keep\ntitle: Old\ncustom:\n  nested: [a, b]\n";
  const next = updateCommonProperty(updateCommonProperty(yaml, "title", "新标题"), "tags", "阅读, #工作， 灵感");
  expect(commonProperties(next)).toEqual({ title: "新标题", tags: "阅读, 工作, 灵感", valid: true });
  expect(next).toContain("# keep");
  expect(validateProperties(next).toJS()).toMatchObject({ custom: { nested: ["a", "b"] } });
  expect(commonProperties("invalid: [").valid).toBe(false);
});
