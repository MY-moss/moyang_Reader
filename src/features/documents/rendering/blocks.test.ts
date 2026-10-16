import { expect, it } from "vitest";
import { renderMarkdown } from "./markdown";
import { renderDocumentEmbed } from "./embeds";
it("creates stable block targets without interpreting code or duplicate IDs", async () => {
  const result = await renderMarkdown("一段内容 ^intro\n\n第二段 ^intro\n\n`code ^code`\n\n```\ntext ^raw\n```");
  expect(result.html.match(/id="block-intro"/g)).toHaveLength(1);
  expect(result.html).not.toContain('id="block-code"');
  expect(result.html).not.toContain('id="block-raw"');
});
it("embeds a block or section, keeps nesting bounded and rejects missing targets", async () => {
  const source = "# Title\n\n## One\n\nTarget ^sample\n\n![[Other]]\n\n## Two\n\nLater";
  expect(await renderDocumentEmbed(source, "^sample")).toContain("Target");
  const section = await renderDocumentEmbed(source, "one");
  expect(section).not.toContain("Later");
  expect(section).toContain('href="moyang-wiki:Other"');
  expect(section).not.toContain('id="');
  await expect(renderDocumentEmbed(source, "missing")).rejects.toThrow("找不到");
});
