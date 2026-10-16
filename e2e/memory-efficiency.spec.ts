import { test, expect } from "@playwright/test";

test("project import stays a recoverable draft until explicitly saved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill("范围种子");
  await page.locator(".ai-editor details summary").filter({ hasText: "属性" }).click();
  await page.getByLabel("共享范围", { exact: true }).selectOption("project");
  await page.getByLabel("项目", { exact: true }).fill("隔离项目");
  await page.getByLabel("正文", { exact: true }).fill("一条项目知识");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await page.locator(".ai-filter-details summary").click();
  await page.getByLabel("筛选项目").selectOption("隔离项目");
  await page.locator('.ai-page-header input[type="file"]').setInputFiles({
    name: "待导入.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("导入正文不能自动流入全局"),
  });
  await expect(page.locator(".ai-editor")).toContainText("待确认导入");
  await page.waitForTimeout(1500); // Cover the existing autosave interval, not a load test.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records.length)).toBe(1);
  await page.reload();
  await expect(page.locator(".ai-editor")).toContainText("待确认导入");
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.locator(".ai-document h1")).toHaveText("待导入");
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records.find(
      (r: { title: string }) => r.title === "待导入",
    ),
  );
  expect(record.project).toBe("隔离项目");
  expect(record.sharing).toBe("project");
});

test("visible activity follows external writes", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.getByRole("button", { name: "近期活动与冲突", exact: true }).click();
  await expect(page.locator(".ai-activity")).toContainText("记录会出现在这里");
  const other = await context.newPage();
  await other.goto("/");
  await page.bringToFront();
  await other.evaluate(() => {
    const key = "moyang-ai-preview-v1";
    const db = JSON.parse(localStorage.getItem(key) ?? '{"records":[],"history":[]}');
    db.activities = [
      {
        id: "external",
        record_id: "external",
        reason: "外部写入的结果",
        evidence: "正常任务",
        updated_at: Date.now(),
        undone_revision: null,
      },
    ];
    localStorage.setItem(key, JSON.stringify(db));
  });
  await expect(page.locator(".ai-activity")).toContainText("外部写入的结果");
});
