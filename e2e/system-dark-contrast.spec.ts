import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { clickToolbarAction, switchToRenderedMode } from "./helpers";

async function audit(page: Page, selector: string, state: string, forced: boolean, wholePage = true) {
  const text = await page.locator(selector).evaluateAll((nodes) => {
    const luminance = (color: string) =>
      color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .reduce((sum, channel, index) => {
          const value = channel / 255;
          return (
            sum +
            (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]
          );
        }, 0);
    return nodes
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const style = getComputedStyle(node);
        let parent: Element | null = node;
        let background = "rgb(255, 255, 255)";
        while (parent) {
          const candidate = getComputedStyle(parent).backgroundColor;
          if (candidate !== "transparent" && candidate !== "rgba(0, 0, 0, 0)") {
            background = candidate;
            break;
          }
          parent = parent.parentElement;
        }
        const foregroundLuminance = luminance(style.color);
        const backgroundLuminance = luminance(background);
        return {
          className: node.className,
          emphasis: node.matches(".tab-item.active .tab-name, .quick-open-kind, .focus-reading-progress-value"),
          color: style.color,
          background,
          fontSize: style.fontSize,
          ratio:
            (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
            (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
        };
      });
  });
  // Loaded reader and focus mode retain unfiltered whole-page Axe. Quick-open
  // has a separate pre-existing recent-badge defect (#565); inspect D32's consumer
  // without claiming that dialog's unrelated surface is already AA compliant.
  const results = wholePage ? await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze() : null;
  await test.info().attach(state, {
    body: JSON.stringify({ text, wholePage, violations: results?.violations }, null, 2),
    contentType: "application/json",
  });
  expect(text.length).toBeGreaterThan(0);
  for (const node of text) {
    expect(node.ratio, `${state}: ${node.className}`).toBeGreaterThanOrEqual(4.5);
    // The legacy quick-open kind badge is 9px (#565); D32
    // changes its theme contrast, not typography. Tab/progress text stays 12px+.
    if (node.className !== "quick-open-kind") expect(Number.parseFloat(node.fontSize)).toBeGreaterThanOrEqual(12);
    if (!forced && node.emphasis) {
      // Assert the real consumers, not just the root variable's raw value.
      expect(node.color).toBe("rgb(155, 226, 217)");
    }
  }
  if (results)
    expect(results.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

for (const theme of ["ink", "system-dark"] as const) {
  for (const forced of [false, true]) {
    for (const width of [1240, 900, 720]) {
      test(`keeps dark emphasis readable: ${theme}${forced ? " forced" : ""} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 600 });
        await page.emulateMedia({
          colorScheme: "dark",
          forcedColors: forced ? "active" : "none",
          reducedMotion: "reduce",
        });
        await page.goto("/");
        await expect(page.locator(".empty-state")).toBeVisible();
        await page.evaluate((selected) => {
          if (selected === "system-dark") document.documentElement.removeAttribute("data-theme");
          else document.documentElement.dataset.theme = selected;
        }, theme);
        await page.locator('input[type="file"]').setInputFiles(
          ["one", "two"].map((name) => ({
            name: `深色标签-${name}.txt`,
            mimeType: "text/plain",
            buffer: Buffer.from(`Dark ${name}\n\n真实本地文档与键盘导航。`),
          })),
        );
        const labels = page.locator(".tab-label");
        await expect(labels).toHaveCount(2);
        const active = page.locator('.tab-label[aria-pressed="true"]');
        const initialName = await active.textContent();
        await active.focus();
        await page.keyboard.press("ArrowRight");
        await expect(page.locator('.tab-label[aria-pressed="true"]')).toBeFocused();
        await expect(page.locator('.tab-label[aria-pressed="true"]')).not.toHaveText(initialName!);
        await page.keyboard.press("ArrowLeft");
        await expect(page.locator('.tab-label[aria-pressed="true"]')).toBeFocused();
        await expect(page.locator('.tab-label[aria-pressed="true"]')).toHaveText(initialName!);
        await page.screenshot({ path: test.info().outputPath("tabs.png") });
        await audit(
          page,
          ".tab-item.active .tab-name, .tab-item:not(.active) .tab-name, .statusbar-version",
          "tabs",
          forced,
        );

        await page.keyboard.press("Control+P");
        await expect(page.locator(".quick-open-dialog")).toBeVisible();
        await audit(page, ".quick-open-kind", "quick-open", forced, false);
        await page.keyboard.press("Escape");
        await expect(page.locator(".quick-open-dialog")).toHaveCount(0);
        await expect(page.locator('.tab-label[aria-pressed="true"]')).toBeFocused();

        // Progress belongs to rendered reading, not the TXT source view.
        await page.locator('input[type="file"]').setInputFiles({
          name: "dark-progress.md",
          mimeType: "text/markdown",
          buffer: Buffer.from("# Dark progress\n\n专注阅读的真实进度。"),
        });
        await expect(page.locator('.tab-label[aria-pressed="true"]')).toHaveText("dark-progress.md");
        await expect(page.locator(".wysiwyg-editor")).toBeVisible();
        await switchToRenderedMode(page);
        await expect(page.getByRole("heading", { name: "Dark progress" })).toBeVisible();
        if (width === 1240) await page.getByRole("button", { name: "专注", exact: true }).click();
        else await clickToolbarAction(page, "专注");
        await expect(page.locator(".focus-reading-progress-value")).toBeVisible();
        await audit(page, ".focus-reading-progress-value", "focus", forced);
        await page.screenshot({ path: test.info().outputPath("focus.png") });
        await page.keyboard.press("Escape");
        await expect(page.locator(".focus-reading-progress")).toHaveCount(0);
      });
    }
  }
}
