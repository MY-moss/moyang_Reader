import { test, expect } from "@playwright/test";

test("AI activity and connection pages are exclusive and keep the draft", async ({ page }) => {
  await open(page);
  await page.getByLabel("标题", { exact: true }).fill("切换时保留的草稿");
  await page.getByRole("button", { name: "近期活动与冲突", exact: true }).click();
  await expect(page.locator(".ai-activity")).toBeVisible();
  await page.locator(".ai-sidebar button").filter({ hasText: "接入与备份" }).click();
  await expect(page.locator(".ai-connections")).toBeVisible();
  await expect(page.locator(".ai-activity")).toHaveCount(0);
  await page.locator(".ai-draft-list button").filter({ hasText: "切换时保留的草稿" }).click();
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("切换时保留的草稿");
});
async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
}
test("AI editor autosaves, keeps separate drafts and restores after reload", async ({ page }) => {
  await open(page);
  await page.getByLabel("标题", { exact: true }).fill("第一份草稿");
  await page.getByLabel("正文", { exact: true }).fill("正在整理的中文知识");
  await expect(page.locator(".ai-detail-toolbar [role=status]")).toHaveText("已保存");
  await page.locator(".ai-sidebar nav button").filter({ hasText: "长期记忆" }).click();
  await expect(page.locator(".ai-detail-toolbar")).toContainText("知识库 / 编辑");
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill("第二份未完成草稿");
  await page.locator(".ai-draft-list button").filter({ hasText: "第一份草稿" }).click();
  await expect(page.getByLabel("正文", { exact: true })).toContainText("正在整理的中文知识");
  await page.reload();
  await expect(page.locator(".ai-draft-list button")).toHaveCount(2);
  await page.locator(".ai-draft-list button").filter({ hasText: "第二份未完成草稿" }).click();
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("第二份未完成草稿");
});
test("AI composition delays autosave and conflict preserves the local draft", async ({ page }) => {
  await open(page);
  await page.getByLabel("标题", { exact: true }).fill("冲突测试");
  const editor = page.getByLabel("正文", { exact: true });
  await editor.dispatchEvent("compositionstart");
  await editor.fill("我的中文草稿");
  // Cover the full autosave interval while the composition session remains open.
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("moyang-ai-preview-v1") || '{"records":[]}').records.length,
    ),
  ).toBe(0);
  await editor.dispatchEvent("compositionend");
  await expect(page.locator(".ai-detail-toolbar [role=status]")).toHaveText("已保存");
  await page.evaluate(() => {
    const key = "moyang-ai-preview-v1",
      db = JSON.parse(localStorage.getItem(key)!);
    const r = db.records[0];
    r.body = "Agent 修改后的版本";
    r.revision++;
    db.history.push({ record: { ...r }, reason: "外部 Agent 修改", recorded_at: Date.now() });
    localStorage.setItem(key, JSON.stringify(db));
  });
  await editor.fill("保留我的新草稿");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await expect(page.getByRole("region", { name: "比较 AI 内容冲突" })).toContainText("Agent 修改后的版本");
  await page.getByRole("button", { name: "草稿另存副本" }).click();
  await expect(page.locator(".ai-document h1")).toHaveText("冲突测试");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records.map((r: { body: string }) => r.body),
    ),
  ).toEqual(expect.arrayContaining(["Agent 修改后的版本", expect.stringContaining("保留我的新草稿")]));
});
test("AI related entries are picked by name and shown in a side preview", async ({ page }) => {
  await open(page);
  await page.getByLabel("标题", { exact: true }).fill("可关联的知识");
  await page.getByLabel("正文", { exact: true }).fill("相关知识正文");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill("引用知识");
  await page.getByLabel("正文", { exact: true }).fill("正文与引用独立");
  await page.getByLabel("按名称关联内容").fill("可关联的知识");
  await page.locator(".ai-relation-results button").click();
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await page.locator(".ai-related button").filter({ hasText: "可关联的知识" }).click();
  await expect(page.getByRole("complementary", { name: "关联内容预览" })).toContainText("相关知识正文");
  await expect(page.locator(".ai-document > h1")).toHaveText("引用知识");
});
