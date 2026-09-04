#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitCommand = process.platform === "win32" ? "git.exe" : "git";
const ghCommand = process.platform === "win32" ? "gh.exe" : "gh";

export const governanceFiles = {
  policy: "docs/ai/policy.json",
  plan: "docs/ai/plan-v1.json",
  state: "docs/ai/state.json",
  next: "docs/NEXT.md",
};

export const statuses = new Set([
  "PENDING_INTAKE",
  "READY",
  "IN_PROGRESS",
  "VERIFYING",
  "DELIVERY_READY",
  "BLOCKED",
  "AWAITING_APPROVAL",
]);

export const canonicalStateTransitions = {
  PENDING_INTAKE: ["READY", "BLOCKED", "AWAITING_APPROVAL"],
  READY: ["IN_PROGRESS", "BLOCKED", "AWAITING_APPROVAL"],
  IN_PROGRESS: ["VERIFYING", "BLOCKED", "AWAITING_APPROVAL"],
  VERIFYING: ["DELIVERY_READY", "BLOCKED", "AWAITING_APPROVAL"],
  DELIVERY_READY: ["PENDING_INTAKE", "BLOCKED"],
  BLOCKED: ["PENDING_INTAKE", "READY", "AWAITING_APPROVAL"],
  AWAITING_APPROVAL: ["READY", "BLOCKED"],
};

const risks = ["T0", "T1", "T2", "T3"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function hasTextArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(hasText);
}

