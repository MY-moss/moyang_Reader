import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAYWRIGHT_APP_ID,
  createPlaywrightRuntime,
  derivePlaywrightPort,
  isExpectedHealthRequest,
} from "./playwright-runtime.mjs";

test("derives a stable worktree-specific Playwright port", () => {
  const first = derivePlaywrightPort("C:/worktrees/moyang-one", {});
  const repeated = derivePlaywrightPort("C:/worktrees/moyang-one", {});
  const second = derivePlaywrightPort("C:/worktrees/moyang-two", {});

  assert.equal(first, repeated);
  assert.notEqual(first, second);
  assert.ok(first >= 20_000 && first < 40_000);
});

test("accepts an explicit isolated port and rejects unsafe values", () => {
  assert.equal(derivePlaywrightPort("C:/worktrees/moyang", { MOYANG_E2E_PORT: "32123" }), 32_123);
  assert.throws(() => derivePlaywrightPort("C:/worktrees/moyang", { MOYANG_E2E_PORT: "4173.5" }));
  assert.throws(() => derivePlaywrightPort("C:/worktrees/moyang", { MOYANG_E2E_PORT: "80" }));
});

test("requires both the Moyang application id and the exact commit for health checks", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const runtime = createPlaywrightRuntime("C:/worktrees/moyang", { GITHUB_SHA: commit, MOYANG_E2E_PORT: "32123" });

  assert.equal(runtime.appId, PLAYWRIGHT_APP_ID);
  assert.equal(isExpectedHealthRequest(runtime.healthPath, runtime), true);
  assert.equal(isExpectedHealthRequest(`/__moyang_e2e_health?app=another-app&commit=${commit}`, runtime), false);
  assert.equal(
    isExpectedHealthRequest(`/__moyang_e2e_health?app=${PLAYWRIGHT_APP_ID}&commit=${"f".repeat(40)}`, runtime),
    false,
  );
});
