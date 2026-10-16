import { spawn } from "node:child_process";
import { setTimeout, clearTimeout } from "node:timers";
import { createInterface } from "node:readline";
export async function connectMcp(executable, directory, timeoutMs = 20000, spawnArgs = ["--data-dir", directory]) {
  const child = spawn(executable, spawnArgs, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let sequence = 0;
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr = (stderr + data.toString()).slice(-4000);
  });
  const fail = (error) => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.on("exit", (code) => fail(new Error(`MCP exited ${code}: ${stderr}`)));
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      const waiter = pending.get(response.id);
      if (!waiter) return;
      pending.delete(response.id);
      clearTimeout(waiter.timer);
      if (response.error) waiter.reject(new Error(JSON.stringify(response.error)));
      else waiter.resolve(response.result);
    } catch (error) {
      fail(error);
    }
  });
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP timeout: ${method}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  let closing;
  const close = () =>
    (closing ??= (async () => {
      lines.close();
      fail(new Error("MCP client closed"));
      child.stdin.end();
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
      await new Promise((resolve) => {
        const timer = setTimeout(() => child.kill(), 3000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    })());
  try {
    await request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "moyang-desktop-test", version: "1.0" },
    });
  } catch (error) {
    await close();
    throw error;
  }
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  return {
    async call(name, args = {}) {
      const result = await request("tools/call", { name, arguments: args });
      if (result.isError) throw new Error(result.content.map((c) => c.text).join("\n"));
      return JSON.parse(result.content[0].text);
    },
    close,
  };
}