function readJson(projectRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function writeTextAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(temporary, value, "utf8");
  fs.renameSync(temporary, filePath);
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function loadGovernance(projectRoot = defaultRoot) {
  return {
    policy: readJson(projectRoot, governanceFiles.policy),
    plan: readJson(projectRoot, governanceFiles.plan),
    state: readJson(projectRoot, governanceFiles.state),
  };
}

export function validatePolicy(policy) {
  const errors = [];
  if (!isObject(policy)) return ["policy 必须是 JSON 对象。"];
  if (policy.schemaVersion !== 1) errors.push("policy.schemaVersion 必须是 1。");
  if (!hasText(policy.planId)) errors.push("policy.planId 不能为空。");
  if (!hasText(policy.approvalDirectory)) errors.push("policy.approvalDirectory 不能为空。");
  if (!risks.includes(policy.maxAutoRisk) || policy.maxAutoRisk === "T3") {
    errors.push("policy.maxAutoRisk 必须是 T0、T1 或 T2。");
  }
  if (!hasTextArray(policy.allowedAutomaticActions)) errors.push("policy 必须声明自动允许动作。");
  if (!hasTextArray(policy.blockedAutomaticActions)) errors.push("policy 必须声明自动禁止动作。");
  for (const required of [
    "implement_t3",
    "create_release",
    "create_tag",
    "change_credentials",
    "change_permissions",
    "change_governance",
    "run_data_migration",
  ]) {
    if (!policy.blockedAutomaticActions?.includes(required)) {
      errors.push(`policy 必须禁止自动动作：${required}。`);
    }
    if (policy.allowedAutomaticActions?.includes(required)) {
      errors.push(`policy 不能同时允许和禁止动作：${required}。`);
    }
  }
  if (!Array.isArray(policy.protectedPaths) || policy.protectedPaths.length === 0) {
    errors.push("policy.protectedPaths 不能为空。");
  } else {
    for (const [index, entry] of policy.protectedPaths.entries()) {
      if (!isObject(entry) || !["exact", "prefix"].includes(entry.match) || !hasText(entry.path)) {
        errors.push(`policy.protectedPaths[${index}] 格式错误。`);
      }
    }
  }
  const protectedValues = new Set(
    (policy.protectedPaths ?? []).map((entry) => `${entry.match}:${String(entry.path).replaceAll("\\", "/")}`),
  );
  for (const required of [
    "exact:AGENTS.md",
    "exact:docs/ai/policy.json",
    "exact:docs/ai/plan-v1.json",
    "exact:.github/CODEOWNERS",
    `prefix:${String(policy.approvalDirectory ?? "").replaceAll("\\", "/")}/`,
    "exact:scripts/ai-state.mjs",
    "exact:scripts/ai-context-check.mjs",
    "exact:scripts/cleanup-workspace.mjs",
    "exact:scripts/cleanup-workspace.test.mjs",
    "exact:docs/WORKSPACE-CLEANUP.md",
  ]) {
    if (!protectedValues.has(required)) errors.push(`policy.protectedPaths 缺少必需保护：${required}。`);
  }
  if (!isObject(policy.stateTransitions)) {
    errors.push("policy.stateTransitions 必须是对象。");
  } else {
    for (const status of statuses) {
      const targets = policy.stateTransitions[status];
      if (!Array.isArray(targets) || targets.some((target) => !statuses.has(target))) {
        errors.push(`policy.stateTransitions.${status} 缺失或包含未知状态。`);
      } else if (
        JSON.stringify([...targets].sort()) !== JSON.stringify([...canonicalStateTransitions[status]].sort())
      ) {
        errors.push(`policy.stateTransitions.${status} 必须保持固定状态机，不得增加或删除转换。`);
      }
    }
  }
  return errors;
}

export function validatePlan(plan, policy) {
  const errors = [];
  if (!isObject(plan)) return ["plan 必须是 JSON 对象。"];
  if (plan.schemaVersion !== 1) errors.push("plan.schemaVersion 必须是 1。");
  if (plan.planId !== policy?.planId) errors.push("plan.planId 必须与 policy.planId 一致。");
  if (!hasText(plan.productGoal)) errors.push("plan.productGoal 不能为空。");
  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) return [...errors, "plan.tasks 不能为空。"];

  const ids = new Set();
  for (const [index, task] of plan.tasks.entries()) {
    const label = `plan.tasks[${index}]`;
    if (!isObject(task)) {
      errors.push(`${label} 必须是对象。`);
      continue;
    }
    if (!hasText(task.id) || ids.has(task.id)) errors.push(`${label}.id 缺失或重复。`);
    ids.add(task.id);
    if (task.order !== index + 1) errors.push(`${label}.order 必须连续且从 1 开始。`);
    if (task.issue !== null && !Number.isInteger(task.issue)) errors.push(`${label}.issue 必须是整数或 null。`);
    if (!risks.includes(task.risk)) errors.push(`${label}.risk 必须是 T0–T3。`);
    if (typeof task.governance !== "boolean" || typeof task.autoDeliver !== "boolean") {
      errors.push(`${label} 必须声明 governance 和 autoDeliver。`);
    }
    if ((task.governance || task.risk === "T3") && task.autoDeliver) {
      errors.push(`${label} 属于治理或 T3，不能自动交付。`);
    }
    if (risks.indexOf(task.risk) > risks.indexOf(policy.maxAutoRisk) && task.autoDeliver) {
      errors.push(`${label} 超出 maxAutoRisk，不能自动交付。`);
    }
    for (const field of ["dependsOn", "nonGoals", "acceptance", "validation", "allowedPaths"]) {
      if (!Array.isArray(task[field]) || (field !== "dependsOn" && task[field].length === 0)) {
        errors.push(`${label}.${field} 必须是${field === "dependsOn" ? "" : "非空"}数组。`);
      }
    }
    for (const field of ["value", "goal", "rollback"]) {
      if (!hasText(task[field])) errors.push(`${label}.${field} 不能为空。`);
    }
    if (!isObject(task.boundaries)) {
      errors.push(`${label}.boundaries 必须是对象。`);
    } else {
      for (const field of ["userData", "ipc", "release", "security"]) {
        if (typeof task.boundaries[field] !== "boolean") errors.push(`${label}.boundaries.${field} 必须是布尔值。`);
      }
    }
  }

  for (const [index, task] of plan.tasks.entries()) {
    for (const dependency of task.dependsOn ?? []) {
      const dependencyIndex = plan.tasks.findIndex((candidate) => candidate.id === dependency);
      if (dependencyIndex < 0) errors.push(`任务 ${task.id} 依赖未知任务 ${dependency}。`);
      if (dependencyIndex >= index) errors.push(`任务 ${task.id} 只能依赖排在它之前的任务。`);
    }
  }
  return errors;
}

