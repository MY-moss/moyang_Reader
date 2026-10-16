import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  await fs.mkdir("artifacts/workbench", { recursive: true });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
    await page.goto(process.env.MOYANG_CAPTURE_URL || "http://127.0.0.1:4174");
    await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
    await page.locator(".ai-page-header").getByRole("button", { name: /新建/ }).click();
    await page.getByLabel("标题", { exact: true }).fill("让读过的内容，参与下一次思考");
    await page.getByRole("button", { name: "源码模式", exact: true }).click();
    await page
      .getByLabel("正文", { exact: true })
      .fill(
        "## 留下能再次用上的知识\n\n读到一个重要观点时，记录它解决了什么问题、适用的条件，以及原始出处。\n\n> 知识的价值，在于下一次需要时能找到它。\n\n## 与 AI 一起积累\n\n1. 开始任务前，召回相关知识和长期偏好。\n2. 任务结束后，留下经过验证的决定与经验。\n3. 旧结论改变时，修订它并保留来路。\n\n## 把经验整理成技能\n\n写清使用时机与操作步骤。以后换一个 Agent，也能沿用这些方法。",
      );
    await page.getByRole("button", { name: "保存内容", exact: true }).click();
    await page.locator(".ai-document > h1").waitFor();
    await page.locator(".ai-prose h2").first().waitFor();
    await page.locator(".ai-prose blockquote").waitFor();
    await page.locator(".ai-prose ol").waitFor();
    await page.screenshot({ path: `artifacts/workbench/ai-document-${theme}-1440.png` });
    await page.setViewportSize({ width: 720, height: 900 });
    await page.screenshot({ path: `artifacts/workbench/ai-document-${theme}-720.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await page.getByLabel("正文", { exact: true }).waitFor();
    await page.locator('.ai-shared-editor .wysiwyg-editor[aria-busy="false"]').waitFor();
    await page.screenshot({ path: `artifacts/workbench/ai-editor-${theme}-1440.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
