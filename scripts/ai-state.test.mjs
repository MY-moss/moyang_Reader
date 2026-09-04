import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  advanceDeliveryState,
  finishState,
  isCancelledTask,
  isAllowedPath,
  isProtectedPath,
  loadGovernance,
  migrateCancelledTask,
  nextActiveQueueIndex,
  renderNext,
  taskDigest,
  validateApprovalReceipt,
  validatePlan,
  validatePolicy,
  validateState,
  validateStateTransition,
  verifyTaskRemote,
} from "./ai-state.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("accepts the checked-in policy, plan, and state", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  assert.deepEqual(validatePolicy(policy), []);
  assert.deepEqual(validatePlan(plan, policy), []);
  assert.deepEqual(validateState(state, plan, policy), []);
});

test("records G03 as cancelled without treating it as completed", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  assert.equal(isCancelledTask(plan, "G03"), true);
  assert.equal(state.completedTaskIds.includes("G03"), false);
  assert.equal(state.queueIndex > plan.tasks.findIndex((task) => task.id === "G03"), true);
  assert.notEqual(state.currentTaskId, "G03");
  assert.deepEqual(plan.tasks.find((task) => task.id === "M1101").dependsOn, ["G02"]);
});

test("rejects dependencies on cancelled tasks", () => {
  const { policy, plan } = loadGovernance(sourceRoot);
  const changed = JSON.parse(JSON.stringify(plan));
  changed.tasks.find((task) => task.id === "M1102").dependsOn = ["G03"];
  assert.equal(
    validatePlan(changed, policy).some((error) => error.includes("不能依赖已取消任务")),
    true,
  );
});

test("rejects an automatically deliverable T3 task", () => {
  const { policy, plan } = loadGovernance(sourceRoot);
  const changed = JSON.parse(JSON.stringify(plan));
  changed.tasks.find((task) => task.id === "M1105").autoDeliver = true;
  assert.equal(
    validatePlan(changed, policy).some((error) => error.includes("T3")),
    true,
  );
});

test("requires every blocked action and rejects contradictory permission", () => {
  const { policy } = loadGovernance(sourceRoot);
  const changed = JSON.parse(JSON.stringify(policy));
  changed.blockedAutomaticActions = changed.blockedAutomaticActions.filter((action) => action !== "change_credentials");
  changed.allowedAutomaticActions.push("change_governance");
  const errors = validatePolicy(changed);
  assert.equal(
    errors.some((error) => error.includes("change_credentials")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("同时允许和禁止")),
    true,
  );
});

test("keeps the canonical state machine from being relaxed", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const changed = JSON.parse(JSON.stringify(policy));
  changed.stateTransitions.PENDING_INTAKE.push("IN_PROGRESS");
  assert.equal(
    validatePolicy(changed).some((error) => error.includes("固定状态机")),
    true,
  );

  const pending = {
    ...state,
    currentTaskId: "M1101",
    queueIndex: 3,
    status: "PENDING_INTAKE",
    completedTaskIds: ["G01", "G02"],
    blocker: null,
  };
  const errors = validateStateTransition(pending, { ...pending, status: "IN_PROGRESS" }, plan, policy);
  assert.equal(
    errors.some((error) => error.includes("不允许从 PENDING_INTAKE")),
    true,
  );
});

test("renders a compact summary for exactly the current task", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  const rendered = renderNext(plan, state);
  assert.match(rendered, new RegExp(`任务：${state.currentTaskId}`));
  assert.match(rendered, new RegExp(`状态：${state.status}`));
  assert.match(rendered, /已取消计划项：G03/);
});

test("rejects queue skips and completed-prefix drift", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const skippedIndex = state.queueIndex + 2;
  assert.equal(skippedIndex < plan.tasks.length, true);
  const next = {
    ...state,
    currentTaskId: plan.tasks[skippedIndex].id,
    queueIndex: skippedIndex,
    status: "PENDING_INTAKE",
    lastCompleted: { taskId: state.currentTaskId, summary: "skipped" },
  };
  const errors = validateStateTransition(state, next, plan, policy);
  assert.equal(
    errors.some((error) => error.includes("未取消任务")),
    true,
  );
});

test("rejects a one-step queue advance without verification and delivery evidence", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const previous = {
    ...state,
    currentTaskId: "G02",
    queueIndex: 1,
    status: "DELIVERY_READY",
    completedTaskIds: ["G01"],
    blocker: null,
  };
  const next = {
    ...previous,
    currentTaskId: "M1101",
    queueIndex: 3,
    status: "PENDING_INTAKE",
    completedTaskIds: ["G01", "G02"],
    lastCancelled: {
      taskId: "G03",
      reason: plan.cancelledTasks[0].reason,
      recordedAt: "2026-09-04T03:00:07.337Z",
    },
    lastCompleted: { taskId: "G02", summary: "manually advanced" },
  };
  const errors = validateStateTransition(previous, next, plan, policy);
  assert.equal(
    errors.some((error) => error.includes("验证证据")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("交付摘要")),
    true,
  );
});

