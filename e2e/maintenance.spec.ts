import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("quick open stays readable and keyboard usable in system and explicit themes", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "查找资料.txt", mimeType: "text/plain", buffer: Buffer.from("两份独立测试资料") },
      { name: "最近阅读.txt", mimeType: "text/plain", buffer: Buffer.from("仅用于界面测试") },
    ]);
  for (const mode of ["light", "dark", "explicit-dark"] as const) {
    await page.emulateMedia({ colorScheme: mode === "light" ? "light" : "dark" });
    await page.evaluate((theme) => {
      if (theme === "explicit-dark") document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
    }, mode);
    for (const width of [1280, 900, 720]) {
      await page.setViewportSize({ width, height: 800 });
      await page.keyboard.press("Control+p");
      const dialog = page.getByRole("dialog", { name: "快速打开", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("option")).toHaveCount(2);
      await expect(dialog.locator(".quick-open-kind").first()).toHaveText("TXT");
      for (const cls of [".quick-open-kind", ".quick-open-recent", ".quick-open-copy small"]) {
        expect(
          await dialog
            .locator(cls)
            .first()
            .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
        ).toBeGreaterThanOrEqual(12);
      }
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 720 && mode === "dark") await page.screenshot({ path: "artifacts/workbench/quick-open-dark.png" });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  }
  await page.emulateMedia({ forcedColors: "active" });
  await page.keyboard.press("Control+p");
  await expect(page.getByRole("searchbox", { name: "快速打开文档" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "快速打开", exact: true })).toHaveCount(0);
});

test("editor mounts with its current document through repeated width and navigation changes", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  for (const width of [720, 960, 1180, 720, 960, 1180]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: `ready-${width}.md`,
        mimeType: "text/markdown",
        buffer: Buffer.from(`# Ready ${width}\n\n本轮内容 ${width}`),
      });
    const editor = page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" });
    await expect(editor).toBeVisible();
    await expect(editor.locator("h1")).toHaveText(`Ready ${width}`);
    await expect(editor).toContainText(`本轮内容 ${width}`);
  }
  expect(failures).toEqual([]);
});
