import { expect, test } from "@playwright/test";

for (const width of [900, 1440]) {
  test(`opens hidden document properties at ${width}px and preserves the edited body`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "hidden-properties.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Body remains\n\nOriginal paragraph."),
      });
    await expect(page.locator(".document-title")).toContainText("hidden-properties.md");
    const hide = page.getByRole("button", { name: "隐藏上下文", exact: true });
    if (await hide.isVisible()) await hide.click();
    await expect(page.getByRole("tab", { name: "属性", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "显示上下文", exact: true }).click();
    await page.getByRole("tab", { name: "属性", exact: true }).click();
    await page.getByRole("button", { name: "编辑文档属性", exact: true }).click();
    await page.getByPlaceholder("文档的显示标题").fill("Visible properties");
    await page.getByRole("button", { name: "应用到文档", exact: true }).click();
    await expect(page.locator(".source-editor")).toContainText("title: Visible properties");
    await expect(page.locator(".source-editor")).toContainText("Original paragraph.");
  });
}

test("edits nested document properties with validation and preserves the body", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "属性.md", mimeType: "text/markdown", buffer: Buffer.from("# 正文不可丢失\n\n原有段落。") });
  await page.getByRole("tab", { name: "属性", exact: true }).click();
  await page.getByRole("button", { name: "编辑文档属性", exact: true }).click();
  await page.getByText("更多属性与源格式", { exact: true }).click();
  const input = page.getByRole("textbox", { name: "YAML 属性" });
  await input.fill("title: [invalid");
  await page.getByRole("button", { name: "应用到文档" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await input.fill("title: 我的笔记\ntags: [阅读, 资料]\ncustom:\n  level: 2");
  await page.getByRole("button", { name: "应用到文档" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".source-editor")).toContainText("custom:");
  await expect(page.locator(".source-editor")).toContainText("正文不可丢失");
  await page.keyboard.press("Control+E");
  await expect(page.locator(".reader-content h1")).toHaveText("正文不可丢失");
});

test("persists reading fonts and export templates and finds commands by pinyin", async ({ page }) => {
  await page.goto("/");
  await page.locator(".toolbar-overflow-trigger").click();
  await page.locator(".settings-trigger").click();
  await page.getByLabel("正文字体", { exact: true }).selectOption("sans");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("编辑字体", { exact: true }).selectOption("system");
  await page.getByRole("button", { name: "导出版式", exact: true }).click();
  await page.getByRole("combobox", { name: "导出版式", exact: true }).selectOption("report");
  await page.reload();
  await page.locator(".toolbar-overflow-trigger").click();
  await page.locator(".settings-trigger").click();
  await expect(page.getByLabel("正文字体", { exact: true })).toHaveValue("sans");
  await page.getByRole("button", { name: "导出版式", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "导出版式", exact: true })).toHaveValue("report");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Shift+P");
  await page.getByRole("combobox", { name: "搜索命令" }).fill("ksdk");
  await expect(page.getByRole("option", { name: /快速打开/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Shift+P");
  await expect(page.getByRole("dialog", { name: "命令面板" }).getByRole("option").first()).toContainText("快速打开");
});

test("renders block anchors and bounded document embeds", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "块引用.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 块引用\n\n一段重要原文。 ^idea\n\n[[#^idea|回到原文]]\n\n![[#^idea]]"),
  });
  await page.getByRole("button", { name: "直接返回阅读模式", exact: true }).click();
  await expect(page.locator("#block-idea")).toContainText("一段重要原文");
  await expect(page.locator(".document-embed")).toContainText("一段重要原文");
  await page.getByRole("link", { name: "回到原文" }).click();
  await expect(page.locator(".reader-content h1")).toHaveText("块引用");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
