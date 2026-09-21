import assert from "node:assert/strict";
import test from "node:test";

import { collectAdvisoryIds, validateDevAuditReport } from "./dev-dependency-audit.mjs";

const report = {
  vulnerabilities: {
    example: {
      via: [{ url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }],
    },
  },
  metadata: { vulnerabilities: { critical: 0, total: 1 } },
};

const exceptions = {
  schemaVersion: 1,
  owner: "@maintainer",
  trackingIssue: "https://github.com/example/project/issues/1",
  reviewBy: "2026-10-19",
  advisories: {
    "GHSA-AAAA-BBBB-CCCC": { dependency: "example", reason: "Development-only fixture with no untrusted input." },
  },
};

test("collects unique GitHub advisory ids from an npm audit report", () => {
  assert.deepEqual(collectAdvisoryIds(report), ["GHSA-AAAA-BBBB-CCCC"]);
});

test("accepts only active, reviewed, non-expired development advisories", () => {
  assert.deepEqual(validateDevAuditReport(report, exceptions, new Date("2026-09-21T00:00:00Z")), []);
});

test("rejects unknown, stale, expired, or critical exceptions", () => {
  const errors = validateDevAuditReport(
    { ...report, metadata: { vulnerabilities: { critical: 1, total: 1 } } },
    {
      ...exceptions,
      reviewBy: "2026-09-20",
      advisories: {
        "GHSA-DDDD-EEEE-FFFF": { dependency: "stale", reason: "No longer active." },
      },
    },
    new Date("2026-09-21T00:00:00Z"),
  );

  assert.ok(errors.some((error) => error.includes("expired")));
  assert.ok(errors.some((error) => error.includes("Critical")));
  assert.ok(errors.some((error) => error.includes("Unreviewed")));
  assert.ok(errors.some((error) => error.includes("stale")));
});
