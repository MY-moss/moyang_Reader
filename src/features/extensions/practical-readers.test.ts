// @vitest-environment node
import { describe, expect, it } from "vitest";
import { analyzeDocument } from "./document-analysis";
import { practicalReaders } from "./builtin-readers";
import { validateOutput } from "./output";
import type { ExtensionInput, ExtensionOutput } from "../../shared/extension-types";

async function run(id: string, text: string) {
  const pkg = practicalReaders.find((pkg) => pkg.id === `moyang.${id}`)!;
  // Execute the actual distributable single-file module, not the original function.
  const module = (await import(
    /* @vite-ignore */ "data:text/javascript;base64," + Buffer.from(pkg.files![pkg.entry!]).toString("base64")
  )) as { default: (input: ExtensionInput) => ExtensionOutput };
  return validateOutput(
    module.default({
      command: "run",
      text,
      title: "中文资料",
      path: "notes.md",
      format: "markdown",
      analysis: analyzeDocument(text),
    }),
    pkg.commands![0],
    text,
  );
}
describe("useful reader plugins", () => {
  it("extracts nested real tasks with CRLF locations, excluding frontmatter and fenced examples", async () => {
    const text = [
      "---",
      'title: "- [ ] 属性不是任务"',
      "---",
      "# 工作",
      "",
      "- [ ] 外层 **任务**",
      "  - [x] 子任务",
      "",
      "```md",
      "- [ ] 示例",
      "```",
    ].join("\r\n");
    const result = await run("task-extract", text);
    expect(result.findings?.map((item) => item.label)).toEqual(["待办 · 外层 任务", "已完成 · 子任务"]);
    expect(result.findings?.[0].line).toBe(6);
    const item = result.findings![0];
    expect(text.slice(item.from, item.to)).toBe("外层 **任务**");
    expect(result.files![0].content).toContain("- [x] 子任务");
  });
  it("resolves reference links, images and balanced destinations without treating code as links", async () => {
    const text =
      '# 文档\n\n[资料][ref] ![图](./图.png) [括号](https://example.org/a(b))\n\n`[示例](ignored)`\n\n[ref]: https://example.org/source "说明"\n';
    const result = await run("link-inventory", text);
    expect(result.findings?.map((item) => item.detail)).toEqual([
      "https://example.org/source",
      "./图.png",
      "https://example.org/a(b)",
    ]);
    expect(result.report).toContain("没有联网检查");
  });
  it("exports GFM tables with escaped pipes, quotes and literal formula values as UTF-8 CSV", async () => {
    const result = await run(
      "table-export",
      '| 名称 | 值 |\n| --- | --- |\n| 中文\\|术语 | =1+2 |\n| 引号" | `代码` |\n\n```\n|假|表|\n|--|--|\n```',
    );
    expect(result.files).toHaveLength(1);
    expect(result.files![0].content).toBe('\uFEFF"名称","值"\r\n"中文|术语","\'=1+2"\r\n"引号""","代码"\r\n');
  });
  it("reports actionable structural issues without changing the document", async () => {
    const result = await run("document-health", "# 标题\n\n### 跳级\n\n### 跳级\n\n[](/url) ![](img.png) [占位]()");
    expect(result.findings?.map((item) => item.label)).toEqual([
      "标题层级跳跃",
      "重复标题",
      "链接缺少说明",
      "图片缺少替代文字",
      "链接目标为空",
    ]);
    expect(result.replacement).toBeUndefined();
  });
  it("returns useful empty states for ordinary prose", async () => {
    for (const id of ["task-extract", "link-inventory", "table-export", "document-health"]) {
      const result = await run(id, "一段普通正文。");
      expect(result.report).toBeTruthy();
      expect(result.findings).toEqual([]);
    }
  });
  it("rejects invalid source ranges and export paths while retaining the old report protocol", () => {
    const command = { id: "read", name: "读取" };
    expect(validateOutput({ report: "旧插件" }, command, "abc")).toEqual({ report: "旧插件" });
    expect(() => validateOutput({ findings: [{ label: "坏位置", line: 1, from: 0, to: 9 }] }, command, "abc")).toThrow(
      "来源位置",
    );
    expect(() => validateOutput({ files: [{ name: "../escape.txt", content: "x" }] }, command, "abc")).toThrow(
      "文件无效",
    );
    expect(() => validateOutput({ replacement: "changed" }, command, "abc")).toThrow("没有声明");
  });
});
