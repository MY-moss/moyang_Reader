import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { assemblePortablePackage } from "./portable-package.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-package-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ["target", "docs", "tasks"]) fs.mkdirSync(path.join(root, name));
  for (const name of ["DESIGN.md", "PRODUCT.md", "LICENSE", "tasks/workbench-upgrade.md", "docs/USER-GUIDE.md"])
    fs.writeFileSync(path.join(root, name), "fixture");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.99.1" }));
  for (const name of ["moyang-reader.exe", "moyang-ai-mcp.exe"])
    fs.writeFileSync(path.join(root, "target", name), name);
  return { root, target: path.join(root, "target") };
}
test("clean checkout packages without local artifacts and derives version from package.json", (t) => {
  const input = fixture(t);
  const result = assemblePortablePackage(input);
  assert.equal(result.version, "0.99.1");
  assert.equal(result.bundled_model, false);
  assert.equal(fs.existsSync(path.join(result.destination, "artifacts")), false);
  assert.equal(fs.existsSync(path.join(result.destination, "ollama")), false);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(input.root, "release/latest.json"))).directory,
    path.basename(result.destination),
  );
});
test("failed copy preserves latest pointer and both previously published executables", (t) => {
  const input = fixture(t);
  const previous = assemblePortablePackage(input);
  const pointer = fs.readFileSync(path.join(input.root, "release/latest.json"), "utf8");
  fs.writeFileSync(path.join(input.target, "moyang-reader.exe"), "new build");
  fs.unlinkSync(path.join(input.root, "LICENSE"));
  assert.throws(() => assemblePortablePackage(input), /ENOENT/);
  assert.equal(fs.readFileSync(path.join(input.root, "release/latest.json"), "utf8"), pointer);
  assert.equal(fs.readFileSync(path.join(previous.destination, "Moyang Reader Next.exe"), "utf8"), "moyang-reader.exe");
  assert.equal(fs.readFileSync(path.join(previous.destination, "moyang-ai-mcp.exe"), "utf8"), "moyang-ai-mcp.exe");
});
test("new build never inherits a stale model or modifies old packages", (t) => {
  const input = fixture(t);
  const previous = assemblePortablePackage(input);
  fs.mkdirSync(path.join(previous.destination, "ollama"));
  fs.writeFileSync(path.join(previous.destination, "ollama/stale"), "old");
  fs.writeFileSync(path.join(input.target, "moyang-ai-mcp.exe"), "new MCP");
  const next = assemblePortablePackage(input);
  assert.notEqual(next.destination, previous.destination);
  assert.equal(fs.existsSync(path.join(next.destination, "ollama")), false);
  assert.equal(fs.readFileSync(path.join(previous.destination, "moyang-ai-mcp.exe"), "utf8"), "moyang-ai-mcp.exe");
  assert.equal(fs.readFileSync(path.join(next.destination, "moyang-ai-mcp.exe"), "utf8"), "new MCP");
});
