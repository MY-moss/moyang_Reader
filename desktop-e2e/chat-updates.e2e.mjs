import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const fetch = globalThis.fetch;
const invoke = (command, args) => browser.execute((command, args) => window.__TAURI_INTERNALS__.invoke(command, args), command, args);
describe("native chat and signed portable updates", () => {
  it("shows actual storage locations from isolated native data", async () => {
    const info = await invoke("storage_info", {});
    assert.equal(info.native, true);
    const data = info.locations.find(item => item.key === "data");
    assert.ok(data && data.files > 0 && data.bytes > 0);
    assert.ok(data.logical.includes("moyang-reader-desktop-e2e"));
    await browser.$('button=设置').click();
    await browser.$('button=存储位置').click();
    await browser.waitUntil(async () => (await browser.$('.storage-locations').getText()).includes(data.physical), { timeout: 15000 });
    fs.mkdirSync('.impeccable/review/chat-updates', {recursive:true});
    await browser.setWindowSize(1280,900);
    await browser.saveScreenshot('.impeccable/review/chat-updates/storage-native-1280.png');
    await browser.setWindowSize(720,900);
    await browser.saveScreenshot('.impeccable/review/chat-updates/storage-native-720.png');
      // Visual fixture only: the real copy/junction/rollback flow is exercised by
      // test-storage-migration.ps1. Never move the desktop test runner's live profile.
      await browser.execute((info) => {
        const internal = window.__TAURI_INTERNALS__, original = internal.invoke;
        window.__storageOriginalInvoke = original;
        internal.invoke = (command, args, options) => {
          if (command === 'storage_choose_target') return Promise.resolve('E:\\MoyangData');
          if (command === 'storage_prepare') return Promise.resolve({target:'E:\\MoyangData',items:info.locations.filter(p=>p.key!=='models'),bytes:104857600,free:214748364800});
          if (command === 'storage_info') return Promise.resolve({...info,report:{status:'complete',message:'迁移完成。旧路径保留为目录链接，数据实际保存在新位置。',target:'E:\\MoyangData'}});
          return original(command,args,options);
        };
      },info);
      await browser.$('button=选择新位置').click();
      await browser.$('button=检查迁移').click();
      await browser.$('.storage-plan').waitForDisplayed();
      await browser.$('.storage-plan').scrollIntoView();
      await browser.saveScreenshot('.impeccable/review/chat-updates/storage-plan-720-fixture.png');
      await browser.$('button=刷新占用').click();
      await browser.$('.storage-report').scrollIntoView();
      await browser.saveScreenshot('.impeccable/review/chat-updates/storage-result-720-fixture.png');
      await browser.execute(() => { window.__TAURI_INTERNALS__.invoke = window.__storageOriginalInvoke; delete window.__storageOriginalInvoke; });
    await browser.setWindowSize(1240,820);
    await browser.$('button[aria-label="关闭设置"]').click();
  });
  it("uses both real HTTP protocols, streams split Chinese bytes, and cancels a slow answer", async () => {
    const base = process.env.MOYANG_TEST_API_URL;
    for (const protocol of ["openai", "anthropic"]) {
      await invoke("chat_request", { operation: "save_provider", payload: { id: protocol, name: protocol, protocol, baseUrl: base + "/v1", model: "desktop-model", apiKey: "desktop-fixture-key" } });
      assert.deepEqual(await invoke("chat_models", { providerId: protocol }), ["desktop-model"]);
      const result = await browser.execute(async protocol => {
        const chunks = [], channel = new window.__TAURI__.core.Channel(); channel.onmessage = bytes => chunks.push(...bytes);
        await window.__TAURI_INTERNALS__.invoke("chat_stream", { requestId: window.crypto.randomUUID(), providerId: protocol, body: { model: "desktop-model", stream: true, messages: [{ role: "user", content: "请用中文回答" }] }, channel });
        return new window.TextDecoder().decode(new Uint8Array(chunks));
      }, protocol);
      assert.ok(result.includes("原生中文流正常"));
    }
    const stopped = await browser.execute(async () => {
      const id = window.crypto.randomUUID(), channel = new window.__TAURI__.core.Channel();
      channel.onmessage = () => { void window.__TAURI_INTERNALS__.invoke("chat_cancel", { requestId: id }); };
      try { await window.__TAURI_INTERNALS__.invoke("chat_stream", { requestId: id, providerId: "openai", body: { model: "slow", stream: true, messages: [{ role: "user", content: "取消验证" }] }, channel }); return false; }
      catch (e) { return String(e).includes("已停止"); }
    });
    assert.equal(stopped, true);
    const requests = await (await fetch(base + "/requests")).json();
    assert.ok(requests.length >= 3 && requests.every(r => r.authorized));
    const publicProfiles = await invoke("chat_request", { operation: "providers", payload: {} });
    assert.ok(!JSON.stringify(publicProfiles).includes("desktop-fixture-key"));
  });
  it("rejects altered signatures and failed downloads, then stages a signed package without switching the running app", async () => {
    const base = process.env.MOYANG_TEST_API_URL;
    await fetch(base + "/mode?value=good");
    const info = await invoke("online_update_check", {}); assert.equal(info.version, "999.0.0");
    const download = () => browser.execute(async () => { const channel = new window.__TAURI__.core.Channel(); const events = []; channel.onmessage = event => events.push(event); try { await window.__TAURI_INTERNALS__.invoke("online_update_download", { channel }); return { ok: true, events }; } catch (e) { return { ok: false, message: String(e) }; } });
    await fetch(base + "/mode?value=bad"); const bad = await download(); assert.equal(bad.ok, false); assert.match(bad.message, /signature|verify/i);
    await fetch(base + "/mode?value=failed"); assert.equal((await download()).ok, false);
    await fetch(base + "/mode?value=good"); const good = await download(); assert.equal(good.ok, true); assert.ok(good.events.some(e => e.event === "Finished"));
    const root = path.join(process.env.CARGO_TARGET_DIR, "debug", "updates");
    assert.ok(!fs.existsSync(path.join(root, "latest.json")), "download must not activate before saving");
    for (const name of fs.readdirSync(root).filter(n => n.startsWith("999.0.0-online-"))) {
      const directory = path.resolve(root, name); assert.equal(path.dirname(directory), path.resolve(root));
      assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "SHA256.json"), "utf8")).version, "999.0.0");
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
