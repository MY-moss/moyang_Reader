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

export function measurePath(candidate) {
  const stat = readLinkSafe(candidate);
  if (!stat || stat.isSymbolicLink()) return 0;
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;

  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(candidate, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) total += measurePath(path.join(candidate, entry.name));
  return total;
}

function addArtifact(results, basePath, spec) {
  const artifactPath = path.join(basePath, spec.relative);
  addArtifactAt(results, artifactPath, spec.label, Boolean(spec.protected));
}

function addArtifactAt(results, artifactPath, label, protectedArtifact = false) {
  if (!readLinkSafe(artifactPath)) return;
  results.push({
    path: artifactPath,
    label,
    protected: protectedArtifact,
    bytes: measurePath(artifactPath),
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

export function formatBytes(bytes) {
  const kib = 1024;
  const mib = kib * 1024;
  const gib = mib * 1024;
  if (bytes >= gib) return `${(bytes / gib).toFixed(2)} GiB`;
  if (bytes >= mib) return `${(bytes / mib).toFixed(1)} MiB`;
  if (bytes >= kib) return `${(bytes / kib).toFixed(1)} KiB`;
  return `${bytes} B`;
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

    if (changes) {
      skipped.push(`${path.basename(worktreePath)}: 有未提交改动`);
      continue;
    }

    const links = findReparsePoints(worktreePath);
    if (links.length > 0) {
      skipped.push(`${path.basename(worktreePath)}: 含 junction/符号链接，已跳过`);
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
