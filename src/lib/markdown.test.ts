import { describe, expect, it } from "vitest";
import { renderMarkdown, renderPlainText } from "./markdown";

describe("renderMarkdown", () => {
  it("renders GFM content and builds a table of contents", async () => {
    const result = await renderMarkdown(`# 标题\n\n- [x] 已完成\n\n| A | B |\n|---|---|\n| 1 | 2 |`);

    expect(result.html).toContain("<h1");
    expect(result.html).toContain("已完成");
    expect(result.html).toContain("<table>");
    expect(result.toc).toEqual([{ id: "标题", depth: 1, text: "标题" }]);
  });

  it("renders wiki links without executing arbitrary HTML", async () => {
    const result = await renderMarkdown("[[第二篇|下一篇]]\n\n<script>alert('x')</script>");

    expect(result.html).toContain('href="moyang-wiki:%E7%AC%AC%E4%BA%8C%E7%AF%87"');
    expect(result.html).not.toContain("<script");
  });

  it("supports math syntax", async () => {
    const result = await renderMarkdown("行内公式：$x^2$");
    expect(result.html).toContain("katex");
  });

  it("renders plain text with preserved line breaks and escaped markup", async () => {
    const result = await renderPlainText("第一行\n<script>alert('x')</script>");

    expect(result.html).toContain("<pre class=\"plain-text\">第一行\n&lt;script&gt;");
    expect(result.html).not.toContain("<script");
    expect(result.toc).toEqual([]);
  });
});
