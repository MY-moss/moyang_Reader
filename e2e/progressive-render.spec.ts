import { expect, test, type Page } from "@playwright/test";

async function openMoreMenu(page: Page): Promise<void> {
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await page.locator(".toolbar-overflow-trigger").click();
  }
}

async function switchToRenderedMode(page: Page): Promise<void> {
  await openMoreMenu(page);
  const sourceButton = page.getByRole("button", { name: "源文本", exact: true });
  if ((await sourceButton.count()) > 0) {
    await sourceButton.click();
    await openMoreMenu(page);
  }
  const readingButton = page.getByRole("button", { name: "阅读", exact: true });
  if ((await readingButton.count()) > 0) await readingButton.click();
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) !== null) await page.locator(".toolbar-overflow-trigger").click();
}

test("loads KaTeX styles only when a formula is rendered", async ({ page }) => {
  const stylesheetRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "stylesheet") stylesheetRequests.push(request.url());
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "plain-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 普通文档\n\n这里没有公式。"),
  });
  await switchToRenderedMode(page);
  await expect(page.locator(".reader-content")).toContainText("这里没有公式。");
  expect(stylesheetRequests.some((url) => /katex/i.test(url))).toBe(false);

  await page.locator('input[type="file"]').setInputFiles({
    name: "formula-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 公式文档\n\n$$x^2 + y^2 = z^2$$"),
  });
  await switchToRenderedMode(page);
  await expect(page.locator(".reader-content .katex")).toBeVisible();
  await expect.poll(() => stylesheetRequests.some((url) => /katex/i.test(url))).toBe(true);
});

test("mounts large reader content incrementally and eventually exposes every heading", async ({ page }) => {
  await page.goto("/");
  const paragraph = "渐进渲染性能测试。".repeat(3_000);
  const sections = Array.from({ length: 120 }, (_, index) => `## 第 ${index + 1} 节\n\n${paragraph}\n\n`).join("");
  await page.locator('input[type="file"]').setInputFiles({
    name: "large-progressive-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# 大文档\n\n${sections}`),
  });
  await switchToRenderedMode(page);

  const reader = page.locator('[data-progressive-reader="true"]');
  await expect(reader).toHaveAttribute("data-progressive-reader-ready", "false");
  const mountedCount = Number(await reader.getAttribute("data-progressive-reader-mounted"));
  const totalCount = Number(await reader.getAttribute("data-progressive-reader-total"));
  expect(mountedCount).toBeGreaterThan(0);
  expect(mountedCount).toBeLessThan(totalCount);
  expect(totalCount).toBeGreaterThan(30);

  await expect(reader).toHaveAttribute("data-progressive-reader-ready", "true", { timeout: 8_000 });
  await expect(page.locator(".reader-content h2")).toHaveCount(120);
});
