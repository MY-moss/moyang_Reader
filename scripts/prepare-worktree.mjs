import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveRepositoryRoot } from "./repository-root.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export function resolveNpmInvocation(npmExecPath = process.env.npm_execpath) {
  return npmExecPath
    ? { command: process.execPath, args: [npmExecPath, "ci", "--prefer-offline"] }
    : { command: npmCommand, args: ["ci", "--prefer-offline"] };
}

export function isManagedWorktreePath(candidate, repositoryRoot) {
  const worktreeRoot = path.join(path.resolve(repositoryRoot), ".codex-worktrees");
  const relative = path.relative(worktreeRoot, path.resolve(candidate));
  const parts = relative.split(path.sep).filter(Boolean);
  return parts.length === 1 && !parts[0].startsWith(".");
}

function lstatSafe(candidate) {
  try {
    return fs.lstatSync(candidate);
  } catch {
    return null;
  }
}

export function validateWorktreeForInstall(worktreePath, repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(worktreePath);
  if (!isManagedWorktreePath(target, root)) {
    throw new Error(`只允许准备项目内 .codex-worktrees/ 下的单个工作树：${target}`);
  }
  if (!lstatSafe(target)?.isDirectory()) throw new Error(`工作树不存在：${target}`);
  if (!lstatSafe(path.join(target, "package-lock.json"))?.isFile()) {
    throw new Error(`工作树缺少 package-lock.json，不能执行可复现安装：${target}`);
  }
  const nodeModules = path.join(target, "node_modules");
  if (lstatSafe(nodeModules)?.isSymbolicLink()) {
    throw new Error(`检测到旧版共享 node_modules junction，拒绝覆盖：${nodeModules}`);
  }
  return target;
}

export function prepareWorktreeDependencies(
  worktreePath,
  repositoryRoot,
  runInstall = (command, args, options) => execFileSync(command, args, options),
) {
  const target = validateWorktreeForInstall(worktreePath, repositoryRoot);
  const invocation = resolveNpmInvocation();
  runInstall(invocation.command, invocation.args, {
    cwd: target,
    encoding: "utf8",
    stdio: "inherit",
  });
  return { status: "installed", path: path.join(target, "node_modules"), cwd: target };
}

function main() {
  const repositoryRoot = resolveRepositoryRoot(projectRoot);
  const requestedPath = process.argv.slice(2).find((value) => !value.startsWith("--"));
  const target = path.resolve(requestedPath ?? projectRoot);
  if (target === path.resolve(repositoryRoot)) {
    console.log("主工作区请直接运行 npm ci；worktree:prepare 只用于项目内独立工作树。");
    return;
  }
  const result = prepareWorktreeDependencies(target, repositoryRoot);
  console.log(`已在独立工作树安装依赖：${result.path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
