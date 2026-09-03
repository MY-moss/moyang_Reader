#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  governanceFiles,
  isAllowedPath,
  isProtectedPath,
  loadApprovalFromMain,
  loadGovernance,
  renderNext,
  validatePlan,
  validatePolicy,
  validateState,
  validateStateTransition,
} from "./ai-state.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitCommand = process.platform === "win32" ? "git.exe" : "git";

export const contextLimits = new Map([
  ["AGENTS.md", { maxBytes: 8_000, maxLines: 120 }],
  ["docs/ai/policy.json", { maxBytes: 5_000, maxLines: 120 }],
  ["docs/ai/plan-v1.json", { maxBytes: 24_000, maxLines: 420 }],
  ["docs/ai/state.json", { maxBytes: 4_000, maxLines: 100 }],
  ["docs/NEXT.md", { maxBytes: 6_000, maxLines: 100 }],
  ["docs/AI-HANDOFF.md", { maxBytes: 8_000, maxLines: 100 }],
  ["docs/AI-WORKFLOW.md", { maxBytes: 16_000, maxLines: 180 }],
  ["docs/AI-TAKEOVER-PROMPT.md", { maxBytes: 4_000, maxLines: 50 }],
  ["docs/ROADMAP.md", { maxBytes: 14_000, maxLines: 180 }],
  ["tasks/plan.md", { maxBytes: 12_000, maxLines: 160 }],
  ["tasks/todo.md", { maxBytes: 3_000, maxLines: 40 }],
]);

function readText(projectRoot, relativePath, errors) {
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  } catch (cause) {
    errors.push(`${relativePath} 无法读取：${cause instanceof Error ? cause.message : String(cause)}`);
    return "";
  }
}

