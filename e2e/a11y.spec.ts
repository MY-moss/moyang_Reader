import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const THEME_TOKENS = ["--ink", "--muted", "--accent-deep", "--accent-warm", "--danger", "--surface"] as const;

type ThemeName = "light" | "dark";
type ThemeTokens = Record<(typeof THEME_TOKENS)[number], string>;

const CONTRAST_PAIRS = [
  { name: "正文", foreground: "--ink", background: "--surface" },
  { name: "辅助文字", foreground: "--muted", background: "--surface" },
  { name: "链接文字", foreground: "--accent-deep", background: "--surface" },
  { name: "暖色状态", foreground: "--accent-warm", background: "--surface" },
  { name: "错误状态", foreground: "--danger", background: "--surface" },
] as const;

function parseCssColor(value: string): [number, number, number] {
  const normalized = value.trim();
  const hex = normalized.match(/^#([\da-f]{6})$/i);
  if (hex) {
    return [0, 1, 2].map((index) => Number.parseInt(hex[1].slice(index * 2, index * 2 + 2), 16)) as [
      number,
      number,
      number,
    ];
  }

  const rgb = normalized.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`无法解析颜色：${value}`);
}

function relativeLuminance(value: string): number {
  return parseCssColor(value)
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

async function switchToRenderedMode(page: Page): Promise<void> {
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) await page.locator(".toolbar-overflow-trigger").click();
  await page.getByRole("button", { name: "源文本", exact: true }).click();
  if ((await menu.getAttribute("open")) === null) await page.locator(".toolbar-overflow-trigger").click();
  await page.getByRole("button", { name: "阅读", exact: true }).click();
  if ((await menu.getAttribute("open")) !== null) await page.locator(".toolbar-overflow-trigger").click();
}

async function expectNoSeriousA11yViolations(page: Page, state: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  await test.info().attach(`axe-${state}`, {
    body: JSON.stringify({ state, violations: results.violations }, null, 2),
    contentType: "application/json",
  });
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

async function loadReaderFixture(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "a11y-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 可访问性测试\n\n正文内容"),
  });
  await expect(page.getByRole("heading", { name: "可访问性测试" })).toBeVisible();
}

async function openSettings(page: Page): Promise<void> {
  const overflow = page.locator(".toolbar-overflow");
  if ((await overflow.getAttribute("open")) === null) await page.locator(".toolbar-overflow-trigger").click();
  await page.locator(".topbar .settings-menu summary", { hasText: "设置" }).click();
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).toBeVisible();
}

test("keeps the empty state free of serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".empty-state")).toBeVisible();
  await expectNoSeriousA11yViolations(page, "empty-state");
});

test("keeps the reader state free of serious accessibility violations", async ({ page }) => {
  await loadReaderFixture(page);
  await switchToRenderedMode(page);
  await expectNoSeriousA11yViolations(page, "reader");
});

test("keeps the quick-open dialog free of serious accessibility violations", async ({ page }) => {
  await loadReaderFixture(page);
  await page.keyboard.press("Control+P");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "quick-open");
});

test("keeps the settings panel free of serious accessibility violations", async ({ page }) => {
  await loadReaderFixture(page);
  await openSettings(page);
  await expect(page.getByRole("button", { name: "导出设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "导入设置" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "settings");
});

test("keeps light and dark theme tokens at WCAG AA contrast", async ({ page }) => {
  await page.goto("/");
  const themes: ThemeName[] = ["light", "dark"];

  for (const theme of themes) {
    await page.evaluate((themeName) => {
      document.documentElement.dataset.theme = themeName;
    }, theme);
    const tokens = await page.evaluate((names) => {
      const styles = getComputedStyle(document.documentElement);
      return Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim()])) as ThemeTokens;
    }, THEME_TOKENS);

    for (const pair of CONTRAST_PAIRS) {
      const ratio = contrastRatio(tokens[pair.foreground], tokens[pair.background]);
      expect(ratio, `${theme} ${pair.name} 对比度不足：${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("keeps the empty state usable in Windows high-contrast mode", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await expect(page.locator(".empty-state")).toBeVisible();
  const forcedColors = await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches);
  expect(forcedColors).toBe(true);
  await expectNoSeriousA11yViolations(page, "forced-colors");

  const probe = await page.evaluate(() => {
    const element = document.createElement("span");
    element.style.color = "var(--ink)";
    element.style.backgroundColor = "var(--surface)";
    element.textContent = "对比度探针";
    document.body.append(element);
    const styles = getComputedStyle(element);
    const result = { foreground: styles.color, background: styles.backgroundColor };
    element.remove();
    return result;
  });
  expect(contrastRatio(probe.foreground, probe.background)).toBeGreaterThanOrEqual(4.5);
});
