import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const plugin = (version = "1.0.0", delay = 0) => ({
  format: "moyang-extension",
  id: "test.reader",
  name: "测试阅读插件",
  description: "用于验证真正的插件运行、升级和撤销。",
  version,
  minAppVersion: "0.11.0",
  author: "测试",
  kind: "reader",
  entry: "main.js",
  commands: [{ id: "replace", name: "替换测试段落", modifiesDocument: true }],
  files: {
    "main.js": `export default async ({text})=>{await new Promise(r=>setTimeout(r,${delay}));return {replacement:text.replace('原文','插件更新'),report:'完成 ${version}'}}`,
  },
});
async function market(page: Page) {
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await expect(page.getByRole("region", { name: "插件市场" })).toBeVisible();
}
async function importPackage(page: Page, pkg: unknown) {
  await page
    .getByLabel("导入扩展包", { exact: true })
    .setInputFiles({ name: "test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(pkg)) });
  await expect(page.getByRole("article")).toBeVisible();
}
async function openDocument(page: Page, text = "原文\n\n这里保留。") {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "扩展验证.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.locator(".cm-content").first()).toBeVisible();
}

test("global navigation exits settings, opens AI search from connections, and preserves the document", async ({
  page,
}) => {
  await page.goto("/");
  await openDocument(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "最近打开", exact: true }).click();
  await expect(page.getByRole("region", { name: "设置", exact: true })).toBeHidden();
  await page.getByLabel("工作空间", { exact: true }).selectOption("ai");
  await page.getByRole("button", { name: "接入与备份", exact: true }).click();
  await page.locator(".workbench-primary-actions").getByRole("button", { name: /搜索/ }).click();
  await expect(page.locator(".ai-search")).toBeFocused();
  await market(page);
  await page.getByRole("button", { name: "知识库", exact: false }).first().click();
  await expect(page.getByRole("region", { name: "插件市场" })).toBeHidden();
  await page.getByLabel("工作空间", { exact: true }).selectOption("reader");
});
test("installs, runs, undoes, upgrades, rolls back and removes a real reader plugin", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await openDocument(page);
  await market(page);
  await importPackage(page, plugin());
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await expect(page.getByRole("button", { name: "停用", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回工作台", exact: true }).click();
  await page.keyboard.press("Control+Shift+P");
  await page.getByRole("option", { name: /替换测试段落/ }).click();
  await expect(page.getByRole("dialog")).toContainText("插件更新");
  await page.getByRole("button", { name: "采用修改", exact: true }).click();
  await expect(page.locator(".cm-content").first()).toContainText("插件更新");
  await page.keyboard.press("Control+Shift+P");
  await page.getByRole("option", { name: /撤销上一次编辑/ }).click();
  await expect(page.locator(".cm-content").first()).toContainText("原文");
  await market(page);
  await importPackage(page, plugin("1.1.0"));
  await page.getByRole("button", { name: "更新到 1.1.0", exact: true }).click();
  await page.getByRole("button", { name: "回退上一版 1.0.0", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已回退");
  await page.reload();
  await market(page);
  await page
    .getByRole("button", { name: /已安装/ })
    .first()
    .click();
  await page.getByRole("button", { name: /测试阅读插件/ }).click();
  await expect(page.getByRole("article")).toContainText("1.0.0");
  await page.getByRole("button", { name: "卸载扩展", exact: true }).click();
  await page.getByRole("button", { name: "确认卸载", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("扩展已卸载");
  expect(errors).toEqual([]);
});
test("themes restore defaults after disabling and the marketplace fits all supported widths", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--canvas"));
  await market(page);
  await page.getByRole("button", { name: /雾青书房/ }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--canvas")))
    .toBe("#f1f5f4");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [1440, 1280, 900, 720]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "停用", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--canvas")))
    .toBe(before);
});
test("custom catalogs update on request, failures retain installed content, and incompatible updates stay visible", async ({
  page,
}) => {
  const url = "https://catalog.test/extensions.json";
  let version = "1.0.0",
    failed = false;
  await page.route(url, (route) =>
    failed
      ? route.abort()
      : route.fulfill({
          json: { format: "moyang-extension-catalog", packages: [plugin(version)] },
          headers: { "access-control-allow-origin": "*" },
        }),
  );
  await page.goto("/");
  await market(page);
  await page.getByRole("button", { name: "管理目录源", exact: true }).click();
  await page.getByLabel("远程目录地址").fill(url);
  await page.getByRole("button", { name: "添加目录", exact: true }).click();
  await page.getByRole("button", { name: /测试阅读插件/ }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  version = "1.1.0";
  await page.getByRole("button", { name: "刷新目录", exact: true }).click();
  await expect(page.getByRole("button", { name: /^更新 / })).toContainText("1");
  failed = true;
  await page.getByRole("button", { name: "刷新目录", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("已有安装仍可使用");
  await expect(page.getByRole("alert")).toContainText(url);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "dark" });
  for (const theme of [null, "dark", "light"]) {
    await page.evaluate((value) => {
      if (value) document.documentElement.dataset.theme = value;
      else delete document.documentElement.dataset.theme;
    }, theme);
    const audit = await new AxeBuilder({ page }).include('.extension-message[role="alert"]').analyze();
    expect(audit.violations).toEqual([]);
  }
  failed = false;
  version = "1.2.0";
  await page.getByRole("button", { name: "重试目录更新", exact: true }).click();
  await expect(page.getByRole("alert")).toBeHidden();
  await page.getByRole("button", { name: /测试阅读插件/ }).click();
  await expect(page.getByRole("button", { name: "更新到 1.2.0", exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /已安装/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /测试阅读插件/ })).toBeVisible();
});

test("long extension names keep the type and installed state within each list row", async ({ page }) => {
  const name = "EvidenceReviewLongName".repeat(5);
  await page.goto("/");
  await market(page);
  await importPackage(page, { ...plugin(), name });
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page
    .getByRole("button", { name: /^已安装/ })
    .first()
    .click();
  const row = page.locator(".extension-row").filter({ hasText: name });
  for (const width of [1440, 720]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(row).toBeVisible();
    expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(row.locator(".extension-row-title span")).toBeVisible();
  }
});

test("skill updates preserve local improvements and uninstall preserves knowledge", async ({ page }) => {
  const skill = (version: string, body: string) => ({
    format: "moyang-extension",
    id: "test.skill",
    name: "阅读整理技能",
    description: "验证有来源的技能升级。",
    version,
    minAppVersion: "0.11.0",
    kind: "skill",
    author: "测试",
    skill: {
      body: `---\nname: reading-test\ndescription: 阅读并整理证据\n---\n\n${body}`,
      assets: [{ path: "references/notes.md", encoding: "utf8", content: "资源原文" }],
    },
  });
  await page.goto("/");
  await market(page);
  await importPackage(page, skill("1.0.0", "原版方法"));
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await expect(page.getByRole("button", { name: "在技能库打开", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "在技能库打开", exact: true }).click();
  await expect(page.locator(".ai-space")).toContainText("原版方法");
  // Simulate another Agent revising the shared record through its storage boundary.
  await page.evaluate(() => {
    const key = "moyang-ai-preview-v1",
      db = JSON.parse(localStorage.getItem(key)!);
    const record = db.records.find((r: { kind: string }) => r.kind === "skill");
    record.body = "Agent 已验证的改进";
    record.revision++;
    localStorage.setItem(key, JSON.stringify(db));
  });
  await market(page);
  await importPackage(page, skill("1.1.0", "作者的新方法"));
  await page.getByRole("button", { name: "更新到 1.1.0", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("技能已经在本地或被 Agent 改进");
  await page.getByRole("button", { name: "保留原技能，安装副本", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已加入 AI 技能库");
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records);
  expect(records.map((r: { body: string }) => r.body)).toEqual(
    expect.arrayContaining(["Agent 已验证的改进", "作者的新方法"]),
  );
  await page.getByRole("button", { name: "卸载扩展", exact: true }).click();
  await page.getByRole("button", { name: "确认卸载", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records.length)).toBe(2);
});

test("cancelling a running plugin leaves the document unchanged", async ({ page }) => {
  await page.goto("/");
  await openDocument(page);
  await market(page);
  await importPackage(page, plugin("1.0.0", 2000));
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByRole("button", { name: "返回工作台", exact: true }).click();
  await page.keyboard.press("Control+Shift+P");
  await page.getByRole("option", { name: /替换测试段落/ }).click();
  await page.getByRole("button", { name: "取消运行", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".cm-content").first()).toContainText("原文");
});

test("unversioned Chinese skills have distinct identities and can be updated by importing again", async ({ page }) => {
  await page.goto("/");
  await market(page);
  const upload = async (name: string, body: string) => {
    await page.getByLabel("导入扩展包", { exact: true }).setInputFiles({
      name: "SKILL.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(`---\nname: ${name}\ndescription: 阅读并整理证据。\n---\n\n${body}`),
    });
    await expect(page.getByRole("article")).toContainText(name);
  };
  await upload("中文阅读技能", "第一版方法");
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await expect(page.getByRole("button", { name: "在技能库打开", exact: true })).toBeVisible();
  await upload("中文阅读技能", "第二版方法");
  await page.getByRole("button", { name: "更新到 1.0.1", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已加入 AI 技能库");
  await upload("另一份中文技能", "另一个方法");
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await expect(page.getByRole("button", { name: "在技能库打开", exact: true })).toBeVisible();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!).records);
  expect(records).toHaveLength(2);
  expect(records.map((r: { body: string }) => r.body)).toEqual(expect.arrayContaining(["第二版方法", "另一个方法"]));
});
