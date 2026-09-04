import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assessWorktreeRemovalEvidence,
  assessBuildCacheBudget,
  collectGeneratedArtifacts,
  formatBuildCacheBudgetReport,
  findReparsePoints,
  inspectPath,
  isManagedWorktreePath,
  measurePath,
  parseWorktreeList,
} from "./cleanup-workspace.mjs";

test("only removes clean merged worktrees with managed branch evidence", () => {
  const managed = { path: "D:/repo/.codex-worktrees/feature", branch: "refs/heads/codex/feature" };

  assert.deepEqual(assessWorktreeRemovalEvidence(managed, { mergedIntoMain: true }), {
    removable: true,
    reason: "目录干净且 codex/ 分支已合并到 origin/main",
  });
  assert.equal(assessWorktreeRemovalEvidence(managed).removable, false);
  assert.equal(assessWorktreeRemovalEvidence(managed, { hasChanges: true, mergedIntoMain: true }).removable, false);
  assert.equal(assessWorktreeRemovalEvidence(managed, { reparsePointCount: 1, mergedIntoMain: true }).removable, false);
  assert.equal(
    assessWorktreeRemovalEvidence({ path: managed.path, detached: true }, { mergedIntoMain: true }).removable,
    false,
  );
  assert.equal(
    assessWorktreeRemovalEvidence({ path: managed.path, branch: "refs/heads/main" }, { mergedIntoMain: true })
      .removable,
    false,
  );
});

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
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cleanup-cache-"));
  const previousCacheRoot = process.env.MOYANG_BUILD_CACHE_DIR;
  const worktree = path.join(root, ".codex-worktrees", "feature");
  process.env.MOYANG_BUILD_CACHE_DIR = cacheRoot;
  try {
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
  } finally {
    if (previousCacheRoot === undefined) delete process.env.MOYANG_BUILD_CACHE_DIR;
    else process.env.MOYANG_BUILD_CACHE_DIR = previousCacheRoot;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
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

test("inspects cache size and latest activity without following links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-cache-inspect-"));
  const target = path.join(root, "cargo-target");
  const oldFile = path.join(target, "old.bin");
  const recentFile = path.join(target, "recent.bin");
  const oldActivity = Date.parse("2026-08-01T00:00:00Z");
  const recentActivity = Date.parse("2026-09-02T00:00:00Z");

  try {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(oldFile, "old");
    fs.writeFileSync(recentFile, "recent");
    fs.utimesSync(oldFile, oldActivity / 1000, oldActivity / 1000);
    fs.utimesSync(recentFile, recentActivity / 1000, recentActivity / 1000);
    fs.utimesSync(target, recentActivity / 1000, recentActivity / 1000);

    assert.deepEqual(inspectPath(target), { bytes: 9, lastActivityMs: recentActivity });
    assert.equal(measurePath(target), 9);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("marks an oversized and idle protected target for a dry-run warning", () => {
  const nowMs = Date.parse("2026-09-03T00:00:00Z");
  const artifact = {
    path: "D:/Moyang Reader/build-cache/cargo-target",
    label: "共享 Rust 构建（用户缓存）",
    protected: true,
    bytes: 5 * 1024 ** 3,
    lastActivityMs: Date.parse("2026-08-18T00:00:00Z"),
  };

  const assessment = assessBuildCacheBudget(artifact, {
    nowMs,
    budgetBytes: 4 * 1024 ** 3,
    idleDays: 14,
  });
  const message = formatBuildCacheBudgetReport(artifact, {
    nowMs,
    budgetBytes: 4 * 1024 ** 3,
    idleDays: 14,
  });

  assert.equal(assessment.overBudget, true);
  assert.equal(assessment.overIdle, true);
  assert.match(message, /D:\/Moyang Reader\/build-cache\/cargo-target/);
  assert.match(message, /5\.00 GiB/);
  assert.match(message, /闲置 16 天/);
  assert.match(message, /只报告不删除/);
  assert.match(message, /--apply --prune-targets/);
});

test("keeps a recent target quiet when it is inside both budgets", () => {
  const artifact = {
    path: "D:/Moyang Reader/build-cache/cargo-target",
    label: "共享 Rust 构建（用户缓存）",
    protected: true,
    bytes: 256 * 1024 ** 2,
    lastActivityMs: Date.parse("2026-09-02T12:00:00Z"),
  };
  const assessment = assessBuildCacheBudget(artifact, {
    nowMs: Date.parse("2026-09-03T00:00:00Z"),
    budgetBytes: 4 * 1024 ** 3,
    idleDays: 14,
  });

  assert.equal(assessment.overBudget, false);
  assert.equal(assessment.overIdle, false);
  assert.equal(assessment.idleDays, 0.5);
});
