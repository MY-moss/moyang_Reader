import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function installChat(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.getByRole("button", { name: /书房聊天.*用自己的/ }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByRole("button", { name: "开始聊天", exact: true }).click();
  await expect(page.getByRole("region", { name: "书房聊天" })).toBeVisible();
}
async function configure(page: Page, protocol = "openai") {
  await page.getByRole("button", { name: "添加我的 API 服务" }).click();
  await page.getByLabel("服务名称", { exact: true }).fill("验证服务");
  await page.getByLabel("接口协议").selectOption(protocol);
  await page.getByLabel("API 基础地址").fill("http://localhost:7331/v1");
  await page.getByLabel("API 密钥", { exact: true }).fill("test-only-key");
  await page.getByLabel("默认模型", { exact: true }).fill("test-model");
  await page.getByRole("button", { name: "保存服务", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("服务已保存");
  await page.getByRole("button", { name: "返回聊天", exact: true }).click();
}

test("context preview excludes a source and refreshes changed evidence before sending", async ({ page }) => {
  await installChat(page);
  await configure(page);
  await page.evaluate(() => {
    const records = ["甲", "乙"].map((suffix, i) => ({
      id: `preview-${i}`,
      kind: "memory",
      title: `偏好${suffix}`,
      body: `偏好${suffix}的原始证据`,
      summary: "",
      project: "",
      agent: "",
      sharing: "global",
      state: "active",
      revision: 1,
      created_at: 1,
      updated_at: 1,
      tags: [],
      source: "用户明确要求",
      memory_type: "preference",
      importance: 3,
      pinned: false,
      expires_at: null,
      links: [],
      assets: [],
      skill_meta: {},
    }));
    localStorage.setItem(
      "moyang-ai-preview-v1",
      JSON.stringify({ format: "moyang-ai-space", version: 2, records, history: [] }),
    );
  });
  await page.locator(".chat-context-options summary").click();
  await page.getByLabel("发送相关知识与记忆", { exact: true }).check();
  await page.getByLabel("聊天消息").fill("偏好");
  await page.getByRole("button", { name: "预览上下文", exact: true }).click();
  const preview = page.getByRole("region", { name: "本次参考资料" });
  await expect(preview).toContainText("偏好甲");
  await preview.getByLabel("偏好乙", { exact: true }).uncheck();
  await page.setViewportSize({ width: 720, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".local/screenshots/chat-context-preview.png", fullPage: true });
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("moyang-ai-preview-v1")!);
    data.records[0].body = "偏好甲的新证据：使用短句";
    data.records[0].revision++;
    localStorage.setItem("moyang-ai-preview-v1", JSON.stringify(data));
  });
  let sent = "";
  await page.route("http://localhost:7331/v1/chat/completions", async (route) => {
    sent = route.request().postData() ?? "";
    await route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"已使用新的参考资料"}}]}\n\ndata: [DONE]\n\n',
    });
  });
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toContainText("已使用新的参考资料");
  expect(sent).toContain("新证据");
  expect(sent).not.toContain("偏好乙的原始证据");
  expect(sent).not.toContain("偏好甲的原始证据");
});