export function validateState(state, plan, policy) {
  const errors = [];
  if (!isObject(state)) return ["state 必须是 JSON 对象。"];
  if (state.schemaVersion !== 1) errors.push("state.schemaVersion 必须是 1。");
  if (state.planId !== plan?.planId || state.planId !== policy?.planId) {
    errors.push("state.planId 必须与 policy 和 plan 一致。");
  }
  if (!statuses.has(state.status)) errors.push("state.status 未知。");
  if (!Number.isInteger(state.queueIndex) || state.queueIndex < 0 || state.queueIndex >= plan.tasks.length) {
    errors.push("state.queueIndex 超出任务队列。");
  }
  const current = plan.tasks[state.queueIndex];
  if (current?.id !== state.currentTaskId) errors.push("state.currentTaskId 与 queueIndex 不一致。");
  if (
    !Array.isArray(state.completedTaskIds) ||
    new Set(state.completedTaskIds).size !== state.completedTaskIds?.length
  ) {
    errors.push("state.completedTaskIds 必须是无重复数组。");
  } else {
    const expectedPrefix = plan.tasks.slice(0, state.queueIndex).map((task) => task.id);
    if (JSON.stringify(state.completedTaskIds) !== JSON.stringify(expectedPrefix)) {
      errors.push("state.completedTaskIds 必须等于当前任务之前的完整有序前缀，不能跳过或倒退。");
    }
  }
  if (current && (current.risk === "T3" || current.governance) && !current.autoDeliver) {
    if (["READY", "IN_PROGRESS", "VERIFYING", "DELIVERY_READY"].includes(state.status)) {
      errors.push(...validateApprovalReceipt(current, state.approval, policy, plan));
    }
  }
  if (state.status === "BLOCKED" || state.status === "AWAITING_APPROVAL") {
    if (!isObject(state.blocker) || !hasText(state.blocker.reason) || !hasText(state.blocker.nextAction)) {
      errors.push(`${state.status} 必须包含 blocker.reason 和 blocker.nextAction。`);
    }
  }
  if (!hasText(state.updatedAt) || Number.isNaN(Date.parse(state.updatedAt))) {
    errors.push("state.updatedAt 必须是 ISO 日期时间。");
  }
  return errors;
}

export function validateStateTransition(previous, next, plan, policy) {
  const errors = [...validateState(next, plan, policy)];
  if (!previous) return errors;
  if (next.queueIndex < previous.queueIndex || next.queueIndex > previous.queueIndex + 1) {
    errors.push("状态只能留在当前任务或前进一个任务，不能倒退或跳跃。");
    return errors;
  }
  if (next.queueIndex === previous.queueIndex) {
    if (next.currentTaskId !== previous.currentTaskId) errors.push("同一队列位置不能更换任务 ID。");
    if (next.status !== previous.status) {
      const allowed = policy.stateTransitions?.[previous.status] ?? [];
      if (!allowed.includes(next.status)) errors.push(`不允许从 ${previous.status} 转换到 ${next.status}。`);
    }
    return errors;
  }

  if (next.status !== "PENDING_INTAKE") errors.push("前进到下一任务时状态必须是 PENDING_INTAKE。");
  const expectedCompleted = [...previous.completedTaskIds, previous.currentTaskId];
  if (JSON.stringify(next.completedTaskIds) !== JSON.stringify(expectedCompleted)) {
    errors.push("前进队列时必须把上一任务追加到 completedTaskIds。");
  }
  if (next.lastCompleted?.taskId !== previous.currentTaskId) {
    errors.push("前进队列时 lastCompleted 必须记录上一任务。");
  }
  const completedChecks = new Map(
    (next.lastCompleted?.verification ?? []).map((check) => [check.command, check.result]),
  );
  const previousTask = plan.tasks[previous.queueIndex];
  const missingChecks = previousTask.validation.filter((command) => completedChecks.get(command) !== "pass");
  if (missingChecks.length > 0) errors.push(`前进队列缺少上一任务验证证据：${missingChecks.join("；")}。`);
  if (!hasText(next.lastCompleted?.deliveryEvidence?.summary)) {
    errors.push("前进队列必须保留上一任务的交付摘要。");
  }
  return errors;
}

