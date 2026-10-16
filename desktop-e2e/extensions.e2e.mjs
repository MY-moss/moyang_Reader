import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const invoke = (command, args) =>
  browser.execute((command, args) => window.__TAURI_INTERNALS__.invoke(command, args), command, args);
const click = async (name) => {
  await browser.execute((name) => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === name);
    if (!button) throw new Error(`Missing button ${name}`);
    button.click();
  }, name);
};
const waitText = async (selector, text) =>
  browser.waitUntil(() =>
    browser.execute((s, t) => document.querySelector(s)?.textContent.includes(t), selector, text),
  );

describe("installed desktop extensions", () => {
  it("runs a real worker under the desktop CSP and restores native installation state", async () => {
    await browser.execute(() => {
      const select = document.querySelector('select[aria-label="工作空间"]');
      select.value = "reader";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await click("插件市场");
    await browser.$('[aria-label="插件市场"]').waitForDisplayed();
    const pkg = {
      format: "moyang-extension",
      id: "desktop.worker",
      name: "桌面 Worker 验证",
      description: "验证真实桌面模块插件。",
      kind: "reader",
      version: "1.0.0",
      minAppVersion: "0.11.0",
      author: "测试",
      formats: ["markdown", "text"],
      entry: "main.js",
      commands: [{ id: "report", name: "桌面插件报告" }],
      files: { "main.js": "export default ({text})=>({report:'桌面 Worker 已运行：'+text.slice(0,30)})" },
    };
    await browser.execute((pkg) => {
      const input = document.querySelector('input[aria-label="导入扩展包"]');
      const files = new window.DataTransfer();
      files.items.add(new window.File([JSON.stringify(pkg)], "desktop.json", { type: "application/json" }));
      input.files = files.files;
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    }, pkg);
    await waitText(".extension-detail", "桌面 Worker 验证");
    await click("安装扩展");
    await waitText(".extension-detail", "停用");
    const state = await invoke("extension_request", { operation: "load", payload: {} });
    assert.ok(state.installed.some((i) => i.package.id === "desktop.worker"));
    await browser.refresh();
    await browser.$(".workbench-space-select").waitForDisplayed();
    await browser.execute(() => {
      const select = document.querySelector('select[aria-label="工作空间"]');
      select.value = "reader";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    const fixture = path.join(path.dirname(process.env.MOYANG_DESKTOP_E2E_DOCUMENT), "extension-worker.txt");
    fs.writeFileSync(fixture, "桌面扩展测试原文，仅用于测试。", "utf8");
    await browser.$(".workbench-primary-actions button").click();
    await browser.$('input[aria-label="全文搜索阅读库"]').setValue("桌面扩展测试原文");
    await waitText(".bookroom-results", "extension-worker.txt");
    await browser.execute(() => document.querySelector(".bookroom-results section button").click());
    await browser.waitUntil(() =>
      browser.execute(
        () =>
          document.querySelector(".document-title")?.textContent === "extension-worker.txt" &&
          !document.querySelector(".bookroom-page"),
      ),
    );
    await browser.execute(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "p", ctrlKey: true, shiftKey: true, bubbles: true }),
      ),
    );
    await waitText(".command-palette-list", "桌面插件报告");
    await browser.execute(() =>
      [...document.querySelectorAll('[role="option"]')].find((b) => b.textContent.includes("桌面插件报告")).click(),
    );
    await waitText(".extension-result", "桌面 Worker 已运行");
    await click("关闭");
    await click("插件市场");
    await browser.execute(() =>
      [...document.querySelectorAll(".extension-toolbar nav button")]
        .find((b) => b.textContent.includes("已安装"))
        .click(),
    );
    await waitText(".extension-list", "桌面 Worker 验证");
  });
  it("installs a real skill into the native AI database", async () => {
    await browser.execute(() =>
      [...document.querySelectorAll(".extension-toolbar nav button")].find((b) => b.textContent === "发现").click(),
    );
    await browser.execute(() =>
      [...document.querySelectorAll(".extension-row")]
        .find((b) => b.textContent.includes("有据可查的记忆整理"))
        .click(),
    );
    await click("安装扩展");
    await waitText(".extension-detail", "在技能库打开");
    const state = await invoke("extension_request", { operation: "load", payload: {} });
    const entry = state.installed.find((i) => i.package.id === "moyang.evidence-memory");
    assert.ok(entry.skillId);
    const record = await invoke("ai_request", { operation: "get", payload: { id: entry.skillId } });
    assert.equal(record.kind, "skill");
    assert.ok(record.body.includes("checkpoint_id"));
    assert.ok(record.assets.some((a) => a.path === "references/examples.md"));
    await click("在技能库打开");
    await waitText(".ai-space", "任务结束的记忆整理");
  });
});
