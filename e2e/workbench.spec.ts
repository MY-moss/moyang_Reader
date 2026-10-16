import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("narrow navigation contains focus, closes with Escape and restores desktop controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.setViewportSize({ width: 720, height: 900 });
  const opener = page.getByRole("button", { name: "显示导航", exact: true });
  await opener.click();
  const navigation = page.getByRole("dialog", { name: "工作台导航" });
  await expect(navigation).toBeVisible();
  await expect(page.locator(".workbench-main")).toHaveAttribute("inert", "");
  await navigation.getByLabel("界面密度").focus();
  await page.keyboard.press("Tab");
  await expect(navigation.getByLabel("工作空间", { exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(navigation.getByLabel("界面密度")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".workbench-sidebar")).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator(".workbench-main")).not.toHaveAttribute("inert", "");
  await opener.click();
  await navigation.getByLabel("工作空间", { exact: true }).selectOption("ai");
  await expect(page.locator(".ai-space")).toBeVisible();
  await page.keyboard.press("Control+Shift+B");
  await expect(navigation).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("complementary", { name: "工作台导航" })).toBeVisible();
  await expect(page.locator(".workbench-main")).not.toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await expect(page.getByRole("region", { name: "插件市场" })).toBeVisible();
});

test("typing at a block gap keeps the text and the first heading", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "块间输入.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 标题保持\n\n---\n\n| 名称 |\n| --- |\n| 内容 |\n\n结尾文字"),
    });
  const editor = page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" });
  await expect(page.locator(".wysiwyg-editor")).toHaveAttribute("aria-busy", "false");
  await editor.evaluate((element) => {
    (element as HTMLElement).focus();
    window.getSelection()?.setPosition(element, 2);
  });
  await page.keyboard.type("gap-input");
  await expect(editor).toContainText("gap-input");
  await expect(editor.locator("h1")).toHaveText("标题保持");
});

test("keeps drafts through document, pane and space switches", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const upload = page.locator('input[type="file"]').first();
  await upload.setInputFiles({
    name: "第一份.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 第一份\n\n最初的文字。"),
  });
  let editor = page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("保留这段修改");
  await expect(page.getByText("有未保存修改", { exact: true }).first()).toBeVisible();
  await upload.setInputFiles({
    name: "第二份.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 第二份\n\n用于并排阅读。"),
  });
  await expect(editor).toContainText("第二份");
  await page.getByRole("button", { name: "第一份.md", exact: true }).click();
  await expect(editor).toContainText("保留这段修改");
  await page.getByRole("button", { name: "双窗格", exact: true }).click();
  await expect(page.locator(".reader-pane")).toHaveCount(2);
  await page.getByRole("button", { name: "在此窗格工作" }).click();
  await page
    .getByRole("region", { name: "右侧文档窗格" })
    .getByRole("button", { name: "第一份.md", exact: true })
    .click();
  await expect(editor).toContainText("保留这段修改");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("两侧同步的最新修改");
  await expect(page.getByRole("region", { name: "左侧文档窗格" }).locator(".reader-content")).toContainText(
    "两侧同步的最新修改",
  );
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await expect(page.locator(".ai-space")).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("region", { name: "设置", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("reader");
  editor = page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" });
  await expect(editor).toContainText("保留这段修改");
  expect(errors).toEqual([]);
});

test("workbench layout remains usable at the supported widths", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "阅读与思考.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# 阅读与思考\n\n把注意力留给内容。每一段文字，都可以成为下一次思考的起点。\n\n## 整理线索\n\n- 保留出处\n- 建立联系\n- 回到问题本身\n\n## 留下一点空间\n\n清晰的结构帮助我们理解复杂的内容。",
      ),
    });
  await expect(page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" })).toBeVisible();
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1440, 1280, 900, 720]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/workbench/reader-${colorScheme}-${width}.png` });
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await expect(page.locator(".ai-space")).toBeVisible();
  await page.screenshot({ path: "artifacts/workbench/ai-1440.png" });
});
