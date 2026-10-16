import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

const text =
  "# 阅读计划\n\n- [ ] 核对**来源**\n- [x] 完成阅读\n\n### 后续\n\n[资料][source]\n\n| 名称 | 值 |\n| --- | --- |\n| 中文\\|字段 | =1+2 |\n\n[source]: https://example.org/source\n";
async function install(page: Page, name: string) {
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await expect(page.getByRole("button", { name: "停用", exact: true })).toBeVisible();
}
async function openMarkdown(page: Page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "阅读计划.md", mimeType: "text/markdown", buffer: Buffer.from(text) });
  await expect(page.locator(".document-title")).toHaveText("阅读计划.md");
}
test("installed reader tools run directly, locate source and export actual CSV", async ({ page }) => {
  await openMarkdown(page);
  await install(page, "待办提取");
  await page.getByRole("button", { name: "运行：提取文档待办", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("未完成 1 项，已完成 1 项");
  await page.getByRole("button", { name: /第 3 行.*待办/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".cm-content")).toContainText("核对**来源**");
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("核对**来源**");
  await install(page, "表格导出");
  await page.getByRole("button", { name: "运行：导出文档表格", exact: true }).click();
  await expect(dialog).toContainText("找到 1 张 Markdown 表格");
  await page.getByText("表格-1.csv · 预览", { exact: true }).click();
  await expect(dialog.locator(".extension-files")).toContainText("中文|字段");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 表格-1.csv", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("表格-1.csv");
  const csv = await fs.readFile((await download.path())!, "utf8");
  expect(csv).toContain('"中文|字段","\'=1+2"');
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "返回工作台", exact: true }).click();
  await page.getByLabel("更多操作", { exact: true }).click();
  await page.getByText("阅读插件", { exact: true }).click();
  await page.getByRole("button", { name: "提取文档待办 · 待办提取", exact: true }).click();
  await expect(dialog).toContainText("待办清单");
});

test("link and document reports remain readable in both themes and narrow windows", async ({ page }) => {
  await openMarkdown(page);
  await install(page, "链接清单");
  await page.getByRole("button", { name: "运行：整理文档链接", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("https://example.org/source");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await install(page, "文档体检");
  await page.getByRole("button", { name: "运行：检查文档结构", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("标题层级跳跃");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1440, 720]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator(".extension-result").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      const audit = await new AxeBuilder({ page }).include(".extension-result").analyze();
      expect(audit.violations).toEqual([]);
      await fs.mkdir("artifacts/practical-extensions", { recursive: true });
      await page.screenshot({ path: `artifacts/practical-extensions/report-${colorScheme}-${width}.png` });
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "停用", exact: true }).click();
  await expect(page.getByRole("button", { name: "运行：检查文档结构", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "卸载扩展", exact: true }).click();
  await page.getByRole("button", { name: "确认卸载", exact: true }).click();
  await expect(page.getByRole("button", { name: "运行：检查文档结构", exact: true })).toBeHidden();
});

test("reader commands explain the required format and stay disabled without a document", async ({ page }) => {
  await page.goto("/");
  await install(page, "待办提取");
  await expect(page.getByRole("button", { name: "运行：提取文档待办", exact: true })).toBeDisabled();
  await expect(page.getByRole("article")).toContainText("支持：Markdown");
});

test("new assistants and the source-review skill install through existing optional entrypoints", async ({ page }) => {
  await page.goto("/");
  await install(page, "论证审阅");
  await page.getByRole("button", { name: "开始聊天", exact: true }).click();
  await expect(page.getByLabel("聊天助手", { exact: true })).toHaveValue("moyang.argument-review");
  await install(page, "复习教练");
  await page.getByRole("button", { name: "开始聊天", exact: true }).click();
  await expect(page.getByLabel("聊天助手", { exact: true })).toHaveValue("moyang.recall-coach");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.getByRole("button", { name: /^来源核对与知识整理/ }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByRole("button", { name: "在技能库打开", exact: true }).click();
  await page.getByRole("button", { name: "references/checklist.md", exact: true }).click();
  await expect(page.getByLabel("资源预览", { exact: true })).toContainText("核对清单");
});
