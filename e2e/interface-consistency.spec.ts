import { expect, test, type Page } from "@playwright/test";

async function openChat(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.getByRole("button", { name: /书房聊天.*用自己的/ }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByRole("button", { name: "开始聊天", exact: true }).click();
  await page.getByRole("button", { name: "API 服务", exact: true }).click();
}

test("global pages have one current sidebar destination and preserve the previous page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.getByRole("button", { name: "接入与备份", exact: true }).click();
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  const current = page.locator('.workbench-sidebar [aria-current="page"]:visible');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("插件市场");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("设置");
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await expect(page.locator(".ai-connections")).toBeVisible();
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("接入与备份");
});

test("appearance offers explicit theme choices and settings keep narrow navigation usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const theme = page.getByRole("combobox", { name: "主题", exact: true });
  await theme.selectOption("dark");
  await expect(theme).toHaveValue("dark");
  await theme.selectOption("light");
  await expect(theme).toHaveValue("light");
  await page.setViewportSize({ width: 720, height: 900 });
  await page.getByRole("button", { name: "显示导航", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "工作台导航" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "显示导航", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "显示导航", exact: true }).click();
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await expect(page.getByRole("region", { name: "插件市场" })).toBeVisible();
  await expect(page.getByRole("region", { name: "设置", exact: true })).toHaveCount(0);
});

test("narrow AI search opens the list and retains the unfinished draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill("窄窗保留的草稿");
  await page.setViewportSize({ width: 720, height: 900 });
  await page.keyboard.press("Control+Shift+F");
  await expect(page.getByRole("textbox", { name: "搜索 AI 内容" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "搜索 AI 内容" })).toBeFocused();
  await page.getByRole("button", { name: "显示导航", exact: true }).click();
  await page.locator(".ai-draft-list button").filter({ hasText: "窄窗保留的草稿" }).click();
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("窄窗保留的草稿");
  await expect(page.getByRole("dialog", { name: "工作台导航" })).toHaveCount(0);
});

test("extension filters stay reachable after scrolling and empty results can reset", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.locator(".extension-row").last().click();
  const query = page.getByRole("searchbox", { name: "搜索扩展" });
  await expect(query).toBeInViewport();
  await query.fill("不存在的扩展名称");
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(query).toHaveValue("");
  await expect(page.locator(".extension-row").first()).toBeVisible();
});

test("AI empty search can clear filters without changing saved content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
  await page.getByLabel("标题", { exact: true }).fill("保留的知识");
  await page.getByLabel("正文", { exact: true }).fill("清除筛选不改动已经保存的正文。");
  await page.getByRole("button", { name: "保存内容", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索 AI 内容" }).fill("没有匹配的查询");
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(page.locator(".ai-record-button")).toContainText("保留的知识");
  await expect(page.locator(".ai-document")).toContainText("清除筛选不改动已经保存的正文。");
});

test("API configuration asks before discarding and can save before returning", async ({ page }) => {
  await openChat(page);
  await page.getByLabel("服务名称", { exact: true }).fill("尚未保存的服务");
  await page.getByRole("button", { name: "返回聊天", exact: true }).click();
  const pending = page.getByRole("region", { name: "未保存的服务配置" });
  await expect(pending).toBeVisible();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  await expect(page.getByLabel("服务名称", { exact: true })).toHaveValue("尚未保存的服务");
  await page.getByRole("button", { name: "返回聊天", exact: true }).click();
  await page.getByRole("button", { name: "保存后继续", exact: true }).click();
  await expect(page.getByRole("region", { name: "书房聊天", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "API 服务", exact: true }).click();
  await expect(page.getByLabel("服务名称", { exact: true })).toHaveValue("尚未保存的服务");
  await page.getByLabel("服务名称", { exact: true }).fill("不应覆盖已保存名称");
  await page.getByRole("button", { name: "添加服务", exact: true }).click();
  await expect(pending).toBeVisible();
  await page.getByRole("button", { name: "放弃修改并继续", exact: true }).click();
  await expect(page.getByLabel("服务名称", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: /尚未保存的服务.*OpenAI/ }).click();
  await expect(page.getByLabel("服务名称", { exact: true })).toHaveValue("尚未保存的服务");
  await page.getByLabel("API 基础地址").fill("invalid-address");
  await page.getByRole("button", { name: "返回聊天", exact: true }).click();
  await page.getByRole("button", { name: "保存后继续", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(pending).toBeVisible();
  await expect(page.getByLabel("API 基础地址")).toHaveValue("invalid-address");
});
