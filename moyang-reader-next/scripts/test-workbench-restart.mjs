import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { remote } from "webdriverio";
import { createBuildEnvironment } from "./shared-cargo-target.mjs";

// Run only after the successful desktop E2E build: this executable uses the
// isolated com.moyang.reader.next.tests identity, never the personal workspace.
const env = createBuildEnvironment(process.cwd());
const binary = path.join(env.CARGO_TARGET_DIR,"debug","moyang-reader.exe");
assert.ok(fs.existsSync(binary), "Build the desktop E2E executable first");
const root = fs.mkdtempSync(path.join(os.tmpdir(),"moyang-restart-"));
const file = path.join(root,"重启验证.md");
fs.writeFileSync(file,"# 重启验证\n\n恢复上次双窗格。\n");
let processHandle, client;
async function launch(args, port) {
  processHandle = spawn(binary,args,{windowsHide:true,stdio:"ignore",env:{...env,TAURI_WEBDRIVER_PORT:String(port),MOYANG_AI_DATA_DIR:path.join(root,"ai-test"),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--force-device-scale-factor=1.5"}});
  for(let i=0;i<100;i++) {
    if(processHandle.exitCode!==null) throw new Error("Test desktop exited before the driver became ready");
    if(await globalThis.fetch(`http://127.0.0.1:${port}/status`).then((r)=>r.ok).catch(()=>false)) break;
    await pause(100);
  }
  client = await remote({hostname:"127.0.0.1",port,logLevel:"error",capabilities:{browserName:"tauri"}});
}
async function stop() {
  if(client) {
    const delivery = await client.execute(()=>{
      window.setTimeout(()=>{void window.__TAURI__.event.emit("close-requested");},100);
      return "scheduled";
    }).catch((error)=>String(error));
    for(let i=0;i<100 && processHandle?.exitCode===null;i++) await pause(100);
    if(processHandle?.exitCode===null) console.error("Close diagnostic",delivery,await client.execute(async()=>{
      const contents=await window.__TAURI_INTERNALS__.invoke("read_app_settings").catch(String);
      const write=await window.__TAURI_INTERNALS__.invoke("write_app_settings",{contents:typeof contents==="string"?contents:"{}"}).then(()=>"ok",String);
      return {body:document.body.innerText.slice(-1400),write,config:await window.__TAURI__.path.appConfigDir()};
    }).catch(String));
    if(processHandle?.exitCode===null) await client.deleteSession().catch(()=>undefined);
    client=null;
  }
  if(processHandle?.exitCode===null) { processHandle.kill(); throw new Error("Desktop did not close after all saves completed"); }
}
try {
  await launch([root,file],4458);
  await client.execute(()=>window.localStorage.clear()); await client.refresh();
  await client.waitUntil(()=>client.execute(()=>document.querySelector(".document-title")?.textContent.includes("重启验证.md")),{timeout:15000});
  await client.execute(()=>{[...document.querySelectorAll("button")].find((button)=>button.textContent==="知道了")?.click();});
  await client.$('button[aria-label="双窗格"]').click(); await client.$("button=在此窗格工作").click();
  await client.execute(()=>document.querySelector('.reader-pane.is-active button[aria-label="源文本模式"]').click());
  await client.$('.reader-pane.is-active [aria-label="Markdown 源文本"]').waitForDisplayed();
  await client.execute(()=>{const view=document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]').cmTile.root.view; view.dispatch({changes:{from:view.state.doc.length,insert:"关闭后仍保留的中文内容。\n"}});});
  await client.waitUntil(()=>fs.readFileSync(file,"utf8").includes("关闭后仍保留"));
  await stop();
  await launch([],4459);
  await client.waitUntil(()=>client.execute(()=>document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]')?.textContent.includes("关闭后仍保留")),{timeout:20000});
  const result=await client.execute(()=>({panes:document.querySelectorAll(".reader-pane").length,active:document.querySelector(".reader-pane.is-active")?.getAttribute("aria-label"),title:document.querySelector(".document-title")?.textContent,scale:window.devicePixelRatio,overflow:document.documentElement.scrollWidth>window.innerWidth}));
  assert.equal(result.panes,2); assert.equal(result.active,"右侧文档窗格"); assert.equal(result.title,"重启验证.md"); assert.equal(result.scale,1.5); assert.equal(result.overflow,false);
  assert.ok(await client.execute(()=>[...document.querySelectorAll('.reader-pane.is-active .document-mode-switch button')].every((button)=>button.getBoundingClientRect().height<40)),"Mode labels must stay on one line at 150%");
  fs.mkdirSync("artifacts/workbench",{recursive:true}); await client.saveScreenshot("artifacts/workbench/desktop-restart-150.png");
  fs.writeFileSync("artifacts/workbench/desktop-restart.json",JSON.stringify({at:new Date().toISOString(),...result},null,2));
  await stop(); console.log("PASS: real desktop process restart, shared draft, right-pane source view, 150% WebView2 rendering");
} finally {
  if(processHandle?.exitCode===null) processHandle.kill();
  // This directory was freshly created by this script and contains fixtures only.
  if(path.dirname(root)===os.tmpdir() && path.basename(root).startsWith("moyang-restart-")) fs.rmSync(root,{recursive:true,force:true});
}
