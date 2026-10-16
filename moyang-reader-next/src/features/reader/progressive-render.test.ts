import { describe, expect, it } from "vitest";
import { shouldUseProgressiveReader, splitHtmlIntoBlocks } from "./progressive-render";

describe("progressive reader rendering", () => {
  it("keeps short documents as one unchanged fragment", () => {
    const html = "<h1>标题</h1><p>正文</p>";
    expect(splitHtmlIntoBlocks(html, 1_000)).toEqual([html]);
    expect(shouldUseProgressiveReader(html, 1_000)).toBe(false);
  });

  it("splits only between top-level nodes and preserves nested blocks", () => {
    const html =
      "<h1>标题</h1><table><tbody><tr><td>单元格</td></tr></tbody></table><pre><code>const value = 1;</code></pre>";
    const chunks = splitHtmlIntoBlocks(html, 40);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(html);
    expect(chunks.some((chunk) => chunk.includes("<table><tbody><tr><td>单元格</td></tr></tbody></table>"))).toBe(true);
    expect(chunks.some((chunk) => chunk.includes("<pre><code>const value = 1;</code></pre>"))).toBe(true);
  });

  it("keeps one oversized block intact instead of cutting its markup", () => {
    const html = `<pre><code>${"x".repeat(200)}</code></pre><p>after</p>`;
    const chunks = splitHtmlIntoBlocks(html, 32);

    expect(chunks[0]).toBe(`<pre><code>${"x".repeat(200)}</code></pre>`);
    expect(chunks[1]).toBe("<p>after</p>");
  });
});