test("allows a controlled migration away from a cancelled current task", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const previous = {
    ...state,
    currentTaskId: "G03",
    queueIndex: 2,
    status: "AWAITING_APPROVAL",
    completedTaskIds: ["G01", "G02"],
    blocker: { reason: "旧状态", nextAction: "迁移" },
  };
  const next = {
    ...state,
    currentTaskId: "M1101",
    queueIndex: 3,
    status: "AWAITING_APPROVAL",
    completedTaskIds: ["G01", "G02"],
    blocker: { reason: "G03 已取消", nextAction: "运行 ai:start" },
    lastCancelled: {
      taskId: "G03",
      reason: plan.cancelledTasks[0].reason,
      recordedAt: "2026-09-04T03:00:07.337Z",
    },
  };
  assert.deepEqual(validateStateTransition(previous, next, plan, policy), []);
});

test("migrates a cancelled current task to the next active task", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  assert.equal(nextActiveQueueIndex(plan, 2), 3);
  const previous = {
    ...state,
    currentTaskId: "G03",
    queueIndex: 2,
    status: "AWAITING_APPROVAL",
    completedTaskIds: ["G01", "G02"],
    blocker: { reason: "旧状态", nextAction: "迁移" },
  };
  const migrated = migrateCancelledTask(plan, previous);
  assert.equal(migrated.currentTaskId, "M1101");
  assert.equal(migrated.queueIndex, 3);
  assert.equal(migrated.status, "PENDING_INTAKE");
  assert.deepEqual(migrated.completedTaskIds, ["G01", "G02"]);
  assert.equal(migrated.lastCancelled.taskId, "G03");
  assert.equal(Number.isNaN(Date.parse(migrated.lastCancelled.recordedAt)), false);
});

test("rejects crossing a cancelled task without a cancellation record", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const previous = {
    ...state,
    currentTaskId: "G03",
    queueIndex: 2,
    status: "AWAITING_APPROVAL",
    completedTaskIds: ["G01", "G02"],
    blocker: { reason: "旧状态", nextAction: "迁移" },
  };
  const next = {
    ...state,
    currentTaskId: "M1101",
    queueIndex: 3,
    status: "PENDING_INTAKE",
    completedTaskIds: ["G01", "G02"],
    lastCancelled: null,
    blocker: null,
  };
  assert.equal(
    validateStateTransition(previous, next, plan, policy).some((error) => error.includes("lastCancelled")),
    true,
  );
});

test("does not execute a cancelled task", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  const cancelledState = {
    ...state,
    currentTaskId: "G03",
    queueIndex: 2,
    status: "IN_PROGRESS",
    completedTaskIds: ["G01", "G02"],
    blocker: null,
  };
  assert.throws(
    () => finishState(plan, cancelledState, { result: "passed", summary: "invalid", checks: [], policy: {} }),
    /已取消.*finish/,
  );
});

test("requires approval before a T3 task can run", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const t3Index = plan.tasks.findIndex((task) => task.id === "M1105");
  const t3State = {
    ...state,
    currentTaskId: "M1105",
    queueIndex: t3Index,
    status: "IN_PROGRESS",
    completedTaskIds: plan.tasks
      .slice(0, t3Index)
      .filter((task) => !isCancelledTask(plan, task.id))
      .map((task) => task.id),
    blocker: null,
  };
  const errors = validateState(t3State, plan, policy);
  assert.equal(
    errors.some((error) => error.includes("审批凭证")),
    true,
  );
});

test("binds an approval receipt to the protected task content", () => {
  const { policy, plan } = loadGovernance(sourceRoot);
  const task = plan.tasks.find((candidate) => candidate.id === "M1105");
  const receipt = {
    schemaVersion: 1,
    planId: plan.planId,
    taskId: task.id,
    taskDigest: taskDigest(task),
    status: "approved",
    approvedBy: "@MY-moss",
    approvedAt: "2026-09-04T00:00:00.000Z",
    scope: task.goal,
  };
  assert.deepEqual(validateApprovalReceipt(task, receipt, policy, plan), []);
  receipt.taskDigest = "0".repeat(64);
  assert.equal(
    validateApprovalReceipt(task, receipt, policy, plan).some((error) => error.includes("任务内容")),
    true,
  );
});

