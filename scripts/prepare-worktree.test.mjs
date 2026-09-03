import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareWorktreeDependencies, resolveNpmInvocation, validateWorktreeForInstall } from "./prepare-worktree.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-prepare-"));
  const worktree = path.join(root, ".codex-worktrees", "feature");
  fs.mkdirSync(worktree, { recursive: true });
  fs.writeFileSync(path.join(worktree, "package-lock.json"), "{}\n", "utf8");
  return { root, worktree };
}

test("refuses to prepare a path outside the managed worktree root", () => {
  const { root } = fixture();
  try {
    assert.throws(() => validateWorktreeForInstall(path.join(root, "outside"), root), /\.codex-worktrees/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not depend on the root node_modules directory", () => {
  const { root, worktree } = fixture();
  try {
    assert.equal(validateWorktreeForInstall(worktree, root), path.resolve(worktree));
    assert.equal(fs.existsSync(path.join(root, "node_modules")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runs an independent reproducible install in the target worktree", () => {
  const { root, worktree } = fixture();
  const calls = [];
  try {
    const result = prepareWorktreeDependencies(worktree, root, (command, args, options) => {
      calls.push({ command, args, options });
    });
    assert.equal(result.status, "installed");
    assert.deepEqual(calls[0].args.slice(-2), ["ci", "--prefer-offline"]);
    assert.equal(calls[0].options.cwd, path.resolve(worktree));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("uses the active npm JavaScript CLI when available", () => {
  const invocation = resolveNpmInvocation("C:\\tools\\npm-cli.js");
  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args, ["C:\\tools\\npm-cli.js", "ci", "--prefer-offline"]);
});

test("refuses to overwrite a legacy node_modules junction", { skip: process.platform !== "win32" }, () => {
  const { root, worktree } = fixture();
  const shared = path.join(root, "shared-modules");
  fs.mkdirSync(shared, { recursive: true });
  fs.symlinkSync(shared, path.join(worktree, "node_modules"), "junction");
  try {
    assert.throws(() => validateWorktreeForInstall(worktree, root), /junction/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