function normalizeRepositoryPath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

export function isProtectedPath(relativePath, policy) {
  const candidate = normalizeRepositoryPath(relativePath);
  return (policy.protectedPaths ?? []).some((entry) => {
    const protectedPath = normalizeRepositoryPath(entry.path);
    return entry.match === "prefix"
      ? candidate === protectedPath || candidate.startsWith(`${protectedPath}/`)
      : candidate === protectedPath;
  });
}

export function isAllowedPath(relativePath, tasks) {
  const candidate = normalizeRepositoryPath(relativePath);
  return tasks.some((task) =>
    (task.allowedPaths ?? []).some((entry) => {
      const allowed = normalizeRepositoryPath(entry);
      return candidate === allowed || candidate.startsWith(`${allowed}/`);
    }),
  );
}

export function taskDigest(task) {
  return createHash("sha256").update(JSON.stringify(task)).digest("hex");
}

export function validateApprovalReceipt(task, receipt, policy, plan) {
  const errors = [];
  if (!isObject(receipt)) return [`任务 ${task.id} 需要已合入主线的人工审批凭证。`];
  if (receipt.schemaVersion !== 1) errors.push("审批凭证 schemaVersion 必须是 1。");
  if (receipt.planId !== plan.planId || receipt.planId !== policy.planId) errors.push("审批凭证 planId 不匹配。");
  if (receipt.taskId !== task.id) errors.push("审批凭证 taskId 不匹配。");
  if (receipt.taskDigest !== taskDigest(task)) errors.push("审批凭证未绑定当前任务内容。");
  if (receipt.status !== "approved") errors.push("审批凭证状态必须是 approved。");
  if (!hasText(receipt.approvedBy)) errors.push("审批凭证必须记录 approvedBy。");
  if (!hasText(receipt.approvedAt) || Number.isNaN(Date.parse(receipt.approvedAt))) {
    errors.push("审批凭证必须记录有效 approvedAt。");
  }
  if (!hasText(receipt.scope)) errors.push("审批凭证必须记录批准范围。");
  return errors;
}

function approvalPath(projectRoot, policy, taskId) {
  return path.join(projectRoot, policy.approvalDirectory, `${taskId}.json`);
}

export function loadApprovalFromMain(projectRoot, policy, plan, task) {
  const relativePath = `${policy.approvalDirectory}/${task.id}.json`.replaceAll("\\", "/");
  let raw;
  try {
    raw = run(gitCommand, ["show", `origin/main:${relativePath}`], projectRoot);
  } catch {
    throw new Error(`任务 ${task.id} 缺少已合入 origin/main 的审批凭证 ${relativePath}。`);
  }
  const receipt = JSON.parse(raw);
  const errors = validateApprovalReceipt(task, receipt, policy, plan);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return receipt;
}

function issueUrl(issue) {
  return issue === null ? "无" : `https://github.com/MY-moss/moyang_Reader/issues/${issue}`;
}

