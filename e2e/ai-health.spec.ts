import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyAiFields } from "../src/shared/ai-types";
import fs from "node:fs/promises";
const entry = (id: string, body: string, project = "book") => ({
  ...emptyAiFields("memory"),
  id,
  title: id,
  body,
  project,
  sharing: "project",
  source: "",
  revision: 1,
  state: "active",
  created_at: 1,
  updated_at: 1,
});
test("health review filters scopes, opens evidence and preserves archive undo without touching notes", async ({
  page,
}) => {
  const records = [
    entry("旧说明", "核对来源再保存"),
    entry("重复说明", "核对来源再保存"),
    entry("别的项目", "核对来源再保存", "other"),
    { ...entry("到期决定", "限时规则"), expires_at: 1 },
    { ...entry("失效关联", "关联原资料"), links: ["deleted"] },
  ];
  await page.addInitScript(
    (records) =>
      localStorage.setItem(
        "moyang-ai-preview-v1",
        JSON.stringify({ format: "moyang-ai-space", version: 2, exported_at: 1, records, history: [] }),
      ),
    records,
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-sidebar").getByRole("button", { name: "近期活动与冲突", exact: true }).click();
  await page.getByRole("button", { name: "资料检查", exact: true }).click();
  const health = page.getByRole("region", { name: "资料检查" });
  await expect(health).toContainText("检查了 5 条");
  await health.getByRole("combobox", { name: "项目", exact: true }).selectOption("book");
  await expect(health).toContainText("检查了 4 条");
  await health.getByRole("button", { name: "正文相同 2", exact: true }).click();
  await expect(health.locator(".ai-health-item")).toHaveCount(2);
  await health
    .locator(".ai-health-item")
    .filter({ hasText: "旧说明" })
    .first()
    .getByRole("button", { name: "归档", exact: true })
    .click();
  await expect(health).toContainText("当前条件下没有发现待核对项");
  await health.getByRole("button", { name: "撤销归档", exact: true }).click();
  await expect(health.locator(".ai-health-item")).toHaveCount(2);
  await health.getByRole("button", { name: "已到期 1", exact: true }).click();
  await expect(health).toContainText("默认召回已排除");
  await health.getByRole("button", { name: "关联已删除 1", exact: true }).click();
  await expect(health).toContainText("1 条关联已被删除");
  await fs.mkdir("artifacts/memory-maintenance", { recursive: true });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1440, 720]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(350);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include(".ai-activity").analyze()).violations).toEqual([]);
      await page.screenshot({ path: `artifacts/memory-maintenance/health-${colorScheme}-${width}.png` });
    }
  }
  await health.getByRole("button", { name: "查看与整理", exact: true }).click();
  await expect(page.locator(".ai-document h1")).toHaveText("失效关联");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!));
  expect(saved.records.find((r: { id: string }) => r.id === "旧说明").state).toBe("active");
  expect(saved.records.find((r: { id: string }) => r.id === "别的项目").revision).toBe(1);
});
