import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { connectMcp } from "./mcp-test-client.mjs";
import { startTestProcess, unusedLocalPort, waitForTestService } from "./test-process.mjs";

const root = process.cwd();
const latestPath = path.join(root, "release/latest.json");
const release = process.argv[2]
  ? path.resolve(process.argv[2])
  : fs.existsSync(latestPath)
    ? path.join(root, "release", JSON.parse(fs.readFileSync(latestPath, "utf8")).directory)
    : path.join(root, "release");
fs.mkdirSync(path.join(root, "artifacts/workbench"), { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(release, "SHA256.json"), "utf8"));
assert.equal(manifest.version, JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version);
for (const file of manifest.files)
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(release, file.name)))
      .digest("hex"),
    file.sha256,
  );
const fixtureBase = path.join(root, ".local");
fs.mkdirSync(fixtureBase, { recursive: true });
const temp = fs.mkdtempSync(path.join(fixtureBase, "portable-smoke-"));
const report = { timestamp: new Date().toISOString(), version: manifest.version, hashes: true };
let client, app, browser, model, page;
try {
  // Production single-instance identity is shared across package directories.
  // Fail before starting a test app rather than waking a user's running window.
  if (process.platform === "win32") {
    const running = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "@(Get-Process -Name 'Moyang Reader Next','moyang-reader' -ErrorAction SilentlyContinue).Id",
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    assert.equal(running, "", "请先关闭已运行的 Moyang Reader Next，再进行独立便携包验证。");
  }
  client = await connectMcp(path.join(release, "moyang-ai-mcp.exe"), path.join(temp, "ai"));
  const { checkpoint } = await client.call("task_checkpoint", {
    client: "release-test",
    session: "isolated",
    turn: "original",
  });
  const result = await client.call("conclude_task", {
    checkpoint_id: checkpoint.id,
    reason: "验证最终便携程序",
    decisions: [
      {
        action: "save",
        evidence: "测试约定明确用简洁中文",
        record: { kind: "memory", title: "便携版表达偏好", body: "使用简洁中文回答", sharing: "global" },
      },
    ],
  });
  assert.ok(result.record_ids.length === 1);
  const id = result.record_ids[0];
  const hits = await client.call("search", { query: "简洁中文" });
  assert.ok(hits.items.some((item) => item.id === id));
  const record = await client.call("get_record", { id });
  const changed = await client.call("save_record", {
    ...record,
    body: "使用详细中文回答",
    expected_revision: record.revision,
    reason: "明确更正测试",
  });
  await client.call("restore_revision", { id, expected_revision: changed.revision, revision: record.revision });
  assert.equal((await client.call("get_record", { id })).body, "使用简洁中文回答");
  const health = await client.call("library_health", { project: "" });
  assert.equal(health.scanned, 1);
  const context = await client.call("recall_context", { query: "简洁中文", max_chars: 1000 });
  assert.ok(context.text.includes("使用简洁中文回答"));
  assert.ok(context.text.includes("范围：全局"));
  assert.ok([...context.text].length <= 1000);
  report.memory_maintenance = "native health tool and bounded scoped recall passed";
  const sources = await client.call("list_knowledge_sources", { project: "" });
  assert.equal(sources.total, 0, "Ordinary memories must not be listed as imported knowledge sources");
  report.source_inventory = "production MCP metadata-only source listing passed";
  report.mcp = "write, recall, update, restore passed";
  const service = await client.call("library_status");
  assert.equal(service.service.build.version, manifest.version);
  assert.equal(service.service.tool_count, 24);
  const layered = await client.call("read_context", {items:[{id,layer:"l1"}]});
  assert.ok(layered.items[0].content.includes("使用简洁中文回答"));
  const unchanged = await client.call("read_context", {items:[{id,layer:"l2",if_revision:layered.items[0].revision}]});
  assert.equal(unchanged.items[0].unchanged, true);
  report.layered_mcp = {build:service.service.build,conditional_read:true};
  await client.close();
  client = null;

  if (manifest.bundled_model) {
    const modelPort = await unusedLocalPort();
    const modelUrl = `http://127.0.0.1:${modelPort}`;
    model = startTestProcess(path.join(release, "ollama/runtime/ollama.exe"), ["serve"], {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${modelPort}`,
        OLLAMA_MODELS: path.join(release, "ollama/models"),
        OLLAMA_NO_CLOUD: "true",
      },
    });
    await waitForTestService(model, `${modelUrl}/api/tags`);
    const response = await globalThis.fetch(`${modelUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3-embedding:0.6b", input: "这是本地离线检索验证", keep_alive: 0 }),
      signal: globalThis.AbortSignal.timeout(60000),
    });
    const embedded = await response.json();
    assert.ok(response.ok, JSON.stringify(embedded));
    assert.equal(embedded.embeddings[0].length, 1024);
    report.bundled_model = "independent runtime, 1024-dimension Chinese embedding passed";
    model.kill();
    model = null;
  } else report.bundled_model = "not bundled; skipped";

  const desktopPort = await unusedLocalPort();
  const desktopUrl = `http://127.0.0.1:${desktopPort}`;
  const clientEnvironment = {
    ...process.env,
    CODEX_HOME: path.join(temp, "codex"),
    CLAUDE_CONFIG_DIR: path.join(temp, "claude"),
  };
  for (const name of ["codex", "claude"]) {
    const installed = JSON.parse(execFileSync(path.join(release, "moyang-ai-mcp.exe"),
      ["--data-dir", path.join(temp, "ai").replaceAll("\\", "/"), "--request", "client_connection"],
      { input: JSON.stringify({ client: name, action: "install" }), encoding: "utf8", windowsHide: true, env: clientEnvironment }));
    assert.equal(installed.configured, true);
    assert.equal(installed.hooks_configured, true);
  }
  const pluginDocument = path.join(temp, "release-plugin.md");
  fs.writeFileSync(pluginDocument, "# 发布包阅读工具\n\n- [ ] 中文 &amp; 插件验证\n", "utf8");
  app = startTestProcess(path.join(release, "Moyang Reader Next.exe"), [pluginDocument], {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...clientEnvironment,
      MOYANG_DATA_DIR: path.join(temp, "desktop"),
      MOYANG_AI_DATA_DIR: path.join(temp, "ai"),
      WEBVIEW2_USER_DATA_FOLDER: path.join(temp, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${desktopPort} --force-device-scale-factor=1.5`,
    },
  });
  await waitForTestService(app, `${desktopUrl}/json/version`);
  browser = await chromium.connectOverCDP(desktopUrl);
  for (let n = 0; n < 120; n++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().includes("tauri.localhost") || p.url().startsWith("tauri://localhost"));
    if (page) break;
    await pause(100);
  }
  assert.ok(
    page,
    `Expected final application page; observed ${browser
      .contexts()
      .flatMap((c) => c.pages())
      .map((p) => p.url())}`,
  );
  await page.getByRole("combobox", { name: "工作空间", exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭使用教程", exact: true }).click();
  assert.equal(await page.title(), "Moyang Reader Next");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-space").waitFor();
  const info = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("ai_connection_info"));
  assert.equal(info.available, true);
  assert.equal(path.resolve(info.executable), path.join(release, "moyang-ai-mcp.exe"));
  for (const name of ["codex", "claude"]) {
    const status = await page.evaluate((client) => window.__TAURI_INTERNALS__.invoke("ai_request", {
      operation: "client_connection", payload: { client, action: "status" },
    }), name);
    assert.equal(status.configured, true, `${name}: CLI and desktop path spellings must agree`);
    assert.equal(status.hooks_configured, true);
  }
  await page.screenshot({ path: "artifacts/workbench/release-desktop.png" });
  report.desktop = { rendered: true, scale: 1.5, mcp_companion: true, connection_paths: true, wdio: false };
  await page.locator(".ai-sidebar").getByRole("button", { name: "近期活动与冲突", exact: true }).click();
  await page.getByRole("button", { name: "资料检查", exact: true }).click();
  await page.getByText(/检查了 1 条未归档资料/).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  report.desktop.memory_health = true;
  await page.getByRole("button", { name: "来源更新", exact: true }).click();
  await page.getByRole("region", { name: "来源更新", exact: true }).getByText(/还没有导入的知识来源/).waitFor();
  const sourcePath = path.join(temp, "production-source.md");
  const sourceBody = "# 正式来源检查\n\n保存前比较这份原文件的新内容。\n";
  fs.writeFileSync(sourcePath, sourceBody, "utf8");
  const importedSource = await page.evaluate((uri) => window.__TAURI_INTERNALS__.invoke("ai_request", {
    operation: "save", payload: { kind: "knowledge", title: "正式来源检查", body: "原来的独立快照", source: uri, snapshot: { uri, format: "markdown", fingerprint: "old", imported_at: 1, locations: [] } },
  }), sourcePath);
  await page.getByRole("button", { name: "刷新来源列表", exact: true }).click();
  await page.getByRole("button", { name: "检查全部来源（1）", exact: true }).click();
  await page.getByRole("button", { name: "查看差异", exact: true }).click();
  assert.equal(await page.locator(".ai-sources .version-compare pre").last().textContent(), sourceBody);
  await page.screenshot({ path: "artifacts/workbench/release-source-review.png" });
  await page.getByRole("button", { name: "更新快照并保留历史", exact: true }).click();
  await page.locator(".ai-sources .ai-source-update").waitFor({state:"hidden"});
  client = await connectMcp(path.join(release, "moyang-ai-mcp.exe"), path.join(temp, "ai"));
  assert.equal((await client.call("get_record", {id: importedSource.id})).body, sourceBody);
  const updatedSources = await client.call("list_knowledge_sources", {project:""});
  assert.equal(updatedSources.total, 1);
  assert.equal(updatedSources.items[0].revision, 2);
  assert.equal("body" in updatedSources.items[0], false);
  await client.close(); client = null;
  report.desktop.source_review = true;
  await page.getByRole("button", { name: "插件市场", exact: true }).click();
  await page.locator(".extension-row").filter({ hasText: "阅读概览" }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByRole("button", { name: "停用", exact: true }).waitFor();
  const extensionState = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("extension_request", { operation: "load", payload: {} }),
  );
  assert.ok(extensionState.installed.some((item) => item.package.id === "moyang.reading-report" && item.enabled));
  report.desktop.extension_install = true;
  await page.locator(".extension-row").filter({ hasText: "待办提取" }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByRole("button", { name: "运行：提取文档待办", exact: true }).click();
  await page.getByRole("button", { name: /待办 · 中文 & 插件验证/ }).waitFor();
  assert.ok((await page.getByRole("dialog").textContent()).includes("未完成 1 项"));
  await page.screenshot({ path: "artifacts/workbench/release-practical-reader.png" });
  report.desktop.practical_reader = true;
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.locator(".extension-row").filter({ hasText: "书房聊天" }).click();
  await page.getByRole("button", { name: "安装扩展", exact: true }).click();
  await page.getByText("扩展已安装，可在下方管理。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "开始聊天", exact: true }).click();
  await page.getByRole("region", { name: "书房聊天", exact: true }).waitFor();
  await page.getByRole("button", { name: "添加我的 API 服务" }).click();
  await page.getByLabel("服务名称", {exact:true}).fill("本机验证服务");
  await page.getByLabel("API 基础地址").fill("http://127.0.0.1:1/v1");
  await page.getByLabel("默认模型", {exact:true}).fill("verification-only");
  await page.getByRole("button", {name:"返回聊天",exact:true}).click();
  await page.getByRole("region", {name:"未保存的服务配置"}).waitFor();
  await page.getByRole("button", {name:"继续编辑",exact:true}).click();
  assert.equal(await page.getByLabel("服务名称", {exact:true}).inputValue(), "本机验证服务");
  await page.getByRole("button", {name:"返回聊天",exact:true}).click();
  await page.getByRole("button", {name:"保存后继续",exact:true}).click();
  await page.getByRole("region", {name:"书房聊天",exact:true}).waitFor();
  assert.equal(await page.getByRole("combobox", {name:"API 服务",exact:true}).inputValue() !== "", true);
  report.desktop.chat_configuration = true;
  report.desktop.provider_unsaved_navigation = true;
  await page.getByLabel("聊天消息", {exact:true}).fill("第一份尚未发送的原生草稿");
  await page.getByRole("button", {name:"新对话",exact:true}).click();
  await page.getByLabel("聊天消息", {exact:true}).fill("第二份独立的原生草稿");
  await page.getByRole("button", {name:"历史",exact:true}).click();
  await page.getByRole("button", {name:/未发送 · 第一份尚未发送的原生草稿/}).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="聊天消息"]')?.value === "第一份尚未发送的原生草稿", null, {timeout:15000});
  await page.getByRole("button", {name:"历史",exact:true}).click();
  await page.getByRole("button", {name:/未发送 · 第二份独立的原生草稿/}).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="聊天消息"]')?.value === "第二份独立的原生草稿", null, {timeout:15000});
  report.desktop.independent_chat_drafts = true;
  await page.getByRole("button", {name:"设置",exact:true}).click();
  assert.equal(await page.locator('.workbench-sidebar [aria-current="page"]:visible').count(), 1);
  await page.getByRole("combobox", {name:"主题",exact:true}).selectOption("dark");
  assert.equal(await page.getByRole("combobox", {name:"主题",exact:true}).inputValue(), "dark");
  await page.getByRole("combobox", {name:"主题",exact:true}).selectOption("light");
  report.desktop.settings_navigation_and_theme = true;
  await page.getByRole("button", {name:"存储位置",exact:true}).click();
  await page.locator(".storage-locations").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({path:"artifacts/workbench/release-storage.png"});
  report.desktop.storage_locations = true;
  await page.getByRole("button", {name:"AI 服务与整理",exact:true}).click();
  await page.getByRole("region", {name:"AI 服务与整理",exact:true}).waitFor();
  assert.equal(await page.getByLabel("整理使用的服务",{exact:true}).locator("option").count(),2);
  assert.ok(Number(await page.getByLabel("每日 token 额度",{exact:true}).inputValue())>0);
  await page.screenshot({path:"artifacts/workbench/release-ai-services.png"});
  report.desktop.shared_services = true;
  await page.getByRole("button", {name:"关闭设置",exact:true}).click();
  const chosenModels=path.join(temp,"自选模型目录");
  const models=await page.evaluate(directory=>window.__TAURI_INTERNALS__.invoke("ai_request",{operation:"model_config",payload:{model:"qwen3-embedding:4b",directory}}),chosenModels);
  assert.equal(models.directory,chosenModels);assert.equal(models.presets.length,3);
  report.desktop.model_choices = {directory:models.directory,model:models.model,presets:models.presets.length,downloaded:false};
  if (process.env.MOYANG_VERIFY_PUBLISHED_UPDATE === "1") {
    const update = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("online_update_check"));
    assert.equal(update, null, "Published feed must identify this build as current");
    report.desktop.live_update_feed = true;
  }
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("reader");
  await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "close-requested", payload: null }),
  );
  for (let n = 0; n < 100 && app.exitCode === null; n++) await pause(100);
  assert.equal(app.exitCode, 0, "Final desktop did not close normally");
  report.desktop.normal_close = true;
} catch (error) {
  report.failure = String(error);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: "artifacts/workbench/release-failure.png" }).catch(() => undefined);
    report.visible_text = await page.locator("body").innerText().catch(() => "");
  }
  throw error;
} finally {
  if (app?.exitCode === null) app.kill();
  model?.kill();
  const cleanup = await Promise.allSettled([client?.close(), browser?.close()]);
  const errors = cleanup.filter((result) => result.status === "rejected");
  if (errors.length) report.cleanup_errors = errors.map((result) => String(result.reason));
  // Only this run's isolated data, after its app and MCP clients have stopped.
  for (let n = 0; app?.exitCode === null && n < 30; n++) await pause(100);
  if (path.dirname(temp) !== fixtureBase || !path.basename(temp).startsWith("portable-smoke-")) {
    report.cleanup_note = "Unexpected fixture path retained without removal";
  } else {
    try { fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); }
    catch (error) { report.retained_test_fixture = temp; report.cleanup_note = String(error); }
  }
  fs.writeFileSync("artifacts/workbench/release-smoke.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
