import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const appearances = ["porcelain", "paper", "ink", "system-light", "system-dark"] as const;

for (const theme of appearances) {
  for (const forced of theme.startsWith("system") ? [false] : [false, true]) {
    test(`keeps stable statusbar text readable: ${theme}${forced ? " forced" : ""}`, async ({ page }) => {
      await page.emulateMedia({
        colorScheme: theme === "ink" || theme === "system-dark" ? "dark" : "light",
        forcedColors: forced ? "active" : "none",
        reducedMotion: "reduce",
      });
      await page.goto("/");
      await expect(page.locator(".empty-state")).toBeVisible();
      await page.evaluate((selected) => {
        if (selected.startsWith("system")) document.documentElement.removeAttribute("data-theme");
        else document.documentElement.dataset.theme = selected;
      }, theme);

      for (const state of ["empty", "document"] as const) {
        if (state === "document") {
          await page.locator('input[type="file"]').setInputFiles({
            name: "状态栏-本地文档-long-path-contrast-fixture.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("状态栏文字对比度测试。\nLocal document fixture."),
          });
          await expect(page.locator(".statusbar-path")).toContainText("contrast-fixture.txt");
          await expect(page.locator(".statusbar-kind")).not.toBeEmpty();
        }

        for (const width of [1240, 900, 720]) {
          await page.setViewportSize({ width, height: 600 });
          const snapshot = await page.locator(".statusbar").evaluate((bar) => {
            const background = getComputedStyle(bar).backgroundColor;
            const luminance = (color: string) => {
              const channels = color
                .match(/[\d.]+/g)!
                .slice(0, 3)
                .map(Number);
              return channels.reduce((sum, channel, index) => {
                const value = channel / 255;
                return (
                  sum +
                  (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
                    [0.2126, 0.7152, 0.0722][index]
                );
              }, 0);
            };
            const backgroundLuminance = luminance(background);
            return {
              background,
              overflow: document.documentElement.scrollWidth > window.innerWidth,
              text: Array.from(bar.querySelectorAll("span"))
                .filter((node) => node.getClientRects().length > 0)
                .map((node) => {
                  const style = getComputedStyle(node);
                  const foregroundLuminance = luminance(style.color);
                  return {
                    className: node.className,
                    color: style.color,
                    fontSize: style.fontSize,
                    ratio:
                      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
                      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
                  };
                }),
            };
          });
          // Empty shells keep the whole-page audit that exposed #560. Loaded
          // documents check this task's StatusBar; existing reader whole-page
          // audits in a11y.spec.ts remain unchanged. The separate system-dark
          // active-tab defect found by the initial whole-page diagnostic is #563.
          const audit = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
          const results = await (state === "empty" ? audit : audit.include(".statusbar")).analyze();
          await test.info().attach(`${state}-${width}`, {
            body: JSON.stringify({ theme, forced, state, width, snapshot, violations: results.violations }, null, 2),
            contentType: "application/json",
          });
          if (test.info().repeatEachIndex === 0 && state === "empty" && (width === 1240 || theme === "paper")) {
            await page.screenshot({ path: test.info().outputPath(`shell-${width}.png`) });
          }
          expect(
            results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
          ).toEqual([]);
          expect(snapshot.overflow).toBe(false);
          expect(snapshot.text.map((node) => node.className)).toContain("statusbar-path");
          for (const node of snapshot.text) {
            expect(node.ratio, `${theme} ${state} ${width} ${node.className}`).toBeGreaterThanOrEqual(4.5);
            expect(Number.parseFloat(node.fontSize)).toBeGreaterThanOrEqual(12);
          }
        }
      }
    });
  }
}
