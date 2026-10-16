import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 720]) {
  test(`source review preserves imported knowledge, handles manual files and scoped empty results at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (!(await page.getByRole("combobox", { name: "工作空间" }).isVisible()))
      await page.locator(".sidebar-toggle").click();
    await page.getByRole("combobox", { name: "工作空间" }).selectOption("ai");
    await page
      .locator('.ai-page-header input[type="file"]')
      .setInputFiles({ name: "来源样例.txt", mimeType: "text/plain", buffer: Buffer.from("原始资料正文") });
    await page.getByRole("button", { name: "确认导入", exact: true }).click();
    await expect(page.locator(".ai-document h1")).toHaveText("来源样例");
    if (width === 720) await page.keyboard.press("Control+Shift+B");
    await page.getByRole("button", { name: "近期活动与冲突", exact: true }).click();
    await page.getByRole("button", { name: "来源更新", exact: true }).click();
    const review = page.getByRole("region", { name: "来源更新", exact: true });
    await expect(review.getByRole("heading", { name: "来源样例" })).toBeVisible();
    await review.getByRole("button", { name: "检查全部来源（1）" }).click();
    await expect(review).toContainText("本次检查完成");
    await expect(review.locator(".ai-health-item")).toContainText("需重新选文件");
    await review.getByRole("button", { name: "查看来源", exact: true }).click();
    await review
      .locator('input[type="file"]')
      .setInputFiles({ name: "来源样例.txt", mimeType: "text/plain", buffer: Buffer.from("确认后才能替换的新正文") });
    await expect(review.locator(".version-compare pre")).toHaveText(["原始资料正文", "确认后才能替换的新正文"]);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records[0].body);
    expect(before).toBe("原始资料正文");
    await review.getByRole("button", { name: "更新快照并保留历史" }).click();
    await expect(review.locator(".ai-source-update")).toHaveCount(0);
    await review.getByRole("button", { name: "返回来源列表" }).click();
    await expect(review.locator(".ai-health-item")).toContainText("没有变化");
    await review.getByRole("combobox", { name: "来源检查结果" }).selectOption("changed");
    await expect(review).toContainText("当前筛选没有结果");
    await review.getByRole("button", { name: "显示全部来源" }).click();
    await review.getByRole("combobox", { name: "来源项目" }).selectOption("");
    await expect(review.locator(".ai-health-item")).toHaveCount(1);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/source-review/${width}-${theme}.png` });
    }
    await page.reload();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!));
    expect(after.records[0].body).toBe("确认后才能替换的新正文");
    expect(after.history).toHaveLength(2);
  });
}
