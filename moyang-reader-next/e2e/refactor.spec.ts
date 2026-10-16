import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("opens Markdown for editing and switches explicitly to reading", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "书房笔记.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 留一点时间给阅读\n\n这是一个只保存在本地的阅读空间。\n\n## 阅读之后\n\n可以继续编辑。"),
  });
  await expect(page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" })).toBeVisible();
  await page.getByRole("button", { name: "直接返回阅读模式" }).click();
  await expect(page.locator(".reader-content h1")).toHaveText("留一点时间给阅读");
  await page.screenshot({ path: "docs/screenshots/reader-light.png", fullPage: true });
  await expect(page.locator(".wysiwyg-editor")).toHaveCount(0);
  await page.getByRole("button", { name: "直接进入编辑模式" }).click();
  await expect(page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" })).toBeVisible();
  await page.keyboard.press("Control+E");
  await expect(page.locator(".reader-content")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  test(`bookroom layout and accessibility in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/welcome-${theme}.png`, fullPage: true });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await page.setViewportSize({ width: 720, height: 700 });
    await expect(page.locator(".toolbar-overflow-trigger")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/compact-${theme}.png`, fullPage: true });
  });
}