export function renderNext(plan, state) {
  const task = plan.tasks[state.queueIndex];
  const list = (values) => values.map((value) => `- ${value}`).join("\n");
  const blocker = state.blocker
    ? `\n## 阻塞/确认点\n\n- 原因：${state.blocker.reason}\n- 下一动作：${state.blocker.nextAction}\n`
    : "";
  return `# Moyang Reader 唯一下一步

> 此文件由 \`npm run ai:render\` 从 \`docs/ai/plan-v1.json\` 与 \`docs/ai/state.json\` 生成，禁止手工修改。

- 计划：${plan.planId}
- 任务：${task.id}
- 状态：${state.status}
- 风险：${task.risk}${task.governance ? " / 治理" : ""}
- Issue：${issueUrl(task.issue)}
- 自动交付：${task.autoDeliver ? "允许" : "禁止，必须人工确认"}

## 目标

${task.goal}

## 用户价值

${task.value}

## 非目标

${list(task.nonGoals)}

## 验收标准

${list(task.acceptance)}

## 验证

${list(task.validation.map((command) => `\`${command}\``))}

## 允许修改范围

${list(task.allowedPaths.map((allowedPath) => `\`${allowedPath}\``))}

## 风险与回滚

${task.rollback}
${blocker}
完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。
`;
}

export function writeRenderedNext(projectRoot, plan, state) {
  writeTextAtomic(path.join(projectRoot, governanceFiles.next), renderNext(plan, state));
}

function run(command, args, cwd = defaultRoot) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function readFlag(args, name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function repeatedFlags(args, name) {
  const prefix = `--${name}=`;
  return args.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length));
}

function updateState(projectRoot, plan, state) {
  state.updatedAt = new Date().toISOString();
  writeJsonAtomic(path.join(projectRoot, governanceFiles.state), state);
  writeRenderedNext(projectRoot, plan, state);
}

function compactContext(plan, state) {
  const task = plan.tasks[state.queueIndex];
  return JSON.stringify(
    {
      plan: plan.planId,
      task: task.id,
      status: state.status,
      risk: task.risk,
      issue: task.issue,
      goal: task.goal,
      nonGoals: task.nonGoals,
      acceptance: task.acceptance,
      validation: task.validation,
      allowedPaths: task.allowedPaths,
      blocker: state.blocker,
    },
    null,
    2,
  );
}

export function verifyTaskRemote(task, { git, gh, now = () => new Date().toISOString() }) {
  git(["fetch", "--prune", "origin", "main"]);
  const baseSha = git(["rev-parse", "origin/main"]);
  const mergeBase = git(["merge-base", "HEAD", "origin/main"]);
  if (mergeBase !== baseSha) throw new Error("当前工作树不是基于最新 origin/main，请建立或更新独立工作树。");
  const branch = git(["branch", "--show-current"]);
  if (task.issue === null) return { checkedAt: now(), baseSha, branch, issue: null, openPullRequests: [] };

  const issue = JSON.parse(
    gh(["issue", "view", String(task.issue), "--repo", "MY-moss/moyang_Reader", "--json", "state,url,title"]),
  );
  if (issue.state !== "OPEN") throw new Error(`Issue #${task.issue} 不是 OPEN。`);
  const pullRequests = JSON.parse(
    gh([
      "pr",
      "list",
      "--repo",
      "MY-moss/moyang_Reader",
      "--state",
      "open",
      "--search",
      `#${task.issue} in:body`,
      "--json",
      "number,url,title,headRefName",
    ]) || "[]",
  );
  if (pullRequests.length > 0)
    throw new Error(`Issue #${task.issue} 已有开放 PR：${pullRequests.map((pr) => `#${pr.number}`).join(", ")}。`);
  return { checkedAt: now(), baseSha, branch, issue, openPullRequests: pullRequests };
}

function verifyRemote(projectRoot, task) {
  return verifyTaskRemote(task, {
    git: (args) => run(gitCommand, args, projectRoot),
    gh: (args) => run(ghCommand, args, projectRoot),
  });
}

