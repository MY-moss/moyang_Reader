import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openSettingsMenu, switchToRenderedMode } from "./helpers";

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

async function loadDraftComparison(page: Page, theme: Theme, width = 1240, english = false): Promise<Locator> {
  await page.setViewportSize({ width, height: width === 720 ? 600 : 820 });
  await page.addInitScript((useEnglish) => {
    if (useEnglish) localStorage.setItem("moyang-reader-locale", "en-US");
    localStorage.setItem(
      "moyang-reader-drafts",
      JSON.stringify([
        {
          path: "C:/Notes/visual-baseline.md",
          draft: "# Visual baseline\n\nA recoverable local draft",
          baseSource: "# Visual baseline\n\nOriginal file content",
          savedAt: Date.now() - 60_000,
        },
      ]),
    );
  }, english);
  await page.goto("/");
  await setTheme(page, theme);
  if (width <= 900) {
    await page.locator(".toolbar-overflow-trigger").click();
    await page.locator(".toolbar-overflow-panel .recovery-button").click();
  } else {
    await page.locator(".toolbar-optional.recovery-button").click();
  }
  const center = page.getByRole("dialog", { name: english ? "Unsaved drafts" : "未保存草稿" });
  await expect(center).toBeVisible();
  await center
    .getByRole("button", { name: english ? /Review the differences/ : /查看 .*当前文件与草稿的差异/ })
    .click();
  const comparison = page.getByRole("dialog", {
    name: english ? "Review differences before recovery" : "恢复前查看差异",
  });
  await expect(comparison).toBeVisible();
  return comparison;
}

async function expectStateScreenshot(
  locator: Locator,
  name: string,
  theme: Theme,
  options: { maxDiffPixelRatio?: number } = {},
): Promise<void> {
  await expect(locator).toHaveScreenshot(`${name}-${theme}.png`, {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixels: options.maxDiffPixelRatio ? undefined : 200,
    maxDiffPixelRatio: options.maxDiffPixelRatio,
  });
}

for (const theme of THEMES) {
  test(`captures the empty state baseline (${theme})`, async ({ page }) => {
    await page.setViewportSize(VISUAL_VIEWPORT);
    await page.goto("/");
    await setTheme(page, theme);
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
    const emptyLogo = emptyState.locator(".empty-logo");
    await expect(emptyLogo).toBeVisible();
    await expect
      .poll(() => emptyLogo.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    // The empty state contains localized display text. Keep the baseline strict
    // for layout and appearance while allowing the small amount of glyph
    // rasterization variance between Windows font installations.
    await expectStateScreenshot(emptyState, "empty-state", theme, { maxDiffPixelRatio: 0.01 });
  });

  test(`captures settings and first-use guidance (${theme})`, async ({ page }) => {
    await page.setViewportSize(VISUAL_VIEWPORT);
    await page.goto("/");
    await setTheme(page, theme);
    await openSettingsMenu(page);
    await expectStateScreenshot(page.locator(".toolbar-overflow-panel"), "settings-panel", theme);
    await page.locator(".empty-state").getByRole("button", { name: "查看使用教程" }).click();
    await expectStateScreenshot(page.getByRole("dialog", { name: "从本地文档开始" }), "getting-started", theme);
  });

  test(`captures the reader state baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "reader");
    await expectStateScreenshot(page.locator(".reader-content"), "reader-content", theme);
  });

  test(`captures the application shell baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "reader");
    await expectStateScreenshot(page.locator(".app-shell"), "application-shell", theme, { maxDiffPixelRatio: 0.01 });
  });

  test(`captures the focus reading baseline (${theme})`, async ({ page }) => {
    await loadDocument(page, theme, "reader");
    await page.getByRole("button", { name: "专注", exact: true }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/focus-mode/);
    await expectStateScreenshot(page.locator(".app-shell"), "focus-reading", theme, { maxDiffPixelRatio: 0.01 });
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

  test(`captures the draft recovery comparison baseline (${theme})`, async ({ page }) => {
    const dialog = await loadDraftComparison(page, theme);
    await expectStateScreenshot(dialog, "draft-comparison-dialog", theme);
  });
}

test("keeps English draft recovery usable at 720×600", async ({ page }) => {
  const dialog = await loadDraftComparison(page, "light", 720, true);
  await expect(dialog.getByRole("button", { name: "Close differences for Draft" })).toBeFocused();
  await expect(dialog).toContainText("Original file when draft was saved");
  await expectStateScreenshot(dialog, "draft-comparison-dialog-720-en", "light");
  const bounds = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(720);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(600);
  const results = await new AxeBuilder({ page }).include(".draft-comparison-dialog").analyze();
  expect(results.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("keeps draft comparison keyboard and high-contrast layout usable at 900px", async ({ page }) => {
  const dialog = await loadDraftComparison(page, "dark", 900);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("region", { name: "差异详情" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "关闭草稿差异" })).toBeFocused();
  const metrics = await dialog.evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    const actions = Array.from(node.querySelectorAll<HTMLButtonElement>("button"));
    return {
      left: bounds.left,
      right: bounds.right,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      shortButtons: actions.filter((button) => button.getBoundingClientRect().height < 32).length,
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(900);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.shortButtons).toBe(0);
});

test("captures the compact settings and first-use layout", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 600 });
  await page.goto("/");
  await setTheme(page, "light");
  await expectStateScreenshot(page.locator(".app-shell"), "first-use-shell-720", "light");
  await openSettingsMenu(page);
  await expectStateScreenshot(page.locator(".toolbar-overflow-panel"), "settings-panel-720", "light");
  await page.locator(".settings-menu").getByRole("button", { name: "查看使用教程" }).click();
  await expectStateScreenshot(page.getByRole("dialog", { name: "从本地文档开始" }), "getting-started-720", "light");
});

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

    await page.keyboard.press("Control+Shift+Enter");
    await expect(page.locator(".app-shell")).toHaveClass(/focus-mode/);
    const focusMetrics = await page.evaluate(() => {
      const progress = document.querySelector<HTMLElement>(".focus-reading-progress-copy")?.getBoundingClientRect();
      const exit = document.querySelector<HTMLElement>(".focus-exit")?.getBoundingClientRect();
      const reader = document.querySelector<HTMLElement>(".reader-content")?.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        progressRight: progress?.right,
        exitLeft: exit?.left,
        readerLeft: reader?.left,
        readerRight: reader?.right,
      };
    });
    expect(focusMetrics.bodyScrollWidth).toBeLessThanOrEqual(focusMetrics.viewportWidth);
    expect(focusMetrics.progressRight).toBeLessThan(focusMetrics.exitLeft ?? 0);
    expect(focusMetrics.readerLeft).toBeGreaterThanOrEqual(0);
    expect(focusMetrics.readerRight).toBeLessThanOrEqual(focusMetrics.viewportWidth);
  }
});
