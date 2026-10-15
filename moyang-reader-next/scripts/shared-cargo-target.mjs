import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitCommand = process.platform === "win32" ? "git.exe" : "git";

export function resolveRepositoryRoot(projectRoot = defaultProjectRoot) {
  try {
    const commonDir = execFileSync(gitCommand, ["rev-parse", "--git-common-dir"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (commonDir) {
      const resolvedCommonDir = path.resolve(projectRoot, commonDir);
      if (path.basename(resolvedCommonDir).toLowerCase() === ".git") {
        return path.dirname(resolvedCommonDir);
      }
    }
  } catch {
    // Fall back to the conventional Codex worktree layout when Git is unavailable.
  }

  const parent = path.dirname(projectRoot);
  if (path.basename(parent).toLowerCase() === ".codex-worktrees") {
    return path.dirname(parent);
  }
  return projectRoot;
}

function resolveBuildCacheRoot() {
  const configuredRoot = process.env.MOYANG_BUILD_CACHE_DIR?.trim();
  if (configuredRoot) return path.resolve(configuredRoot);

  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (localAppData) return path.join(localAppData, "Moyang Reader", "build-cache");

  const xdgCacheHome = process.env.XDG_CACHE_HOME?.trim();
  if (xdgCacheHome) return path.join(xdgCacheHome, "moyang-reader", "build-cache");

  return path.join(os.tmpdir(), "moyang-reader-build-cache");
}

function repositoryCacheKey(repositoryRoot) {
  return crypto.createHash("sha256").update(path.resolve(repositoryRoot).toLowerCase()).digest("hex").slice(0, 12);
}

export function resolveDefaultSharedCargoTargetDir(projectRoot = defaultProjectRoot) {
  const repositoryRoot = resolveRepositoryRoot(projectRoot);
  return path.join(resolveBuildCacheRoot(), repositoryCacheKey(repositoryRoot), "cargo-target");
}

export function resolveSharedCargoTargetDir(projectRoot = defaultProjectRoot) {
  const configuredTarget = process.env.CARGO_TARGET_DIR?.trim();
  if (configuredTarget) return path.resolve(projectRoot, configuredTarget);

  return resolveDefaultSharedCargoTargetDir(projectRoot);
}

export function createBuildEnvironment(projectRoot = defaultProjectRoot, overrides = {}) {
  return {
    ...process.env,
    CARGO_TARGET_DIR: resolveSharedCargoTargetDir(projectRoot),
    ...overrides,
  };
}
