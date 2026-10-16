import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";

export async function startDesktopApiFixtures() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-api-fixture-"));
  const cli = path.resolve("node_modules/@tauri-apps/cli/tauri.js"), key = path.join(root, "test.key");
  const command = args => { const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", windowsHide: true, env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "" } }); if (r.status !== 0) throw new Error("Test-only signing fixture could not be created"); };
  command(["signer", "generate", "--ci", "-w", key]);
  const zip = new JSZip(); zip.file("Moyang Reader Next.exe", "not executed: signed test fixture"); zip.file("moyang-ai-mcp.exe", "test fixture"); zip.file("SHA256.json", JSON.stringify({ version: "999.0.0" }));
  const bytes = await zip.generateAsync({ type: "nodebuffer" }), archive = path.join(root, "fixture.zip"); fs.writeFileSync(archive, bytes);
  command(["signer", "sign", "-f", key, archive]);
  const signature = fs.readFileSync(archive + ".sig", "utf8").trim(), pubkey = fs.readFileSync(key + ".pub", "utf8").trim();
  let mode = "none", base = "", requests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/mode") { mode = url.searchParams.get("value") || "good"; res.end("ok"); return; }
    if (url.pathname === "/requests") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(requests)); return; }
    if (url.pathname === "/reader-update.json") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ version: mode === "none" ? "0.0.0" : "999.0.0", notes: "isolated signed fixture", platforms: { "windows-x86_64-portable": { signature, url: base + "/fixture.zip" } } })); return; }
    if (url.pathname === "/fixture.zip") { if (mode === "failed") { res.writeHead(503); res.end("try later"); } else { res.end(mode === "bad" ? Buffer.concat([bytes, Buffer.from("tampered")]) : bytes); } return; }
    if (url.pathname === "/v1/models") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ data: [{ id: "desktop-model" }] })); return; }
    if (["/v1/messages", "/v1/chat/completions"].includes(url.pathname)) {
      let raw = ""; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw), anthropic = url.pathname.endsWith("messages");
      requests.push({ body, protocol: anthropic ? "anthropic" : "openai", authorized: anthropic ? req.headers["x-api-key"] === "desktop-fixture-key" : req.headers.authorization === "Bearer desktop-fixture-key" });
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const event = anthropic ? { type: "content_block_delta", delta: { type: "text_delta", text: "原生中文流正常" } } : { choices: [{ delta: { content: "原生中文流正常" } }] };
      const encoded = Buffer.from(`data: ${JSON.stringify(event)}\n\n`), half = encoded.indexOf(Buffer.from("中文")) + 1;
      res.write(encoded.subarray(0, half));
      const timer = setTimeout(() => { res.write(encoded.subarray(half)); res.end(anthropic ? 'data: {"type":"message_stop"}\n\n' : "data: [DONE]\n\n"); }, body.model === "slow" ? 5000 : 25);
      res.on("close", () => clearTimeout(timer)); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); base = `http://127.0.0.1:${server.address().port}`;
  return { base, pubkey, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("moyang-api-fixture-")) throw new Error("Unexpected fixture root"); fs.rmSync(root, { recursive: true, force: true }); } };
}
