import { expect, test, type Locator, type Page } from "@playwright/test";
import { switchToRenderedMode } from "./helpers";

const VISUAL_VIEWPORT = { width: 1240, height: 820 } as const;
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const VISUAL_DOCUMENT = {
  name: "visual-baseline.md",
  mimeType: "text/markdown",
  buffer: Buffer.from(
    "# Visual baseline\n\n## Reading context\n\nA stable local document for visual regression with **bold** text and a [link](https://example.com).\n\n- First item\n- Second item",
  ),
};

async function freezeVisualMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, forcedColors: "none", reducedMotion: "reduce" });
  await page.evaluate((themeName) => {
    document.documentElement.dataset.theme = themeName;
  }, theme);
  await freezeVisualMotion(page);
}

async function loadDocument(page: Page, theme: Theme, mode: "editor" | "reader"): Promise<void> {
  await page.setViewportSize(VISUAL_VIEWPORT);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(VISUAL_DOCUMENT);
  await expect(page.getByRole("heading", { name: "Visual baseline" })).toBeVisible();
  if (mode === "reader") await switchToRenderedMode(page);
  await setTheme(page, theme);
}

async function loadReadingHistoryConfirmation(page: Page, theme: Theme): Promise<Locator> {
  await page.setViewportSize(VISUAL_VIEWPORT);
  await page.addInitScript(() => {
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "moyang-reader-reading-history",
      JSON.stringify([
        {
          path: "C:/Notes/visual-baseline.md",
          seconds: 600,
          lastReadAt: Date.now(),
          dailySeconds: { [dayKey]: 600 },
        },
      ]),
    );
  });
  await page.goto("/");
  await page.getByTestId("reading-history-clear").click();
  const dialog = page.getByRole("dialog", { name: "清理阅读记录？" });
  await expect(dialog).toBeVisible();
  await setTheme(page, theme);
  return dialog;
}

async function expectStateScreenshot(locator: Locator, name: string, theme: Theme): Promise<void> {
  await expect(locator).toHaveScreenshot(`${name}-${theme}.png`, {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixels: 200,
  });
}

for (const theme of THEMES) {
  test(`captures the empty state baseline (${theme})`, async ({ page }) => {
    await page.setViewportSize(VISUAL_VIEWPORT);
    await page.goto("/");
    await setTheme(page, theme);
    await expectStateScreenshot(page.locator(".empty-state"), "empty-state", theme);
  });

  test(`captures the reader state baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "reader");
    await expectStateScreenshot(page.locator(".reader-content"), "reader-content", theme);
  });

  test(`captures the editor state baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "editor");
    await expectStateScreenshot(page.locator(".wysiwyg-editor"), "editor-content", theme);
  });

  test(`captures the quick-open state baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "reader");
    await page.keyboard.press("Control+P");
    const dialog = page.getByRole("dialog", { name: "快速打开文件" });
    await expect(dialog).toBeVisible();
    await expectStateScreenshot(dialog, "quick-open-dialog", theme);
  });

  test(`captures the context panel baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "reader");
    const contextPanel = page.locator(".context-sidebar");
    await expect(contextPanel).toBeVisible();
    await expectStateScreenshot(contextPanel, "context-panel", theme);
  });

  test(`captures the confirmation dialog baseline (${theme})`, async ({ page }) => {
    const dialog = await loadReadingHistoryConfirmation(page, theme);
    await expectStateScreenshot(dialog, "confirmation-dialog", theme);
  });
}

test("keeps reader anchors within the compact and wide Windows viewports", async ({ page }) => {
  for (const width of [720, 1240] as const) {
    await page.setViewportSize({ width, height: 820 });
    await page.emulateMedia({ colorScheme: "dark", forcedColors: "none", reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(VISUAL_DOCUMENT);
    await expect(page.getByRole("heading", { name: "Visual baseline" })).toBeVisible();
    await switchToRenderedMode(page);

    const metrics = await page.evaluate(() => {
      const selectors = [".topbar", ".sidebar", ".content-area", ".reader-content", ".context-sidebar", ".statusbar"];
      return {
        viewportWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        anchors: selectors.flatMap((selector) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return [];
          const styles = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return styles.display === "none" || styles.visibility === "hidden"
            ? []
            : [{ selector, left: rect.left, right: rect.right, width: rect.width, height: rect.height }];
        }),
      };
    });

    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(
      metrics.anchors.every(
        ({ left, right, width: anchorWidth, height }) =>
          left >= -1 && right <= metrics.viewportWidth + 1 && anchorWidth > 0 && height > 0,
      ),
    ).toBe(true);
  }
});
