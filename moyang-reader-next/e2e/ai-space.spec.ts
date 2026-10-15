import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import JSZip from "jszip";
import fs from "node:fs/promises";
async function openAi(page: Page) {
  await page.goto("/");
  if (!(await page.getByRole("combobox", { name: "工作空间", exact: true }).isVisible()))
    await page.locator(".sidebar-toggle").click();
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await expect(page.getByRole("heading", { name: "知识库", exact: true })).toBeVisible();
}
async function create(page: Page, title: string, body: string) {
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill(title);
  await page.getByLabel("正文", { exact: true }).fill(body);
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await expect(page.locator(".ai-document h1")).toHaveText(title);
}
test("knowledge persists after reload and revisions can be restored", async ({ page }) => {
  await openAi(page);
  await create(page, "本地知识测试", "# 来源清楚\n\n保存独立的知识资料。");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("正文", { exact: true }).fill("# 更新知识\n\n这是第二个版本。");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await page.getByRole("button", { name: "查看历史", exact: true }).click();
  await page.locator(".ai-history summary").filter({ hasText: "版本 1" }).click();
  await page.getByRole("button", { name: "恢复这个版本" }).click();
  await expect(page.locator(".ai-prose")).toContainText("保存独立的知识资料");
  await page.reload();
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-record-button").filter({ hasText: "本地知识测试" }).click();
  await expect(page.locator(".ai-prose")).toContainText("保存独立的知识资料");
});
test("memories merge, archive and restore without losing the originals", async ({ page }) => {
  await openAi(page);
  await page.locator(".ai-sidebar nav button").filter({ hasText: "长期记忆" }).click();
  await create(page, "语言偏好", "喜欢中文回答。");
  await create(page, "表达偏好", "喜欢简洁短句。");
  await page.getByLabel("选择记忆：语言偏好", { exact: true }).check();
  await page.getByLabel("选择记忆：表达偏好", { exact: true }).check();
  await page.getByRole("button", { name: "合并所选 2 条" }).click();
  await page.getByLabel("正文", { exact: true }).fill("使用简洁中文回答。");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await expect(page.locator(".ai-document h1")).toHaveText("整理后的记忆");
  await page.getByLabel("已归档", { exact: true }).check();
  await expect(page.locator(".ai-record-button")).toHaveCount(2);
  await page.locator(".ai-record-button").filter({ hasText: "语言偏好" }).click();
  await page.getByRole("button", { name: "恢复使用", exact: true }).click();
  await page.getByLabel("已归档", { exact: true }).uncheck();
  await expect(page.locator(".ai-record-button")).toHaveCount(2);
});
test("imports a portable skill and exports a real resource archive", async ({ page }) => {
  await openAi(page);
  await page.locator(".ai-sidebar nav button").filter({ hasText: "技能库" }).click();
  await page.locator('.ai-page-header input[type="file"]').setInputFiles({
    name: "SKILL.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "---\nname: weekly-review\ndescription: 每周复盘时使用\nlicense: MIT\n---\n\n# 复盘\n1. 回顾进展\n2. 提炼经验\n",
    ),
  });
  await expect(page.getByLabel("技能名称", { exact: true })).toHaveValue("weekly-review");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出技能包", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("weekly-review.zip");
  expect(await file.path()).toBeTruthy();
});
test("space switching preserves both reading and AI drafts", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "reader-draft.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 我的草稿\n\n原始内容"),
  });
  await page.getByRole("button", { name: "源文本模式", exact: true }).click();
  const editor = page.locator(".source-editor .cm-content");
  await editor.fill("# 未保存的书房草稿");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill("未完成知识");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("reader");
  await expect(editor).toContainText("未保存的书房草稿");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("未完成知识");
});
test("backup download and import report skips, without mixing reader notes", async ({ page }) => {
  await openAi(page);
  await create(page, "备份资料", "来源可以追溯。");
  await page.getByRole("button", { name: /接入与备份/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  const file = await download;
  await page.locator('.ai-connections input[type="file"]').setInputFiles((await file.path())!);
  await expect(page.getByRole("status")).toContainText("跳过 1 条");
  await expect(page.locator(".ai-connections")).toContainText("浏览器预览使用独立存储");
});
for (const narrow of [false, true])
  test(`AI interface accessibility and navigation ${narrow ? "compact" : "wide"}`, async ({ page }) => {
    await page.setViewportSize({ width: narrow ? 760 : 1320, height: 900 });
    await openAi(page);
    await create(page, "可访问知识", "## 内容\n\n可用键盘阅读与编辑。");
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      audit.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (narrow) {
      await page.getByRole("button", { name: "← 返回列表" }).click();
      await expect(page.getByRole("region", { name: "AI 内容列表" })).toBeVisible();
    }
  });

test("skill ZIP roundtrip preserves scripts, metadata and binary assets", async ({ page }) => {
  const zip = new JSZip();
  zip.file(
    "test-skill/SKILL.md",
    "---\nname: test-skill\ndescription: 资料检查\nlicense: MIT\n---\n\n执行 scripts/check.py，参考 assets/sample.bin。",
  );
  zip.file("test-skill/scripts/check.py", "print('中文资源')\n");
  zip.file("test-skill/assets/sample.bin", Buffer.from([0, 255, 3, 128]));
  await openAi(page);
  await page.locator(".ai-sidebar nav button").filter({ hasText: "技能库" }).click();
  await page.locator('.ai-page-header input[type="file"]').setInputFiles({
    name: "test-skill.zip",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await expect(page.locator(".ai-document h1")).toHaveText("test-skill");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出技能包" }).click();
  const file = await downloading;
  const exported = await JSZip.loadAsync(await fs.readFile((await file.path())!));
  expect(await exported.file("test-skill/scripts/check.py")!.async("string")).toBe("print('中文资源')\n");
  expect(await exported.file("test-skill/assets/sample.bin")!.async("nodebuffer")).toEqual(
    Buffer.from([0, 255, 3, 128]),
  );
  expect(await exported.file("test-skill/SKILL.md")!.async("string")).toContain("license: MIT");
});

test("AI dark mode, editor and connection page are accessible", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openAi(page);
  await create(page, "深色资料", "# 检查\n\n阅读与检索。");
  const audit = async () => {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  };
  await audit();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await audit();
  await page.getByRole("button", { name: /接入与备份/ }).click();
  await audit();
});
