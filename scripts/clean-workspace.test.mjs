import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./clean-workspace.ps1", import.meta.url));
test(
  "cleanup previews first and preserves source, models, releases and data",
  { skip: process.platform !== "win32" },
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cleanup-"));
    try {
      fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "moyang-reader-next" }));
      for (const name of ["dist", "coverage", "src", ".git", ".local/ollama", "release/current", "personal-notes"]) {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.writeFileSync(path.join(root, name, "sentinel"), "preserve");
      }
      const run = (...args) =>
        spawnSync("powershell.exe", ["-NoProfile", "-File", script, "-Root", root, ...args], {
          encoding: "utf8",
          windowsHide: true,
        });
      assert.equal(run().status, 0);
      assert.ok(fs.existsSync(path.join(root, "dist/sentinel")));
      assert.equal(run("-Apply").status, 0);
      assert.ok(!fs.existsSync(path.join(root, "dist")));
      for (const name of ["src", ".git", ".local/ollama", "release/current", "personal-notes"])
        assert.equal(fs.readFileSync(path.join(root, name, "sentinel"), "utf8"), "preserve");
      fs.symlinkSync(path.join(root, "personal-notes"), path.join(root, "dist"), "junction");
      assert.notEqual(run("-Apply").status, 0);
      assert.ok(fs.existsSync(path.join(root, "personal-notes/sentinel")));
      fs.unlinkSync(path.join(root, "dist"));
      fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "another-project" }));
      assert.notEqual(run("-Apply").status, 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
