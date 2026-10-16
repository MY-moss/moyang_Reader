import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { updateArchive } from "./prepare-online-update.mjs";
test("online packages verify executables and exclude models and local update metadata", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-online-package-test-"));
  try {
    fs.writeFileSync(path.join(root, "Moyang Reader Next.exe"), "fixture");
    fs.mkdirSync(path.join(root, "ollama")); fs.writeFileSync(path.join(root, "ollama", "large-model"), "not uploaded");
    fs.writeFileSync(path.join(root, "online-update.json"), "private-local-path");
    const manifest = { version: "1.0.0", files: [{ name: "Moyang Reader Next.exe", sha256: crypto.createHash("sha256").update("fixture").digest("hex") }] };
    fs.writeFileSync(path.join(root, "SHA256.json"), JSON.stringify(manifest));
    const result = await updateArchive(root), zip = await JSZip.loadAsync(result.bytes);
    assert.equal(await zip.file("Moyang Reader Next.exe").async("string"), "fixture");
    assert.ok(!zip.file("online-update.json")); assert.ok(!zip.file("ollama/large-model"));
    assert.equal(JSON.parse(await zip.file("SHA256.json").async("string")).bundled_model, false);
    assert.match(await zip.file("使用说明.txt").async("string"), /不含 Ollama/);
    fs.writeFileSync(path.join(root, "Moyang Reader Next.exe"), "changed");
    await assert.rejects(updateArchive(root), /checksum mismatch/);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith("moyang-online-package-test-"));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
