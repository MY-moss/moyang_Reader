import { describe, expect, it } from "vitest";
import { locateSource, sourceBlocks } from "./source-locator";
describe("source relocation", () => {
  const root = (html: string) => new DOMParser().parseFromString(html, "text/html");
  it("locates the requested occurrence in an unchanged long document", () => {
    const document = root("<h1>标题</h1><p>重复证据</p><p>重复证据</p>");
    const found = locateSource(document, { path: "a.md", paragraph: 3, quote: "重复证据" }, true);
    expect(found.status).toBe("found");
    expect(found.element).toBe(sourceBlocks(document)[2]);
  });
  it("relocates a unique quote after surrounding paragraphs change", () => {
    const found = locateSource(
      root("<p>新增</p><p>唯一 的\n 证据</p>"),
      { path: "a.md", paragraph: 1, quote: "唯一 的 证据" },
      false,
    );
    expect(found.status).toBe("moved");
    expect(found.element?.tagName).toBe("P");
  });
  it("does not pretend an ambiguous or removed quote was located", () => {
    expect(locateSource(root("<p>相同</p><p>相同</p>"), { path: "a", quote: "相同" }, false).status).toBe("ambiguous");
    expect(locateSource(root("<p>新内容</p>"), { path: "a", quote: "旧内容" }, false).status).toBe("missing");
  });
});
