import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveRepositoryRoot } from "./repository-root.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function isManagedWorktreePath(candidate, repositoryRoot) {
  const worktreeRoot = path.join(path.resolve(repositoryRoot), ".codex-worktrees");
  const relative = path.relative(worktreeRoot, path.resolve(candidate));
  const parts = relative.split(path.sep).filter(Boolean);
  return parts.length === 1 && !parts[0].startsWith(".");
}

function readLinkSafe(candidate) {
  try {
    return fs.lstatSync(candidate);
  } catch {
    return null;
  }
}

export function ensureSharedNodeModules(worktreePath, repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(worktreePath);
  if (!isManagedWorktreePath(target, root)) {
    throw new Error(`只允许为项目内 .codex-worktrees/ 下的单个工作树准备依赖：${target}`);
  }

  const source = path.join(root, "node_modules");
  if (!readLinkSafe(source)?.isDirectory()) {
    throw new Error(`主工作区依赖不存在，请先在主工作区安装依赖：${source}`);
  }

  const targetNodeModules = path.join(target, "node_modules");
  const existing = readLinkSafe(targetNodeModules);
  if (existing?.isSymbolicLink()) {
    const sourceReal = fs.realpathSync(source).toLowerCase();
    const targetReal = fs.realpathSync(targetNodeModules).toLowerCase();
    if (sourceReal === targetReal) return { status: "already-linked", path: targetNodeModules };
    throw new Error(`工作树已有指向其他位置的链接，拒绝覆盖：${targetNodeModules}`);
  }
  if (existing) {
    if (!existing.isDirectory() || fs.readdirSync(targetNodeModules).length > 0) {
      throw new Error(`工作树已有真实 node_modules，拒绝覆盖：${targetNodeModules}`);
    }
    fs.rmdirSync(targetNodeModules);
  }

  fs.symlinkSync(source, targetNodeModules, "junction");
  return { status: "linked", path: targetNodeModules };
}

function main() {
  const repositoryRoot = resolveRepositoryRoot(projectRoot);
  const requestedPath = process.argv.slice(2).find((value) => !value.startsWith("--"));
  const target = path.resolve(requestedPath ?? projectRoot);
  if (path.resolve(target) === path.resolve(repositoryRoot)) {
    console.log(`主工作区保留唯一真实依赖目录：${path.join(repositoryRoot, "node_modules")}`);
    return;
  }
  const result = ensureSharedNodeModules(target, repositoryRoot);
  console.log(
    result.status === "already-linked"
      ? `已使用共享依赖：${result.path}`
      : `已建立共享依赖 junction：${result.path}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
