import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connectMcp } from "./mcp-test-client.mjs";

function fixture(t, mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-mcp-client-test-"));
  const script = path.join(root, "server.mjs");
  const pidFile = path.join(root, "pid");
  let stopped = false;
  fs.writeFileSync(script, `
    import fs from "node:fs";
    import { createInterface } from "node:readline";
    fs.writeFileSync(process.argv[2], String(process.pid));
    const lines = createInterface({ input: process.stdin });
    const keepAlive = setInterval(() => {}, 1000);
    lines.on("line", (line) => {
      const request = JSON.parse(line);
      if (${JSON.stringify(mode)} === "timeout") return;
      if (${JSON.stringify(mode)} === "invalid") {
        console.log("invalid json response");
        return;
      }
      if (request.id) console.log(JSON.stringify({ jsonrpc: "2.0", id: request.id,
        result: request.method === "initialize" ? {} : { content: [{ type: "text", text: "{\\"ok\\":true}" }] } }));
    });
    if (${JSON.stringify(mode)} === "success") process.stdin.on("end", () => clearInterval(keepAlive));
  `);
  t.after(() => {
    if (!stopped && fs.existsSync(pidFile)) {
      try { process.kill(Number(fs.readFileSync(pidFile, "utf8"))); } catch { /* Already stopped. */ }
    }
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    args: [script, pidFile],
    assertStopped() {
      assert.equal(fs.existsSync(pidFile), true, "fixture child must actually start");
      const pid = Number(fs.readFileSync(pidFile, "utf8"));
      assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
      stopped = true;
    },
  };
}

test("initialization timeout stops an unresponsive MCP before rejecting", { timeout: 8000 }, async (t) => {
  const server = fixture(t, "timeout");
  await assert.rejects(connectMcp(process.execPath, server.root, 250, server.args), /MCP timeout: initialize/);
  server.assertStopped();
});

test("invalid initialize response stops the child and keeps the protocol error", { timeout: 8000 }, async (t) => {
  const server = fixture(t, "invalid");
  await assert.rejects(connectMcp(process.execPath, server.root, 2000, server.args), SyntaxError);
  server.assertStopped();
});

test("successful client closes idempotently and waits for exit", { timeout: 8000 }, async (t) => {
  const server = fixture(t, "success");
  const client = await connectMcp(process.execPath, server.root, 2000, server.args);
  assert.deepEqual(await client.call("example"), { ok: true });
  await Promise.all([client.close(), client.close()]);
  server.assertStopped();
});

test("spawn failure rejects without leaving a pending initialization timer", async () => {
  await assert.rejects(connectMcp(path.join(os.tmpdir(), "missing-moyang-executable.exe"), "unused", 100), { code: "ENOENT" });
});
