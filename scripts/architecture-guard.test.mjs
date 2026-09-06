import assert from "node:assert/strict";
import test from "node:test";
import { scanArchitecture } from "./architecture-guard.mjs";

test("repository respects enforced architecture boundaries", () => {
  assert.deepEqual(scanArchitecture(process.cwd()), []);
});
