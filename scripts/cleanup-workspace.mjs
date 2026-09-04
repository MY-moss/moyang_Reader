import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveDefaultSharedCargoTargetDir } from "./shared-cargo-target.mjs";
import { resolveRepositoryRoot } from "./repository-root.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitCommand = process.platform === "win32" ? "git.exe" : "git";

const generatedPaths = [
  { relative: "dist", label: "前端构建" },
  { relative: "coverage", label: "覆盖率" },
  { relative: "test-results", label: "浏览器测试" },
  { relative: "playwright-report", label: "Playwright 报告" },
  { relative: ".vite", label: "Vite 缓存" },
  { relative: ".vite-temp", label: "Vite 临时文件" },
  { relative: ".turbo", label: "任务缓存" },
  { relative: ".cache", label: "工具缓存" },
  { relative: ".codex-cache", label: "AI 工作缓存" },
  { relative: "src-tauri/target", label: "Rust 构建", protected: true },
];

const repositoryGeneratedPaths = [
  { relative: ".codex-worktrees/.shared-cargo-target", label: "共享 Rust 构建", protected: true },
];

const legacyCargoCacheDirectoryPattern = /^[a-f0-9]{12}$/i;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const bytesPerGib = 1024 ** 3;

export const DEFAULT_BUILD_CACHE_BUDGET_BYTES = 4 * bytesPerGib;
export const DEFAULT_BUILD_CACHE_IDLE_DAYS = 14;

function runGit(args, cwd = projectRoot) {
  return execFileSync(gitCommand, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function parseWorktreeList(output) {
  const entries = [];
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length) };
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    } else if (current && line === "detached") {
      current.detached = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}

export function isManagedWorktreePath(candidate, root) {
  const managedRoot = path.resolve(root ?? path.join(resolveRepositoryRoot(projectRoot), ".codex-worktrees"));
  const relative = path.relative(managedRoot, path.resolve(candidate));
  const parts = relative.split(path.sep).filter(Boolean);
  return parts.length === 1 && parts[0] !== "." && !parts[0].startsWith(".");
}

function readLinkSafe(candidate) {
  try {
    return fs.lstatSync(candidate);
  } catch {
    return null;
  }
}

export function isReparsePoint(candidate) {
  return Boolean(readLinkSafe(candidate)?.isSymbolicLink());
}

