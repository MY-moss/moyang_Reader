import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { startTestProcess, unusedLocalPort, waitForTestService } from "./test-process.mjs";

test(
  "desktop beforeDevCommand starts Vite directly on Windows and serves the application",
  { timeout: 20000 },
  async (t) => {
    const port = await unusedLocalPort();
    const root = path.resolve(import.meta.dirname, "..");
    // Test the actual launcher, including PDF assets. No build/dist or personal data is used.
    const child = startTestProcess(
      process.execPath,
      ["scripts/tauri-dev-server.mjs", "--port", String(port), "--strictPort"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    // The launcher runs Vite in the same process, so shutdown leaves no server.
    t.after(() => child.kill());
    try {
      await waitForTestService(child, `http://127.0.0.1:${port}`);
      const body = await globalThis.fetch(`http://127.0.0.1:${port}`).then((r) => r.text());
      assert.match(body, /<title>Moyang Reader<\/title>/);
      assert.match(body, /src\/main.tsx/);
    } catch (error) {
      throw new Error(`${error.message}\n${output}`, { cause: error });
    }
  },
);
