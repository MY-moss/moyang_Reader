import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { scanArchitecture, scanArchitectureAtRoot } from "./architecture-guard.mjs";

test("repository respects enforced architecture boundaries", () => {
  assert.deepEqual(scanArchitecture(process.cwd()), []);
});

test("allows Tauri mocks in tests while rejecting raw imports in production source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-architecture-"));
  try {
    const appRoot = path.join(root, "src", "app");
    fs.mkdirSync(appRoot, { recursive: true });
    fs.writeFileSync(
      path.join(appRoot, "bridge.test.ts"),
      'vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));\n',
    );
    fs.writeFileSync(path.join(appRoot, "bridge.ts"), 'import { invoke } from "@tauri-apps/api/core";\n');

    assert.deepEqual(scanArchitectureAtRoot(root), [
      "src/app/bridge.ts: raw @tauri-apps/api/core is only allowed in src/app/ipc-contract.ts",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