test("recognizes protected and task-allowed paths", () => {
  const { policy, plan } = loadGovernance(sourceRoot);
  assert.equal(isProtectedPath(".github/workflows/ci.yml", policy), true);
  assert.equal(isProtectedPath("docs/ai/state.json", policy), false);
  assert.equal(isAllowedPath("src/app/path-key.ts", [plan.tasks[3]]), true);
  assert.equal(isAllowedPath("src-tauri/src/commands.rs", [plan.tasks[3]]), false);
  assert.equal(isAllowedPath("docs-private/escape.md", [plan.tasks[0]]), false);
});

test("finishes one auto-deliverable task and advances exactly once", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const currentTaskId = "M1101";
  const currentIndex = plan.tasks.findIndex((task) => task.id === currentTaskId);
  const checks = plan.tasks[currentIndex].validation.map((command) => ({ command, result: "pass" }));
  const currentState = {
    ...state,
    currentTaskId,
    queueIndex: currentIndex,
    completedTaskIds: plan.tasks
      .slice(0, currentIndex)
      .filter((task) => !isCancelledTask(plan, task.id))
      .map((task) => task.id),
    status: "IN_PROGRESS",
    blocker: null,
  };
  const next = finishState(plan, currentState, {
    result: "passed",
    summary: "repository protection verified",
    checks,
    policy,
  });
  assert.equal(next.currentTaskId, "M1102");
  assert.equal(next.status, "PENDING_INTAKE");
  assert.deepEqual(next.completedTaskIds, ["G01", "G02", "M1101"]);
  assert.deepEqual(next.lastCompleted.verification, checks);
  assert.equal(next.lastCancelled, null);
});

test("advances across an explicitly cancelled queue item", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  const previous = {
    ...state,
    currentTaskId: "G02",
    queueIndex: 1,
    status: "DELIVERY_READY",
    completedTaskIds: ["G01"],
    blocker: null,
    deliveryEvidence: { summary: "G02 verified" },
    verification: [
      { command: "npm run test:workflow", result: "pass" },
      { command: "npm run ai:check", result: "pass" },
      { command: "git diff --check", result: "pass" },
    ],
  };
  const next = advanceDeliveryState(plan, previous);
  assert.equal(next.currentTaskId, "M1101");
  assert.equal(next.queueIndex, 3);
  assert.deepEqual(next.completedTaskIds, ["G01", "G02"]);
  assert.equal(next.lastCancelled.taskId, "G03");
  assert.equal(next.lastCancelled.reason, plan.cancelledTasks[0].reason);
});

test("does not accept missing required verification", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const currentState = { ...state, status: "IN_PROGRESS", blocker: null };
  assert.throws(
    () => finishState(plan, currentState, { result: "passed", summary: "incomplete", checks: [], policy }),
    /缺少通过的必需验证/,
  );
});

function remoteHarness({ issueState = "OPEN", pullRequests = [], mergeBase = "a" } = {}) {
  return {
    git: (args) => {
      if (args[0] === "fetch") return "";
      if (args[0] === "rev-parse") return "a";
      if (args[0] === "merge-base") return mergeBase;
      if (args[0] === "branch") return "codex/test";
      throw new Error(`unexpected git command ${args.join(" ")}`);
    },
    gh: (args) =>
      args[0] === "issue"
        ? JSON.stringify({ state: issueState, url: "https://example.test/issue", title: "test" })
        : JSON.stringify(pullRequests),
    now: () => "2026-09-04T00:00:00.000Z",
  };
}

test("verifies a fresh open issue with no duplicate pull request", () => {
  const { plan } = loadGovernance(sourceRoot);
  const result = verifyTaskRemote(plan.tasks[3], remoteHarness());
  assert.equal(result.baseSha, "a");
  assert.equal(result.issue.state, "OPEN");
});

test("blocks closed issues, duplicate pull requests, stale main, and network failure", () => {
  const { plan } = loadGovernance(sourceRoot);
  const task = plan.tasks[3];
  assert.throws(() => verifyTaskRemote(task, remoteHarness({ issueState: "CLOSED" })), /不是 OPEN/);
  assert.throws(() => verifyTaskRemote(task, remoteHarness({ pullRequests: [{ number: 99 }] })), /已有开放 PR/);
  assert.throws(() => verifyTaskRemote(task, remoteHarness({ mergeBase: "old" })), /最新 origin\/main/);
  assert.throws(
    () =>
      verifyTaskRemote(task, {
        ...remoteHarness(),
        git: () => {
          throw new Error("network unavailable");
        },
      }),
    /network unavailable/,
  );
});