export function findReparsePoints(root, limit = 16) {
  const found = [];

  function visit(candidate) {
    if (found.length >= limit) return;
    const stat = readLinkSafe(candidate);
    if (!stat) return;
    if (stat.isSymbolicLink()) {
      found.push(candidate);
      return;
    }
    if (!stat.isDirectory()) return;

    let entries;
    try {
      entries = fs.readdirSync(candidate, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      visit(path.join(candidate, entry.name));
      if (found.length >= limit) return;
    }
  }

  visit(path.resolve(root));
  return found;
}

export function inspectPath(candidate) {
  const stat = readLinkSafe(candidate);
  if (!stat || stat.isSymbolicLink()) return { bytes: 0, lastActivityMs: null };
  if (stat.isFile()) return { bytes: stat.size, lastActivityMs: stat.mtimeMs };
  if (!stat.isDirectory()) return { bytes: 0, lastActivityMs: stat.mtimeMs };

  let bytes = 0;
  let lastActivityMs = stat.mtimeMs;
  let entries;
  try {
    entries = fs.readdirSync(candidate, { withFileTypes: true });
  } catch {
    return { bytes, lastActivityMs };
  }
  for (const entry of entries) {
    const child = inspectPath(path.join(candidate, entry.name));
    bytes += child.bytes;
    if (child.lastActivityMs !== null) lastActivityMs = Math.max(lastActivityMs, child.lastActivityMs);
  }
  return { bytes, lastActivityMs };
}

export function measurePath(candidate) {
  return inspectPath(candidate).bytes;
}

export function assessBuildCacheBudget(
  artifact,
  { nowMs = Date.now(), budgetBytes = DEFAULT_BUILD_CACHE_BUDGET_BYTES, idleDays = DEFAULT_BUILD_CACHE_IDLE_DAYS } = {},
) {
  const lastActivityMs = Number.isFinite(artifact.lastActivityMs) ? artifact.lastActivityMs : null;
  const idleMs = lastActivityMs === null ? null : Math.max(0, nowMs - lastActivityMs);
  const idleAgeDays = idleMs === null ? null : idleMs / millisecondsPerDay;
  return {
    bytes: artifact.bytes,
    budgetBytes,
    idleDays: idleAgeDays,
    idleThresholdDays: idleDays,
    overBudget: artifact.bytes > budgetBytes,
    overIdle: idleAgeDays !== null && idleAgeDays >= idleDays,
  };
}

function formatIdleAge(idleDays) {
  if (idleDays === null) return "未知";
  if (idleDays >= 1) return `${Math.floor(idleDays)} 天`;
  const hours = idleDays * 24;
  if (hours >= 1) return `${Math.floor(hours)} 小时`;
  return `${Math.max(0, Math.floor(hours * 60))} 分钟`;
}

export function formatBuildCacheBudgetReport(artifact, options = {}) {
  const assessment = assessBuildCacheBudget(artifact, options);
  const summary =
    `构建缓存：${artifact.path}；大小 ${formatBytes(assessment.bytes)}（预算 ${formatBytes(assessment.budgetBytes)}）；` +
    `闲置 ${formatIdleAge(assessment.idleDays)}（阈值 ${assessment.idleThresholdDays} 天）。`;
  if (!assessment.overBudget && !assessment.overIdle) {
    return `${summary}预算状态：正常；受保护 target 默认只报告不删除。`;
  }

  const reasons = [];
  if (assessment.overBudget) reasons.push(`超过大小预算 ${formatBytes(assessment.budgetBytes)}`);
  if (assessment.overIdle) reasons.push(`超过闲置阈值 ${assessment.idleThresholdDays} 天`);
  return (
    `${summary}预算提示：${reasons.join("，")}。` +
    "该受保护 target 默认只报告不删除；确认没有活动 Rust 构建后，可显式运行 " +
    "npm run cleanup:workspace -- --apply --prune-targets 回收。"
  );
}

function addArtifact(results, basePath, spec) {
  const artifactPath = path.join(basePath, spec.relative);
  addArtifactAt(results, artifactPath, spec.label, Boolean(spec.protected));
}

function addArtifactAt(results, artifactPath, label, protectedArtifact = false) {
  if (!readLinkSafe(artifactPath)) return;
  const details = inspectPath(artifactPath);
  results.push({
    path: artifactPath,
    label,
    protected: protectedArtifact,
    bytes: details.bytes,
    lastActivityMs: details.lastActivityMs,
    reparsePoint: isReparsePoint(artifactPath),
  });
}

function collectManagedCargoTargets(repositoryRoot) {
  const currentTarget = resolveDefaultSharedCargoTargetDir(repositoryRoot);
  const cacheRoot = path.dirname(currentTarget);
  const results = [];

  addArtifactAt(results, currentTarget, "共享 Rust 构建（用户缓存）", true);

  const cacheStat = readLinkSafe(cacheRoot);
  if (!cacheStat || cacheStat.isSymbolicLink() || !cacheStat.isDirectory()) return results;

  let entries;
  try {
    entries = fs.readdirSync(cacheRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !legacyCargoCacheDirectoryPattern.test(entry.name)) continue;
    const legacyTarget = path.join(cacheRoot, entry.name, "cargo-target");
    if (path.resolve(legacyTarget).toLowerCase() === path.resolve(currentTarget).toLowerCase()) continue;
    addArtifactAt(results, legacyTarget, "旧版共享 Rust 构建（用户缓存）", true);
  }
  return results;
}

export function collectGeneratedArtifacts(repositoryRoot, worktreeEntries = []) {
  const results = [];
  const bases = [
    path.resolve(repositoryRoot),
    ...worktreeEntries
      .map((entry) => path.resolve(entry.path))
      .filter((candidate) =>
        isManagedWorktreePath(candidate, path.join(path.resolve(repositoryRoot), ".codex-worktrees")),
      ),
  ];
  const uniqueBases = [...new Set(bases)];

  for (const basePath of uniqueBases) {
    for (const spec of generatedPaths) addArtifact(results, basePath, spec);
  }
  for (const spec of repositoryGeneratedPaths) addArtifact(results, path.resolve(repositoryRoot), spec);
  results.push(...collectManagedCargoTargets(repositoryRoot));
  return results;
}

function hasChanges(worktreePath) {
  return runGit(["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=all"], worktreePath).trim();
}

export function assessWorktreeRemovalEvidence(
  entry,
  { hasChanges: dirty = false, reparsePointCount = 0, mergedIntoMain = false } = {},
) {
  if (entry.detached || !entry.branch) {
    return { removable: false, reason: "缺少可核验分支（detached）" };
  }
  if (!entry.branch.startsWith("refs/heads/codex/")) {
    return { removable: false, reason: "不是受管 codex/ 分支" };
  }
  if (dirty) return { removable: false, reason: "有未提交改动" };
  if (reparsePointCount > 0) return { removable: false, reason: "含 junction/符号链接，已跳过" };
  if (!mergedIntoMain) return { removable: false, reason: "分支尚未合并到 origin/main" };
  return { removable: true, reason: "目录干净且 codex/ 分支已合并到 origin/main" };
}

function isMergedIntoMain(branch, repositoryRoot) {
  try {
    runGit(["merge-base", "--is-ancestor", branch, "origin/main"], repositoryRoot);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes) {
  const kib = 1024;
  const mib = kib * 1024;
  const gib = mib * 1024;
  if (bytes >= gib) return `${(bytes / gib).toFixed(2)} GiB`;
  if (bytes >= mib) return `${(bytes / mib).toFixed(1)} MiB`;
  if (bytes >= kib) return `${(bytes / kib).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function printBuildCacheBudget(artifacts) {
  const cacheArtifacts = artifacts.filter((artifact) => artifact.protected && artifact.label.includes("Rust 构建"));
  if (cacheArtifacts.length === 0) {
    console.log("构建缓存预算：未发现受管 Cargo target。");
    return;
  }
  for (const artifact of cacheArtifacts) console.log(formatBuildCacheBudgetReport(artifact));
}

function removeArtifact(artifact) {
  if (artifact.reparsePoint) {
    return { removed: false, reason: "reparse point，已跳过" };
  }
  fs.rmSync(artifact.path, { recursive: true, force: true });
  return { removed: true };
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--apply") && args.has("--dry-run")) {
    console.error("--apply 与 --dry-run 不能同时使用。");
    process.exitCode = 2;
    return;
  }
  const apply = args.has("--apply");
  const pruneTargets = args.has("--prune-targets");
  const pruneWorktrees = args.has("--prune-worktrees");
  const repositoryRoot = resolveRepositoryRoot(projectRoot);
  const entries = parseWorktreeList(runGit(["worktree", "list", "--porcelain"]));
  const currentRoot = path.resolve(repositoryRoot);
  const candidates = entries.filter(
    (entry) => path.resolve(entry.path) !== currentRoot && isManagedWorktreePath(entry.path),
  );
  const artifacts = collectGeneratedArtifacts(repositoryRoot, entries);
  const cleanableArtifacts = artifacts.filter((artifact) => !artifact.protected || pruneTargets);
  const protectedArtifacts = artifacts.filter((artifact) => artifact.protected && !pruneTargets);
  const removable = [];
  const skipped = [];
  let removedBytes = 0;
  const failures = [];

  printBuildCacheBudget(artifacts);

  for (const artifact of cleanableArtifacts) {
    if (!apply) continue;
    try {
      const result = removeArtifact(artifact);
      if (result.removed) removedBytes += artifact.bytes;
      else failures.push(`${artifact.path}: ${result.reason}`);
    } catch (error) {
      failures.push(`${artifact.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const entry of candidates) {
    const worktreePath = path.resolve(entry.path);
    if (!fs.existsSync(worktreePath)) {
      skipped.push(`${path.basename(worktreePath)}: 路径不存在`);
      continue;
    }

    let changes;
    try {
      changes = hasChanges(worktreePath);
    } catch {
      skipped.push(`${path.basename(worktreePath)}: 无法读取 Git 状态`);
      continue;
    }

    const links = findReparsePoints(worktreePath);
    const evidence = assessWorktreeRemovalEvidence(entry, {
      hasChanges: Boolean(changes),
      reparsePointCount: links.length,
      mergedIntoMain: isMergedIntoMain(entry.branch, repositoryRoot),
    });
    if (!evidence.removable) {
      skipped.push(`${path.basename(worktreePath)}: ${evidence.reason}`);
      continue;
    }
    removable.push(worktreePath);
  }

  if (apply && pruneWorktrees) {
    for (const worktreePath of removable) {
      try {
        runGit(["worktree", "remove", "--", worktreePath]);
      } catch (error) {
        failures.push(
          `${worktreePath}: 工作树移除失败，已保留；${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    runGit(["worktree", "prune"]);
  }

  const artifactBytes = cleanableArtifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
  const mode = apply ? "已执行" : "预览";
  console.log(
    `${mode}：生成物 ${cleanableArtifacts.length} 个（${formatBytes(artifactBytes)}），` +
      `受保护目标 ${protectedArtifacts.length} 个；` +
      `可移除工作树 ${removable.length} 个，保留 ${skipped.length} 个。`,
  );
  if (apply) console.log(`本次释放（按实际文件大小估算）：${formatBytes(removedBytes)}。`);
  if (cleanableArtifacts.length > 0) {
    for (const artifact of cleanableArtifacts.slice(0, 40)) {
      console.log(`- ${formatBytes(artifact.bytes)} ${artifact.label}: ${artifact.path}`);
    }
  }
  if (removable.length > 0) {
    console.log(`可回收工作树：${removable.map((candidate) => path.basename(candidate)).join("、")}。`);
  }
  if (protectedArtifacts.length > 0) {
    console.log("受保护构建目标：使用 --prune-targets 后才会清理。");
  }
  if (skipped.length > 0) console.log(`保留原因：${skipped.join("；")}`);
  if (failures.length > 0) {
    console.error(`清理失败 ${failures.length} 项：${failures.slice(0, 8).join("；")}`);
    process.exitCode = 1;
  }
  if (!apply) {
    console.log("仅预览；确认输出后使用 --apply。工作树回收还需要额外指定 --prune-worktrees。");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
