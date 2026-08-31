import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectGeneratedArtifacts,
  findReparsePoints,
  isManagedWorktreePath,
  measurePath,
  parseWorktreeList,
} from "./cleanup-workspace.mjs";

test("parses registered worktrees without losing branch metadata", () => {
  const entries = parseWorktreeList(
    [
      "worktree D:/repo",
      "HEAD 111",
      "branch refs/heads/main",
      "",
      "worktree D:/repo/.codex-worktrees/feature",
      "HEAD 222",
      "detached",
    ].join("\n"),
  );

  assert.deepEqual(entries, [
    { path: "D:/repo", branch: "refs/heads/main" },
    { path: "D:/repo/.codex-worktrees/feature", detached: true },
  ]);
});

test("only accepts one direct child of the managed worktree root", () => {
  const root = path.resolve("D:/repo/.codex-worktrees");
  assert.equal(isManagedWorktreePath(path.resolve(root, "feature"), root), true);
  assert.equal(isManagedWorktreePath(path.resolve(root, "feature", "nested"), root), false);
  assert.equal(isManagedWorktreePath(path.resolve("D:/repo-other/.codex-worktrees/feature"), root), false);
});

test("collects known generated paths but does not follow links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cleanup-"));
  const worktree = path.join(root, ".codex-worktrees", "feature");
  fs.mkdirSync(path.join(worktree, "dist"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "dist", "bundle.js"), "bundle");
  fs.mkdirSync(path.join(root, "src-tauri", "target"), { recursive: true });
  fs.writeFileSync(path.join(root, "src-tauri", "target", "debug.bin"), "debug");

  const artifacts = collectGeneratedArtifacts(root, [{ path: worktree }]);
  assert.deepEqual(
    artifacts.map((artifact) => path.relative(root, artifact.path).split(path.sep).join("/")).sort(),
    [".codex-worktrees/feature/dist", "src-tauri/target"].sort(),
  );
  assert.equal(findReparsePoints(worktree).length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test("collects legacy path-keyed Cargo caches but ignores unrelated cache folders", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-legacy-cache-root-"));
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-legacy-cache-"));
  const previousCacheRoot = process.env.MOYANG_BUILD_CACHE_DIR;
  process.env.MOYANG_BUILD_CACHE_DIR = cacheRoot;
  try {
    const legacyTarget = path.join(cacheRoot, "0123456789ab", "cargo-target");
    const unrelatedTarget = path.join(cacheRoot, "not-a-repository-key", "cargo-target");
    fs.mkdirSync(legacyTarget, { recursive: true });
    fs.writeFileSync(path.join(legacyTarget, "old.bin"), "old");
    fs.mkdirSync(unrelatedTarget, { recursive: true });
    fs.writeFileSync(path.join(unrelatedTarget, "keep.bin"), "keep");

    const artifacts = collectGeneratedArtifacts(root);
    assert.equal(
      artifacts.some((artifact) => artifact.path === legacyTarget && artifact.protected),
      true,
    );
    assert.equal(
      artifacts.some((artifact) => artifact.path === unrelatedTarget),
      false,
    );
  } finally {
    if (previousCacheRoot === undefined) delete process.env.MOYANG_BUILD_CACHE_DIR;
    else process.env.MOYANG_BUILD_CACHE_DIR = previousCacheRoot;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("detects a junction without measuring or deleting its target", { skip: process.platform !== "win32" }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-junction-"));
  const worktree = path.join(root, ".codex-worktrees", "feature");
  const shared = path.join(root, "shared-node-modules");
  const link = path.join(worktree, "node_modules");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });
  fs.writeFileSync(path.join(shared, "keep.txt"), "keep");
  fs.symlinkSync(shared, link, "junction");

  assert.deepEqual(findReparsePoints(worktree), [link]);
  assert.equal(measurePath(link), 0);
  fs.unlinkSync(link);
  assert.equal(fs.existsSync(path.join(shared, "keep.txt")), true);
  fs.rmSync(root, { recursive: true, force: true });
});
