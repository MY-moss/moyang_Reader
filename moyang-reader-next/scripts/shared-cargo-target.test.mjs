import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveDefaultSharedCargoTargetDir,
  resolveRepositoryRoot,
  resolveSharedCargoTargetDir,
} from "./shared-cargo-target.mjs";

test("uses one stable managed cache outside the repository", () => {
  const repositoryRoot = resolveRepositoryRoot();
  const target = resolveDefaultSharedCargoTargetDir(repositoryRoot);
  const relative = path.relative(repositoryRoot, target);

  assert.equal(resolveSharedCargoTargetDir(repositoryRoot), target);
  const isInsideRepository =
    !path.isAbsolute(relative) && relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`);
  assert.equal(isInsideRepository, false);
  assert.equal(path.basename(target), "cargo-target");
});

test("keeps an explicitly configured Cargo target unchanged", () => {
  const original = process.env.CARGO_TARGET_DIR;
  process.env.CARGO_TARGET_DIR = "D:/moyang-explicit-target";
  try {
    assert.equal(resolveSharedCargoTargetDir("D:/repo"), path.resolve("D:/moyang-explicit-target"));
  } finally {
    if (original === undefined) delete process.env.CARGO_TARGET_DIR;
    else process.env.CARGO_TARGET_DIR = original;
  }
});

test("linked worktrees resolve to the same repository target directory", (t) => {
  const repositoryRoot = resolveRepositoryRoot();
  const linkedWorktree = path.join(repositoryRoot, ".codex-worktrees", "context-menu-focus-2026-08-30");

  if (!fs.existsSync(linkedWorktree)) {
    t.skip("linked worktree path is not available on this platform");
    return;
  }

  assert.equal(resolveSharedCargoTargetDir(linkedWorktree), resolveSharedCargoTargetDir(repositoryRoot));
});
