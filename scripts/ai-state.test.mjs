import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  finishState,
  isAllowedPath,
  isProtectedPath,
  loadGovernance,
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
    completedTaskIds: ["G01", "G02", "G03"],
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
  assert.match(rendered, /任务：G03/);
  assert.match(rendered, /状态：AWAITING_APPROVAL/);
  assert.doesNotMatch(rendered, /M1101/);
});

test("rejects queue skips and completed-prefix drift", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const next = {
    ...state,
    currentTaskId: "M1102",
    queueIndex: 4,
    status: "PENDING_INTAKE",
    completedTaskIds: ["G01", "G02", "G03", "M1101"],
    lastCompleted: { taskId: "G03", summary: "skipped" },
  };
  const errors = validateStateTransition(state, next, plan, policy);
  assert.equal(
    errors.some((error) => error.includes("跳跃")),
    true,
  );
});

test("rejects a one-step queue advance without verification and delivery evidence", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const next = {
    ...state,
    currentTaskId: "M1101",
    queueIndex: 3,
    status: "PENDING_INTAKE",
    completedTaskIds: ["G01", "G02", "G03"],
    lastCompleted: { taskId: "G03", summary: "manually advanced" },
  };
  const errors = validateStateTransition(state, next, plan, policy);
  assert.equal(
    errors.some((error) => error.includes("验证证据")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("交付摘要")),
    true,
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
    completedTaskIds: plan.tasks.slice(0, t3Index).map((task) => task.id),
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

test("finishes one approved task and advances exactly once", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const checks = plan.tasks[state.queueIndex].validation.map((command) => ({ command, result: "pass" }));
  const approval = {
    schemaVersion: 1,
    planId: plan.planId,
    taskId: plan.tasks[state.queueIndex].id,
    taskDigest: taskDigest(plan.tasks[state.queueIndex]),
    status: "approved",
    approvedBy: "@MY-moss",
    approvedAt: "2026-09-04T00:00:00.000Z",
    scope: plan.tasks[state.queueIndex].goal,
  };
  const next = finishState(
    plan,
    { ...state, approval },
    {
      result: "passed",
      summary: "repository protection verified",
      checks,
      policy,
    },
  );
  assert.equal(next.currentTaskId, "M1101");
  assert.equal(next.status, "PENDING_INTAKE");
  assert.deepEqual(next.completedTaskIds, ["G01", "G02", "G03"]);
  assert.deepEqual(next.lastCompleted.verification, checks);
});

test("does not accept missing required verification", () => {
  const { policy, plan, state } = loadGovernance(sourceRoot);
  const task = plan.tasks[state.queueIndex];
  const approval = {
    schemaVersion: 1,
    planId: plan.planId,
    taskId: task.id,
    taskDigest: taskDigest(task),
    status: "approved",
    approvedBy: "@MY-moss",
    approvedAt: "2026-09-04T00:00:00.000Z",
    scope: task.goal,
  };
  assert.throws(
    () => finishState(plan, { ...state, approval }, { result: "passed", summary: "incomplete", checks: [], policy }),
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
