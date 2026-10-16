/* global document, localStorage, console */
import { chromium, expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

// Capture the existing build with disposable, fictional browser data only.
// Run the reader preview on port 4187 before running this script.
const assets = new URL("./assets/", import.meta.url);
await mkdir(assets, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});
const page = await context.newPage();
const timestamp = 1792108800000;
const records = [
  [
    "knowledge",
    "reading",
    "把资料读成自己的知识",
    "# 把资料读成自己的知识\n\n阅读不是收集更多链接，而是找到真正值得留下的线索。\n\n## 读懂\n\n先看结构，再找论点，最后回到问题本身。\n\n## 留下\n\n- 摘录值得保留的段落\n- 写下自己的理解\n- 记录出处，方便再次查阅\n\n## 连接\n\n让新的材料，与已有的知识建立联系。",
  ],
  [
    "knowledge",
    "writing",
    "清晰写作的三个习惯",
    "# 清晰写作的三个习惯\n\n先说结论，再给依据，最后补充需要的细节。\n\n## 让读者容易理解\n\n使用具体的例子和熟悉的词。一个段落只展开一个重点。",
  ],
  [
    "knowledge",
    "sources",
    "我的项目资料索引",
    "# 我的项目资料索引\n\n项目文档、研究资料与重要参考，按主题整理并保留来源。",
  ],
  [
    "memory",
    "preferences",
    "我的阅读与表达偏好",
    "# 我的阅读与表达偏好\n\n- 默认使用简洁中文。\n- 先给结论，再解释原因。\n- 重要事实保留来源。\n\n这些约定可以在后续任务中按需召回，也可以随时更正。",
  ],
  [
    "memory",
    "decisions",
    "项目已经确定的约定",
    "# 项目已经确定的约定\n\n先理解现有资料，再提出修改。项目规则仅用于当前项目，不带入其他项目。",
  ],
  [
    "skill",
    "organize",
    "资料整理与来源核对",
    "# 资料整理与来源核对\n\n## 适用场景\n\n读完文章、完成研究，或接手一批新资料时。\n\n## 操作步骤\n\n1. 找出材料的核心问题。\n2. 提炼结论与关键依据。\n3. 记录来源，区分事实和推测。\n4. 关联已有内容，删除重复信息。\n5. 保存能够再次使用的知识。",
  ],
  ["skill", "review", "中文文档审阅", "# 中文文档审阅\n\n检查结构、措辞、来源与可执行步骤，让下一位读者能够直接开始。"],
].map(([kind, id, title, body]) => ({
  kind,
  id,
  title,
  body,
  summary: body.split("\n").find((s) => s && !s.startsWith("#")) ?? "",
  project: "",
  agent: "",
  sharing: "global",
  snapshot: null,
  tags: ["演示资料"],
  source: "产品演示 · 虚构示例",
  memory_type: "preference",
  importance: 3,
  pinned: false,
  expires_at: null,
  links: [],
  assets: [],
  skill_meta: {},
  revision: 1,
  created_at: timestamp,
  updated_at: timestamp,
  state: "active",
}));
await page.addInitScript(
  ({ records, timestamp }) => {
    if (!localStorage.getItem("moyang-demo-seeded")) {
      localStorage.setItem(
        "moyang-ai-preview-v1",
        JSON.stringify({ format: "moyang-ai-space", version: 1, exported_at: timestamp, records, history: [] }),
      );
      localStorage.setItem("moyang-demo-seeded", "true");
    }
  },
  { records, timestamp },
);
const capture = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL(name + ".png", assets)) });
};
await page.goto("http://127.0.0.1:4187");
await page
  .locator("input[type=file]")
  .first()
  .setInputFiles({ name: "阅读与思考.md", mimeType: "text/markdown", buffer: Buffer.from(records[0].body) });
await expect(page.locator(".wysiwyg-editor")).toHaveAttribute("aria-busy", "false");
await page.keyboard.press("Control+e");
await expect(
  page.locator(".reader-content").getByRole("heading", { name: "把资料读成自己的知识", exact: true }),
).toBeVisible();
await capture("reading");
await page.getByRole("button", { name: "双窗格", exact: true }).click();
await page.getByRole("button", { name: "在此窗格工作" }).click();
await page
  .locator("input[type=file]")
  .first()
  .setInputFiles({
    name: "我的阅读笔记.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# 我的阅读笔记\n\n读过的内容，也可以成为自己的思考。\n\n## 今天留下什么\n\n- 一个值得再次追问的问题\n- 一段保留出处的摘录\n- 一条与旧知识的新联系\n\n> 边读，边写。把线索留在身边。",
    ),
  });
await expect(page.locator(".reader-pane.is-active .wysiwyg-editor")).toHaveAttribute("aria-busy", "false");
await page.keyboard.press("Control+e");
await expect(page.getByRole("region", { name: "左侧文档窗格" }).locator(".reader-content")).toContainText(
  "阅读不是收集更多链接",
);
await expect(page.getByRole("region", { name: "右侧文档窗格" }).locator(".reader-content")).toContainText("边读，边写");
await capture("split");
await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
await page.getByRole("button", { name: /把资料读成自己的知识/ }).click();
await capture("knowledge");
await page
  .getByRole("button", { name: /长期记忆/ })
  .first()
  .click();
await page.getByRole("button", { name: /我的阅读与表达偏好/ }).click();
await capture("memory");
await page
  .getByRole("button", { name: /技能库/ })
  .first()
  .click();
await page.getByRole("button", { name: /资料整理与来源核对/ }).click();
await capture("skill");
await page.getByRole("button", { name: "插件市场", exact: true }).click();
await page.getByRole("button", { name: /书房聊天.*用自己的/ }).click();
await page.getByRole("button", { name: "安装扩展", exact: true }).click();
await page.getByRole("button", { name: "开始聊天", exact: true }).click();
await page.getByRole("button", { name: "添加我的 API 服务" }).click();
await page.getByLabel("服务名称", { exact: true }).fill("我的 AI · 演示");
await page.getByLabel("API 基础地址").fill("http://127.0.0.1:59999/v1");
await page.getByLabel("默认模型", { exact: true }).fill("my-model");
await page.getByRole("button", { name: "保存服务", exact: true }).click();
await page.getByRole("button", { name: "返回聊天", exact: true }).click();
await page.route("http://127.0.0.1:59999/v1/**", (route) =>
  route.fulfill({
    contentType: "text/event-stream",
    body:
      "data: " +
      JSON.stringify({
        choices: [
          {
            delta: {
              content:
                "可以从三个动作开始：\n\n1. **保留出处**：摘录关键段落，记录来源。\n2. **写下理解**：用自己的话留下结论与问题。\n3. **建立联系**：关联已有笔记，把可复用的方法整理进技能库。\n\n让每一次阅读，都成为下一次思考的起点。",
            },
          },
        ],
      }) +
      "\n\ndata: [DONE]\n\n",
  }),
);
await page.getByLabel("聊天消息").fill("读完一篇文章后，怎样把它变成自己的知识？");
await page.getByRole("button", { name: "发送", exact: true }).click();
await expect(page.locator(".chat-message-assistant")).toContainText("建立联系");
await capture("chat");
console.log("Captured reading, split, knowledge, memory, skill and chat using fictional sample data.");
await browser.close();
