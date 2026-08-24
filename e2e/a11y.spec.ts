import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test("keeps the landing page free of serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expectNoSeriousA11yViolations(page);
});

test("keeps the reader shell and key dialogs accessible", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "a11y-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 可访问性测试\n\n正文内容"),
  });
  await expect(page.getByRole("heading", { name: "可访问性测试" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press("Control+P");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toBeVisible();
  await page.waitForTimeout(250);
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press("Escape");

  await page.locator("summary", { hasText: "设置" }).click();
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
