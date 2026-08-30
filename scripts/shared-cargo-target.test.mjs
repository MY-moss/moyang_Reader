import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createBuildEnvironment,
  resolveDefaultSharedCargoTargetDir,
  resolveSharedCargoTargetDir,
} from "./shared-cargo-target.mjs";

function withCacheEnvironment(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cache-root-"));
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cache-"));
  const previousCacheRoot = process.env.MOYANG_BUILD_CACHE_DIR;
  const previousTarget = process.env.CARGO_TARGET_DIR;
  process.env.MOYANG_BUILD_CACHE_DIR = cacheRoot;
  delete process.env.CARGO_TARGET_DIR;

  try {
    return callback(root, cacheRoot);
  } finally {
    if (previousCacheRoot === undefined) delete process.env.MOYANG_BUILD_CACHE_DIR;
    else process.env.MOYANG_BUILD_CACHE_DIR = previousCacheRoot;
    if (previousTarget === undefined) delete process.env.CARGO_TARGET_DIR;
    else process.env.CARGO_TARGET_DIR = previousTarget;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
}

test("uses one stable managed cache outside the repository", () =>
  withCacheEnvironment((root) => {
    const target = resolveSharedCargoTargetDir(root);
    const relative = path.relative(root, target);

    assert.equal(target, resolveDefaultSharedCargoTargetDir(root));
    assert.equal(!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`), false);
    assert.equal(path.basename(target), "cargo-target");
  }));

test("redirects a repository-local CARGO_TARGET_DIR to the managed cache", () =>
  withCacheEnvironment((root) => {
    process.env.CARGO_TARGET_DIR = path.join(root, "src-tauri", "target");

    assert.equal(resolveSharedCargoTargetDir(root), resolveDefaultSharedCargoTargetDir(root));
    assert.equal(
      createBuildEnvironment(root, { CARGO_TARGET_DIR: path.join(root, "target") }).CARGO_TARGET_DIR,
      resolveDefaultSharedCargoTargetDir(root),
    );
  }));

test("redirects a repository-local cache override outside the repository", () =>
  withCacheEnvironment((root) => {
    process.env.MOYANG_BUILD_CACHE_DIR = path.join(root, ".codex-cache");

    const target = resolveDefaultSharedCargoTargetDir(root);
    const relative = path.relative(root, target);
    assert.equal(!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`), false);
  }));

test("keeps an explicitly configured Cargo target outside the repository", () =>
  withCacheEnvironment((root) => {
    const externalTarget = path.join(path.dirname(root), "moyang-explicit-target");
    process.env.CARGO_TARGET_DIR = externalTarget;

    assert.equal(resolveSharedCargoTargetDir(root), path.resolve(externalTarget));
  }));
