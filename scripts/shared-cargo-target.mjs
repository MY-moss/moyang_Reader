import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepositoryRoot } from "./repository-root.mjs";

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function isInside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function resolveDefaultSharedCargoTargetDir(projectRoot = defaultProjectRoot) {
  const repositoryRoot = resolveRepositoryRoot(projectRoot);
  const configuredRoot = resolveBuildCacheRoot();
  const cacheRoot = isInside(configuredRoot, repositoryRoot)
    ? path.join(os.tmpdir(), "moyang-reader-build-cache")
    : configuredRoot;
  return path.join(cacheRoot, repositoryCacheKey(repositoryRoot), "cargo-target");
}

export function resolveSharedCargoTargetDir(projectRoot = defaultProjectRoot) {
  const repositoryRoot = resolveRepositoryRoot(projectRoot);
  const configuredTarget = process.env.CARGO_TARGET_DIR?.trim();

  if (configuredTarget) {
    const resolvedTarget = path.resolve(projectRoot, configuredTarget);
    if (!isInside(resolvedTarget, repositoryRoot)) return resolvedTarget;
  }

  // A repository-local target can grow by several GiB and is duplicated by
  // every worktree. Always redirect it to one user-level cache instead.
  return resolveDefaultSharedCargoTargetDir(projectRoot);
}

export function createBuildEnvironment(projectRoot = defaultProjectRoot, overrides = {}) {
  return {
    ...process.env,
    ...overrides,
    CARGO_TARGET_DIR: resolveSharedCargoTargetDir(projectRoot),
  };
}
