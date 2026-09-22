import { expect, test, type Page } from "@playwright/test";

const WINDOWS_WIDTHS = [720, 900, 1240] as const;
const WINDOWS_DPI_SCALES = [1, 1.25, 1.5, 2] as const;

async function loadDocument(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: `${title.toLowerCase().replaceAll(" ", "-")}.md`,
    mimeType: "text/markdown",
    buffer: Buffer.from(`# ${title}\n\n顶栏主操作应保持清晰可达。`),
  });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("keeps topbar primary actions ordered and labelled at Windows widths", async ({ page }) => {
  for (const width of WINDOWS_WIDTHS) {
    await page.setViewportSize({ width, height: 820 });
    await loadDocument(page, `Windows width ${width}`);

    const toolbar = page.getByRole("navigation", { name: "文档主要操作" });
    const visibleLabels = await toolbar
      .locator(":scope > .toolbar-group > button:visible")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent?.replace(/\s+/g, " ").trim()),
      );
    const expectedLabels =
      width >= 1240
        ? ["打开", "快速打开", "直接返回阅读模式", "保存当前文档", "侧栏", "隐藏上下文", "专注", "文内查找"]
        : ["打开", "保存当前文档", "侧栏", "隐藏上下文", "文内查找"];
    expect(visibleLabels).toEqual(expectedLabels);

    const saveButton = toolbar.getByRole("button", { name: "保存当前文档" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(saveButton).toHaveAttribute("aria-keyshortcuts", "Control+S");
    await expect(saveButton).toHaveAttribute("title", "保存当前文档 (Ctrl+S)");

    await toolbar.locator(".toolbar-overflow-trigger").click();
    await expect(
      toolbar.locator(".toolbar-overflow-panel").getByRole("button", { name: "保存", exact: true }),
    ).toHaveCount(0);
    await toolbar.locator(".toolbar-overflow-trigger").click();

    const metrics = await page.evaluate(() => {
      const toolbarElement = document.querySelector<HTMLElement>(".toolbar");
      return {
        viewportWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        toolbarClientWidth: toolbarElement?.clientWidth ?? 0,
        toolbarScrollWidth: toolbarElement?.scrollWidth ?? 0,
      };
    });
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);
  }
});

test("promotes the visible save action when the document has unsaved edits", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await loadDocument(page, "Modified document");

  const saveButton = page.getByRole("button", { name: "保存当前文档" });
  await expect(saveButton).toBeDisabled();

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" 新增内容");

  await expect(saveButton).toBeEnabled();
  await expect(saveButton).toHaveClass(/primary/);
});

test("keeps primary topbar controls inside the viewport at Windows DPI scales", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for isolated preview testing.");
  for (const deviceScaleFactor of WINDOWS_DPI_SCALES) {
    for (const width of WINDOWS_WIDTHS) {
      const context = await browser.newContext({
        baseURL,
        deviceScaleFactor,
        viewport: { width, height: 820 },
      });
      try {
        const page = await context.newPage();
        await loadDocument(page, `DPI ${deviceScaleFactor} width ${width}`);

        const geometry = await page.evaluate(() => {
          const toolbar = document.querySelector<HTMLElement>(".toolbar");
          const toolbarRect = toolbar?.getBoundingClientRect();
          const controls = Array.from(
            document.querySelectorAll<HTMLElement>(
              ".toolbar > .toolbar-group > button, .toolbar > .toolbar-group > details",
            ),
          )
            .filter((element) => getComputedStyle(element).display !== "none")
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            });
          return {
            bodyScrollWidth: document.body.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            toolbarClientWidth: toolbar?.clientWidth ?? 0,
            toolbarScrollWidth: toolbar?.scrollWidth ?? 0,
            toolbarLeft: toolbarRect?.left ?? 0,
            toolbarRight: toolbarRect?.right ?? 0,
            controls,
          };
        });

        expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.toolbarScrollWidth).toBe(geometry.toolbarClientWidth);
        expect(
          geometry.controls.every(
            ({ left, right, top, bottom }) =>
              left >= geometry.toolbarLeft - 1 && right <= geometry.toolbarRight + 1 && right > left && bottom > top,
          ),
        ).toBe(true);
      } finally {
        await context.close();
      }
    }
  }
});
