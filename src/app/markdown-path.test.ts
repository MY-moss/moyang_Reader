import { describe, expect, it } from "vitest";

import { relativeMarkdownAssetPath } from "./markdown-path";

describe("relativeMarkdownAssetPath", () => {
  it("keeps assets next to a document relative to the document directory", () => {
    expect(relativeMarkdownAssetPath("Today.md", "images/cover.png")).toBe("images/cover.png");
    expect(relativeMarkdownAssetPath("notes/Today.md", "notes/images/cover.png")).toBe("images/cover.png");
  });

  it("walks up from nested documents to reach a workspace asset", () => {
    expect(relativeMarkdownAssetPath("notes/Today.md", "images/cover.png")).toBe("../images/cover.png");
    expect(relativeMarkdownAssetPath("notes/daily/Today.md", "images/cover.png")).toBe("../../images/cover.png");
  });

  it("rejects absolute or unsafe workspace paths", () => {
    expect(relativeMarkdownAssetPath("notes/Today.md", "C:/images/cover.png")).toBeNull();
    expect(relativeMarkdownAssetPath("../Today.md", "images/cover.png")).toBeNull();
    expect(relativeMarkdownAssetPath("notes/Today.md", "../images/cover.png")).toBeNull();
  });
});