function parseChecks(args) {
  return repeatedFlags(args, "check").map((entry) => {
    const separator = entry.lastIndexOf("::");
    if (separator < 1) throw new Error(`--check 必须使用 <command>::<pass|fail>：${entry}`);
    const command = entry.slice(0, separator);
    const result = entry.slice(separator + 2);
    if (!["pass", "fail"].includes(result)) throw new Error(`检查结果只能是 pass 或 fail：${entry}`);
    return { command, result };
  });
}

export function deliveryReadyState(plan, state, { summary, checks, policy }) {
  const task = plan.tasks[state.queueIndex];
  if (task.risk === "T3" || task.governance || !task.autoDeliver) {
    const approvalErrors = validateApprovalReceipt(task, state.approval, policy, plan);
    if (approvalErrors.length > 0) throw new Error(approvalErrors.join("\n"));
  }
  const checkMap = new Map(checks.map((check) => [check.command, check.result]));
  const missing = task.validation.filter((command) => checkMap.get(command) !== "pass");
  if (missing.length > 0) throw new Error(`缺少通过的必需验证：${missing.join("；")}`);

  return {
    ...state,
    status: "DELIVERY_READY",
    blocker: null,
    verification: checks,
    deliveryEvidence: { summary, recordedAt: new Date().toISOString() },
  };
}

export function advanceDeliveryState(plan, delivered) {
  const task = plan.tasks[delivered.queueIndex];
  const nextIndex = delivered.queueIndex + 1;
  if (nextIndex >= plan.tasks.length) return delivered;
  return {
    ...delivered,
    currentTaskId: plan.tasks[nextIndex].id,
    queueIndex: nextIndex,
    status: "PENDING_INTAKE",
    completedTaskIds: [...delivered.completedTaskIds, task.id],
    remoteCheck: null,
    approval: null,
    verification: [],
    blocker: null,
    lastCompleted: {
      taskId: task.id,
      summary: delivered.deliveryEvidence.summary,
      verification: delivered.verification,
      deliveryEvidence: delivered.deliveryEvidence,
    },
  };
}

export function finishState(plan, state, { result, summary, checks, policy }) {
  if (result === "blocked") {
    return {
      ...state,
      status: "BLOCKED",
      blocker: { reason: summary, nextAction: "解决阻塞后重新运行 ai:start。" },
      verification: checks,
    };
  }
  if (result !== "passed") throw new Error("--result 必须是 passed 或 blocked。");
  return advanceDeliveryState(plan, deliveryReadyState(plan, state, { summary, checks, policy }));
}

function persistTransition(projectRoot, plan, policy, previous, next) {
  const errors = validateStateTransition(previous, next, plan, policy);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  updateState(projectRoot, plan, next);
  return next;
}

