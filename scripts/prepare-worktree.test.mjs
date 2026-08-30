import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureSharedNodeModules } from "./prepare-worktree.mjs";

test("refuses to prepare a path outside the managed worktree root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-prepare-"));
  assert.throws(() => ensureSharedNodeModules(path.join(root, "outside"), root), /\.codex-worktrees/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("does not overwrite a real dependency directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-prepare-"));
  const worktree = path.join(root, ".codex-worktrees", "feature");
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(worktree, "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "node_modules", "keep.txt"), "keep");

  assert.throws(() => ensureSharedNodeModules(worktree, root), /已有真实 node_modules/);
  assert.equal(fs.existsSync(path.join(worktree, "node_modules", "keep.txt")), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("creates a junction to the main dependency directory on Windows", { skip: process.platform !== "win32" }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-prepare-"));
  const worktree = path.join(root, ".codex-worktrees", "feature");
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });

  const result = ensureSharedNodeModules(worktree, root);
  assert.equal(result.status, "linked");
  assert.equal(fs.realpathSync(path.join(worktree, "node_modules")), fs.realpathSync(path.join(root, "node_modules")));

  fs.rmSync(root, { recursive: true, force: true });
});