test("optional assistant uses selected API, persists history, and retains it after disabling", async ({ page }) => {
  const requests: unknown[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://localhost:7331/v1/**", async (route) => {
    requests.push(route.request().postDataJSON());
    expect(route.request().headers()["authorization"]).toBe("Bearer test-only-key");
    await route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"你好，**书房**。"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    });
  });
  await installChat(page);
  await configure(page);
  await page.getByLabel("聊天消息").fill("你好");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toContainText("你好，书房。");
  await expect(page.getByRole("button", { name: "重新回答" })).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole("button", { name: "存入 AI 库" }).click();
  await expect(page.getByRole("dialog", { name: "保存回答到 AI 库" }).getByLabel("保存为")).toBeFocused();
  await page.getByRole("button", { name: "取消", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog", { name: "保存回答到 AI 库" }).getByLabel("保存为")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "存入 AI 库" })).toBeFocused();
  await page.getByRole("button", { name: "存入 AI 库" }).click();
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已存入 AI 库");
  await page.reload();
  await page.getByRole("button", { name: "书房聊天", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toContainText("你好，书房。");
  const local = await page.evaluate(() => JSON.stringify(localStorage));
  expect(local).not.toContain("test-only-key");
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.getByRole("button", { name: /书房聊天.*用自己的/ }).click();
  await page.getByRole("button", { name: "停用", exact: true }).click();
  await expect(page.locator(".ai-sidebar").getByRole("button", { name: "书房聊天", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "启用", exact: true }).click();
  await page.getByRole("button", { name: "开始聊天", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toContainText("你好，书房。");
  expect(errors).toEqual([]);
});

test("unsent new drafts survive reload and switching conversations", async ({ page }) => {
  await installChat(page);
  await configure(page);
  await page.getByLabel("聊天消息").fill("尚未发送的第一段想法");
  await page.reload();
  await page.getByRole("button", { name: "书房聊天", exact: true }).click();
  await expect(page.getByLabel("聊天消息")).toHaveValue("尚未发送的第一段想法");
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await page.getByLabel("聊天消息").fill("另一段尚未发送的想法");
  await page.getByRole("button", { name: "历史", exact: true }).click();
  await page.getByRole("button", { name: /未发送 · 尚未发送的第一段想法/ }).click();
  await expect(page.getByLabel("聊天消息")).toHaveValue("尚未发送的第一段想法");
  await page.getByRole("button", { name: "历史", exact: true }).click();
  await page.getByRole("button", { name: /未发送 · 另一段尚未发送的想法/ }).click();
  await expect(page.getByLabel("聊天消息")).toHaveValue("另一段尚未发送的想法");
});

test("model lookup does not offer an ineffective stop-test action", async ({ page }) => {
  await installChat(page);
  await configure(page);
  let release: () => void = () => undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("http://localhost:7331/v1/models", async (route) => {
    await waiting;
    await route.fulfill({ json: { data: [{ id: "listed-model" }] } });
  });
  await page.getByRole("button", { name: "API 服务", exact: true }).click();
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  await expect(page.getByRole("button", { name: "返回聊天", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "停止测试", exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole("status")).toContainText("已获取 1 个模型");
  await expect(page.getByRole("button", { name: "返回聊天", exact: true })).toBeEnabled();
});

test("provider model catalogs persist, select per conversation, and keep user messages compact", async ({ page }) => {
  await installChat(page);
  await configure(page);
  await page.route("http://localhost:7331/v1/models", (route) =>
    route.fulfill({
      json: { data: [{ id: "fast-model" }, { id: "careful-model" }, { id: "fast-model" }] },
    }),
  );
  await page.getByRole("button", { name: "API 服务", exact: true }).click();
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("并保存");
  await expect(page.getByLabel("可选模型列表")).toHaveValue("test-model\nfast-model\ncareful-model");
  await page.getByRole("button", { name: "返回聊天", exact: true }).click();
  await page.getByLabel("本次模型", { exact: true }).selectOption({ label: "careful-model" });
  const sent: string[] = [];
  await page.route("http://localhost:7331/v1/chat/completions", (route) => {
    sent.push(route.request().postDataJSON().model);
    return route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"收到。"}}]}\n\ndata: [DONE]\n\n',
    });
  });
  await page.getByLabel("聊天消息").fill("你好");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toContainText("收到。");
  const card = await page.locator(".chat-message-user").boundingBox();
  expect(card!.height).toBeLessThan(90);
  expect(card!.width).toBeLessThan(300);
  await page.locator(".chat-message-user").getByRole("button", { name: "复制消息" }).focus();
  await expect(page.locator(".chat-message-user").getByRole("button", { name: "复制消息" })).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "书房聊天", exact: true }).click();
  await expect(page.getByLabel("本次模型", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "API 服务", exact: true }).click();
  await expect(page.getByLabel("默认模型", { exact: true })).toHaveValue("test-model");
  await expect(page.getByLabel("可选模型列表")).toHaveValue("test-model\nfast-model\ncareful-model");
  await page.route("http://localhost:7331/v1/models", (route) =>
    route.fulfill({ status: 503, body: "temporary failure" }),
  );
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("可选模型列表")).toHaveValue("test-model\nfast-model\ncareful-model");
  await page.getByRole("button", { name: "返回聊天", exact: true }).click();
  await page.getByLabel("本次模型", { exact: true }).selectOption("custom");
  await page.getByLabel("自定义模型 ID", { exact: true }).fill("private/custom-model");
  await page.getByLabel("聊天消息").fill("第一行\n第二行，保留换行。\n" + "长网址文字".repeat(60));
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "重新回答" })).toBeEnabled();
  expect(sent).toEqual(["careful-model", "private/custom-model"]);
  for (const width of [1440, 720]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(
      await page
        .locator(".chat-message-user")
        .last()
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: `.local/screenshots/chat-models-${width}.png`, fullPage: true });
  }
});

test("Anthropic failures preserve the prompt and retry without duplicating it", async ({ page }) => {
  let calls = 0;
  await page.route("http://localhost:7331/v1/messages", async (route) => {
    expect(route.request().headers()["x-api-key"]).toBe("test-only-key");
    const body = route.request().postDataJSON();
    expect(body.messages).toHaveLength(1);
    expect(body.system).toBeTruthy();
    if (++calls === 1) await route.fulfill({ status: 429, body: "unavailable" });
    else
      await route.fulfill({
        contentType: "text/event-stream",
        body: 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"恢复成功"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
      });
  });
  await installChat(page);
  await configure(page, "anthropic");
  await page.getByLabel("聊天消息").fill("这条不能丢");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("额度不足");
  // An empty failed answer still offers an explicit retry.
  await page.getByRole("button", { name: "重试回答", exact: true }).click();
  await expect(page.locator(".chat-message-assistant")).toContainText("恢复成功");
  expect(await page.locator(".chat-message-user").count()).toBe(1);
});

test("chat and service settings fit supported widths and keyboard-accessible themes", async ({ page }) => {
  await installChat(page);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1440, 1280, 900, 720]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "添加我的 API 服务" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations).toEqual([]);
});
