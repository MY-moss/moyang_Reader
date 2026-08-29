import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { validateActionPins } from "./check-action-pins.mjs";

function createWorkflowRoot(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-action-pins-"));
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(root, ".github", "workflows", "test.yml"), content);
  return root;
}

test("accepts reviewed SHA pins with source comments and local workflows", () => {
  const root = createWorkflowRoot(`
jobs:
  build:
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
      - uses: ./.github/workflows/reusable.yml
`);

  try {
    assert.deepEqual(validateActionPins(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects floating refs and undocumented pins", () => {
  const root = createWorkflowRoot(`
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@11d5960a326750d5838078e36cf38b85af677262
      - uses: actions/upload-artifact
`);

  try {
    const errors = validateActionPins(root);
    assert.equal(errors.length, 3);
    assert.equal(
      errors.some((error) => error.includes("40 位提交 SHA")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("缺少版本/来源注释")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("引用格式无效")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
