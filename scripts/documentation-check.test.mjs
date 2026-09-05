import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateDocumentation } from "./documentation-check.mjs";
import { validateAiProcess } from "./ai-process-check.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("keeps update, opener, association, release-status and AI handoff documentation consistent", () => {
  assert.deepEqual(validateDocumentation(sourceRoot), []);
});

test("rejects resurrected approval state and unverifiable task status", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-ai-process-"));
  try {
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });

    fs.writeFileSync(
      path.join(root, "AGENTS.md"),
      "GitHub 当前状态优先于任务板。见 docs/AI-EXECUTION-CONTRACT.md。",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "docs/AI-TASKS.md"),
      [
        "GitHub 当前 Issue / PR / target branch 状态优先于本文件。",
        "IN_PROGRESS — PR #N",
        "DONE — PR #N",
        "**状态：IN_PROGRESS**",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "docs/AI-EXECUTION-CONTRACT.md"),
      "GitHub 是“代码是否真的存在”的最终真源。",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".github/pull_request_template.md"),
      "Issue / Task\ndocs/AI-TASKS.md\nAWAITING_APPROVAL\n",
      "utf8",
    );

    const errors = validateAiProcess(root);
    assert.ok(errors.some((error) => error.includes("AWAITING_APPROVAL")));
    assert.ok(errors.some((error) => error.includes("IN_PROGRESS") && error.includes("PR 号")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
