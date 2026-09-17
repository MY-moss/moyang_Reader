import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateDocumentation } from "./documentation-check.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("keeps security, updater authority, roadmap gates, opener, association, and release docs consistent", () => {
  assert.deepEqual(validateDocumentation(sourceRoot), []);
});
