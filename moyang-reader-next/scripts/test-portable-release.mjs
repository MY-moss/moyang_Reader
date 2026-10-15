import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-portable-"));
const report = { timestamp: new Date().toISOString(), version: manifest.version, hashes: true };
let client, app, browser, model;
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
  report.mcp = "write, recall, update, restore passed";
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
  app = startTestProcess(path.join(release, "Moyang Reader Next.exe"), [], {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      MOYANG_DATA_DIR: path.join(temp, "desktop"),
      MOYANG_AI_DATA_DIR: path.join(temp, "desktop-ai"),
      WEBVIEW2_USER_DATA_FOLDER: path.join(temp, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${desktopPort} --force-device-scale-factor=1.5`,
    },
  });
  await waitForTestService(app, `${desktopUrl}/json/version`);
  browser = await chromium.connectOverCDP(desktopUrl);
  let page;
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
  assert.equal(await page.title(), "Moyang Reader Next");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("ai");
  await page.locator(".ai-space").waitFor();
  const info = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("ai_connection_info"));
  assert.equal(info.available, true);
  assert.equal(path.resolve(info.executable), path.join(release, "moyang-ai-mcp.exe"));
  await page.screenshot({ path: "artifacts/workbench/release-desktop.png" });
  report.desktop = { rendered: true, scale: 1.5, mcp_companion: true, wdio: false };
  await page.getByRole("combobox", { name: "工作空间", exact: true }).selectOption("reader");
  await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "close-requested", payload: null }),
  );
  for (let n = 0; n < 100 && app.exitCode === null; n++) await pause(100);
  assert.equal(app.exitCode, 0, "Final desktop did not close normally");
  report.desktop.normal_close = true;
} finally {
  if (app?.exitCode === null) app.kill();
  model?.kill();
  const cleanup = await Promise.allSettled([client?.close(), browser?.close()]);
  const errors = cleanup.filter((result) => result.status === "rejected");
  if (errors.length) report.cleanup_errors = errors.map((result) => String(result.reason));
  fs.writeFileSync("artifacts/workbench/release-smoke.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