function main(projectRoot = defaultRoot) {
  const [command = "context", ...args] = process.argv.slice(2);
  const { policy, plan, state } = loadGovernance(projectRoot);
  const errors = [...validatePolicy(policy), ...validatePlan(plan, policy), ...validateState(state, plan, policy)];
  if (errors.length > 0) throw new Error(errors.join("\n"));

  if (command === "context") {
    console.log(compactContext(plan, state));
    return;
  }
  if (command === "approval-template") {
    const requestedTaskId = readFlag(args, "task") ?? state.currentTaskId;
    const task = plan.tasks.find((candidate) => candidate.id === requestedTaskId);
    if (!task) throw new Error(`未知任务 ${requestedTaskId}。`);
    console.log(
      JSON.stringify(
        {
          schemaVersion: 1,
          planId: plan.planId,
          taskId: task.id,
          taskDigest: taskDigest(task),
          status: "approved",
          approvedBy: "<GitHub code owner>",
          approvedAt: "<ISO-8601 UTC>",
          scope: task.goal,
        },
        null,
        2,
      ),
    );
    console.error(`将审核后的凭证保存为 ${approvalPath(projectRoot, policy, task.id)} 并先合入 main。`);
    return;
  }
  if (command === "render") {
    writeRenderedNext(projectRoot, plan, state);
    console.log(`已生成 ${governanceFiles.next}。`);
    return;
  }
  if (command === "start") {
    const task = plan.tasks[state.queueIndex];
    if (!["PENDING_INTAKE", "READY", "BLOCKED", "AWAITING_APPROVAL"].includes(state.status)) {
      throw new Error(`当前状态 ${state.status} 不能开始任务。`);
    }
    try {
      state.remoteCheck = verifyRemote(projectRoot, task);
    } catch (cause) {
      const blocked = {
        ...state,
        status: "BLOCKED",
        blocker: {
          reason: cause instanceof Error ? cause.message : String(cause),
          nextAction: "恢复网络或解决实时 Issue/PR 冲突后重新运行 ai:start。",
        },
      };
      persistTransition(projectRoot, plan, policy, state, blocked);
      console.error(blocked.blocker.reason);
      process.exitCode = 2;
      return;
    }
    if (task.risk === "T3" || task.governance || !task.autoDeliver) {
      try {
        state.approval = loadApprovalFromMain(projectRoot, policy, plan, task);
      } catch (cause) {
        const awaiting = {
          ...state,
          status: "AWAITING_APPROVAL",
          blocker: {
            reason: cause instanceof Error ? cause.message : String(cause),
            nextAction: `生成并由 Code Owner 合并 ${policy.approvalDirectory}/${task.id}.json 后重新运行 ai:start。`,
          },
        };
        persistTransition(projectRoot, plan, policy, state, awaiting);
        console.error(awaiting.blocker.reason);
        process.exitCode = 2;
        return;
      }
    }
    try {
      const ready = {
        ...state,
        baseSha: state.remoteCheck.baseSha,
        branch: state.remoteCheck.branch,
        status: "READY",
        blocker: null,
      };
      const readyState = state.status === "READY" ? ready : persistTransition(projectRoot, plan, policy, state, ready);
      const inProgress = persistTransition(projectRoot, plan, policy, readyState, {
        ...readyState,
        status: "IN_PROGRESS",
      });
      console.log(`任务 ${task.id} 已开始，基线 ${inProgress.baseSha}。`);
    } catch (cause) {
      const blocked = {
        ...state,
        status: "BLOCKED",
        blocker: {
          reason: cause instanceof Error ? cause.message : String(cause),
          nextAction: "修复状态或主线冲突后重新运行 ai:start。",
        },
      };
      persistTransition(projectRoot, plan, policy, state, blocked);
      console.error(blocked.blocker.reason);
      process.exitCode = 2;
    }
    return;
  }
  if (command === "finish") {
    const result = readFlag(args, "result");
    const summary = readFlag(args, "summary");
    if (!hasText(summary)) throw new Error("ai:finish 需要 --summary=<简短结果>。");
    const checks = parseChecks(args);
    if (result === "blocked") {
      const nextState = finishState(plan, state, { result, summary, checks, policy });
      persistTransition(projectRoot, plan, policy, state, nextState);
      console.log("任务已记录为 BLOCKED。");
      return;
    }
    if (result !== "passed") throw new Error("--result 必须是 passed 或 blocked。");
    if (!["IN_PROGRESS", "VERIFYING"].includes(state.status)) {
      throw new Error(`当前状态 ${state.status} 不能完成任务；必须先运行 ai:start。`);
    }
    const verifying =
      state.status === "VERIFYING"
        ? state
        : persistTransition(projectRoot, plan, policy, state, { ...state, status: "VERIFYING" });
    const delivered = deliveryReadyState(plan, verifying, { summary, checks, policy });
    persistTransition(projectRoot, plan, policy, verifying, delivered);
    const nextState = advanceDeliveryState(plan, delivered);
    if (nextState !== delivered) persistTransition(projectRoot, plan, policy, delivered, nextState);
    console.log(`任务已完成，当前任务为 ${nextState.currentTaskId}。`);
    return;
  }
  throw new Error(`未知命令 ${command}。支持 context、start、render、finish、approval-template。`);
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) {
  try {
    main();
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
