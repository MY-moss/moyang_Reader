import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capabilityPath = path.join(projectRoot, "src-tauri", "capabilities", "default.json");

test("keeps production Tauri capabilities limited to the calls used by the app", () => {
  const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));

  assert.deepEqual(capability.permissions, [
    "core:default",
    "dialog:default",
    "opener:allow-open-url",
    "opener:allow-default-urls",
    "process:allow-restart",
    "updater:allow-check",
    "updater:allow-download-and-install",
  ]);
});

test("does not grant unused process, opener path, or split updater commands", () => {
  const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
  const permissions = new Set(capability.permissions);

  for (const permission of [
    "opener:default",
    "opener:allow-open-path",
    "opener:allow-reveal-item-in-dir",
    "process:default",
    "process:allow-exit",
    "updater:default",
    "updater:allow-download",
    "updater:allow-install",
  ]) {
    assert.equal(permissions.has(permission), false, `unexpected capability: ${permission}`);
  }
});