function runGit(projectRoot, args) {
  return execFileSync(gitCommand, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function previousStateFromMain(projectRoot) {
  try {
    return JSON.parse(runGit(projectRoot, ["show", `origin/main:${governanceFiles.state}`]));
  } catch {
    return null;
  }
}

function changedPaths(projectRoot) {
  const changed = new Set();
  try {
    for (const line of runGit(projectRoot, ["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/)) {
      if (!line) continue;
      const pathOffset = line[2] === " " ? 3 : line[1] === " " ? 2 : 3;
      const rawPath = line.slice(pathOffset).replace(/^"|"$/g, "");
      const candidate = rawPath.includes(" -> ") ? rawPath.slice(rawPath.lastIndexOf(" -> ") + 4) : rawPath;
      changed.add(candidate.replaceAll("\\", "/"));
    }
  } catch {
    return [];
  }
  try {
    for (const relativePath of runGit(projectRoot, ["diff", "--name-only", "origin/main...HEAD"]).split(/\r?\n/)) {
      if (relativePath) changed.add(relativePath.replaceAll("\\", "/"));
    }
  } catch {
    // A local repository without origin/main is still covered by content validation.
  }
  return [...changed];
}

export function activeTaskRange(plan, previous, state) {
  if (!previous) return plan.tasks.slice(0, state.queueIndex + 1);
  if (state.queueIndex === previous.queueIndex + 1) return [plan.tasks[previous.queueIndex]];
  return [plan.tasks[state.queueIndex]];
}

export function validateChangedPathSet(changed, policy, tasks, status) {
  const errors = [];
  const outside = changed.filter((relativePath) => !isAllowedPath(relativePath, tasks));
  if (outside.length > 0) errors.push(`修改超出当前任务允许范围：${outside.join("，")}。`);
  const protectedChanges = changed.filter((relativePath) => isProtectedPath(relativePath, policy));
  if (protectedChanges.length > 0 && status !== "AWAITING_APPROVAL") {
    errors.push(`治理保护文件发生变化，状态必须是 AWAITING_APPROVAL：${protectedChanges.join("，")}。`);
  }
  return errors;
}

export function validateApprovalSource(state, plan, receiptFromMain) {
  if (state.approval === null || state.approval === undefined) return [];
  const task = plan.tasks[state.queueIndex];
  if (!receiptFromMain) return [`任务 ${task.id} 的审批凭证尚未合入 origin/main。`];
  return JSON.stringify(state.approval) === JSON.stringify(receiptFromMain)
    ? []
    : [`任务 ${task.id} 的 state.approval 与 origin/main 审批凭证不一致。`];
}

function validateChangedPaths(projectRoot, policy, plan, state, previous, errors) {
  const changed = changedPaths(projectRoot);
  if (changed.length === 0) return;
  const tasks = activeTaskRange(plan, previous, state);
  errors.push(...validateChangedPathSet(changed, policy, tasks, state.status));
}

export function validateAiContext(projectRoot = defaultRoot, { inspectGit = true } = {}) {
  const errors = [];
  const documents = new Map();

  for (const [relativePath, limit] of contextLimits) {
    const value = readText(projectRoot, relativePath, errors);
    documents.set(relativePath, value);
    const bytes = Buffer.byteLength(value, "utf8");
    const lines = value === "" ? 0 : value.split(/\r?\n/).length;
    if (bytes > limit.maxBytes || lines > limit.maxLines) {
      errors.push(`${relativePath} 超出上下文预算：${bytes}/${limit.maxBytes} bytes，${lines}/${limit.maxLines} 行。`);
    }
  }

  let policy;
  let plan;
  let state;
  try {
    ({ policy, plan, state } = loadGovernance(projectRoot));
  } catch (cause) {
    errors.push(`结构化 AI 状态无法读取：${cause instanceof Error ? cause.message : String(cause)}`);
    return errors;
  }
  errors.push(...validatePolicy(policy), ...validatePlan(plan, policy), ...validateState(state, plan, policy));

  if (documents.get(governanceFiles.next) !== renderNext(plan, state)) {
    errors.push("docs/NEXT.md 与结构化状态不一致；请运行 npm run ai:render，禁止手工修改。");
  }

  const previous = inspectGit ? previousStateFromMain(projectRoot) : null;
  if (previous) errors.push(...validateStateTransition(previous, state, plan, policy));
  if (inspectGit && state.approval) {
    const task = plan.tasks[state.queueIndex];
    let receiptFromMain = null;
    try {
      receiptFromMain = loadApprovalFromMain(projectRoot, policy, plan, task);
    } catch {
      // The source validator below emits the stable, non-sensitive error.
    }
    errors.push(...validateApprovalSource(state, plan, receiptFromMain));
  }
  if (inspectGit) validateChangedPaths(projectRoot, policy, plan, state, previous, errors);

  if (!documents.get("AGENTS.md")?.includes("npm run ai:context")) {
    errors.push("AGENTS.md 必须把 npm run ai:context 声明为动态任务入口。");
  }
  if (!documents.get("docs/AI-TAKEOVER-PROMPT.md")?.includes("npm run ai:context")) {
    errors.push("AI 接手提示词必须使用 npm run ai:context 获取当前任务。");
  }
  if (/^- \[[ xX]\]/m.test(documents.get("tasks/todo.md") ?? "")) {
    errors.push("tasks/todo.md 只能作为索引，不得复制动态复选清单。");
  }

  const releaseStatus = readText(projectRoot, "docs/release-status.json", errors);
  if (/"nextStatus"\s*:/.test(releaseStatus)) {
    errors.push("release-status.json 不得复制开发任务状态 nextStatus。");
  }

  const startupBytes =
    Buffer.byteLength(documents.get("AGENTS.md") ?? "", "utf8") +
    Buffer.byteLength(documents.get(governanceFiles.state) ?? "", "utf8");
  if (startupBytes > 10_000) errors.push(`默认接手上下文超出 10000 bytes：${startupBytes}。`);
  return errors;
}

export function runAiContextCheck(projectRoot = defaultRoot) {
  const errors = validateAiContext(projectRoot);
  if (errors.length > 0) {
    console.error("AI governance check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    return 1;
  }
  console.log(
    "AI governance check passed: protected policy, one structured state, generated handoff, bounded context.",
  );
  return 0;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) process.exitCode = runAiContextCheck();
