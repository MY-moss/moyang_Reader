import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  activeTaskRange,
  contextLimits,
  retiredPaths,
  validateAiContext,
  validateApprovalSource,
  validateChangedPathSet,
} from "./ai-context-check.mjs";
import { loadGovernance } from "./ai-state.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-ai-context-"));
  const files = [...contextLimits.keys(), "docs/release-status.json"];
  for (const relativePath of files) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relativePath), target);
  }
  return root;
}

test("accepts the checked-in structured AI context", () => {
  assert.deepEqual(validateAiContext(sourceRoot, { inspectGit: false }), []);
});

test("rejects a hand-edited generated NEXT summary", () => {
  const root = copyFixture();
  try {
    fs.appendFileSync(path.join(root, "docs", "NEXT.md"), "\nmanual drift\n", "utf8");
    const errors = validateAiContext(root, { inspectGit: false });
    assert.equal(
      errors.some((error) => error.includes("ai:render")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("accepts Windows line endings in the generated NEXT summary", () => {
  const root = copyFixture();
  try {
    const nextPath = path.join(root, "docs", "NEXT.md");
    const next = fs.readFileSync(nextPath, "utf8").replaceAll("\r\n", "\n").replaceAll("\n", "\r\n");
    fs.writeFileSync(nextPath, next, "utf8");
    assert.deepEqual(validateAiContext(root, { inspectGit: false }), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects duplicated development state in release metadata", () => {
  const root = copyFixture();
  try {
    const statusPath = path.join(root, "docs", "release-status.json");
    const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
    status.handoff.nextStatus = "READY";
    fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
    const errors = validateAiContext(root, { inspectGit: false });
    assert.equal(
      errors.some((error) => error.includes("nextStatus")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects oversized startup context", () => {
  const root = copyFixture();
  try {
    fs.appendFileSync(path.join(root, "AGENTS.md"), "x".repeat(9_000), "utf8");
    const errors = validateAiContext(root, { inspectGit: false });
    assert.equal(
      errors.some((error) => error.includes("AGENTS.md") && error.includes("预算")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("默认接手上下文")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects reintroduced retired context entry points", () => {
  const root = copyFixture();
  try {
    const retiredPath = path.join(root, retiredPaths[0]);
    fs.mkdirSync(path.dirname(retiredPath), { recursive: true });
    fs.writeFileSync(retiredPath, "stale task snapshot\n", "utf8");
    const errors = validateAiContext(root, { inspectGit: false });
    assert.equal(
      errors.some((error) => error.includes(retiredPaths[0]) && error.includes("已退役")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("blocks protected and out-of-scope changes for an ordinary task", () => {
  const { policy, plan } = loadGovernance(sourceRoot);
  const errors = validateChangedPathSet(
    ["src/app/path-key.ts", "src-tauri/src/commands.rs", "scripts/ai-state.mjs"],
    policy,
    [plan.tasks[3]],
    "IN_PROGRESS",
  );
  assert.equal(
    errors.some((error) => error.includes("src-tauri")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("AWAITING_APPROVAL")),
    true,
  );
});

test("checks a finishing pull request against the completed task, not the next task", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  const previous = {
    ...state,
    currentTaskId: "M1101",
    queueIndex: 3,
  };
  const next = {
    ...previous,
    currentTaskId: "M1102",
    queueIndex: 4,
  };
  assert.deepEqual(
    activeTaskRange(plan, previous, next).map((task) => task.id),
    ["M1101"],
  );
});

test("does not trust an approval stored only in mutable state", () => {
  const { plan, state } = loadGovernance(sourceRoot);
  const forged = { ...state, approval: { taskId: state.currentTaskId } };
  assert.equal(
    validateApprovalSource(forged, plan, null).some((error) => error.includes("origin/main")),
    true,
  );
});
