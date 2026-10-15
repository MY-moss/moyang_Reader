import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  resolveDefaultSharedCargoTargetDir,
  resolveRepositoryRoot,
  resolveSharedCargoTargetDir,
} from "./shared-cargo-target.mjs";

function withEnvironment(values, run) {
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return run();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("uses one stable managed cache outside the repository", () =>
  withEnvironment(
    {
      CARGO_TARGET_DIR: undefined,
      MOYANG_BUILD_CACHE_DIR: path.join(os.tmpdir(), "moyang-cache-test"),
    },
    () => {
      const repositoryRoot = resolveRepositoryRoot();
      const target = resolveDefaultSharedCargoTargetDir(repositoryRoot);
      const relative = path.relative(repositoryRoot, target);

      assert.equal(resolveSharedCargoTargetDir(repositoryRoot), target);
      const isInsideRepository =
        !path.isAbsolute(relative) && relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`);
      assert.equal(isInsideRepository, false);
      assert.equal(path.basename(target), "cargo-target");
    },
  ));

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

test("linked worktrees resolve to the same repository target directory", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cargo-worktree-"));
  const repositoryRoot = path.join(fixture, "repository");
  const linkedWorktree = path.join(fixture, "linked");
  const hooks = path.join(fixture, "empty-hooks");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(hooks);
  const git = (...args) =>
    execFileSync("git", ["-c", `core.hooksPath=${hooks}`, ...args], {
      cwd: repositoryRoot,
      stdio: "pipe",
      windowsHide: true,
    });
  try {
    git("init", "--quiet");
    git(
      "-c",
      "user.name=Moyang test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    );
    git("worktree", "add", "--quiet", "--detach", linkedWorktree, "HEAD");
    withEnvironment({ CARGO_TARGET_DIR: undefined, MOYANG_BUILD_CACHE_DIR: path.join(fixture, "cache") }, () => {
      assert.equal(
        fs.realpathSync.native(resolveRepositoryRoot(linkedWorktree)),
        fs.realpathSync.native(repositoryRoot),
      );
      assert.equal(resolveSharedCargoTargetDir(linkedWorktree), resolveSharedCargoTargetDir(repositoryRoot));
    });
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith("moyang-cargo-worktree-"));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
