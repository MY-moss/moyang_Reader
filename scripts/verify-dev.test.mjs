import assert from "node:assert/strict";
import test from "node:test";

import { DEV_VERIFY_STEPS, runVerification } from "./verify-dev.mjs";

test("defines a lightweight first-run verification path in a stable order", () => {
  assert.deepEqual(
    DEV_VERIFY_STEPS.map((step) => step.npmScript),
    ["doctor", "test:workflow", "test", "lint", "check:architecture", "build"],
  );
});

test("does not include interactive desktop, browser, benchmark, or release stages", () => {
  const scripts = DEV_VERIFY_STEPS.map((step) => step.npmScript).join(" ");
  assert.doesNotMatch(scripts, /desktop|e2e|benchmark|release/i);
});

test("stops after the first failed verification stage", () => {
  const calls = [];
  const result = runVerification({
    run(step) {
      calls.push(step.npmScript);
      return { status: step.npmScript === "test" ? 1 : 0 };
    },
    log: () => {},
  });

  assert.deepEqual(calls, ["doctor", "test:workflow", "test"]);
  assert.deepEqual(result, {
    ok: false,
    failedStep: DEV_VERIFY_STEPS[2],
    exitCode: 1,
  });
});

test("reports a successful verification only after every stage passes", () => {
  const result = runVerification({ run: () => ({ status: 0 }), log: () => {} });

  assert.deepEqual(result, {
    ok: true,
    completedSteps: DEV_VERIFY_STEPS,
    exitCode: 0,
  });
});
