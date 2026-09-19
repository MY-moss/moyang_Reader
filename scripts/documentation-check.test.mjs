import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateDocumentation, validateUpdaterAuthorityClaims } from "./documentation-check.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("keeps security, updater authority, roadmap gates, opener, association, and release docs consistent", () => {
  assert.deepEqual(validateDocumentation(sourceRoot), []);
});

test("rejects mirror-first updater claims in user-facing documentation", () => {
  const documents = new Map([
    ["docs/RELEASE-POLICY.md", "更新端点按配置顺序先尝试公开 Cloudflare Pages 动态镜像，再回退到 GitHub Release。"],
    ["docs/USER-GUIDE.md", "更新器先尝试公开 Cloudflare Pages 镜像，镜像不可用时回退 GitHub Release。"],
  ]);

  const errors = validateUpdaterAuthorityClaims(documents);

  assert.equal(errors.length, 2);
});

test("requires the canonical Windows development setup guide", () => {
  const setupGuide = fs.readFileSync(path.join(sourceRoot, "docs", "DEVELOPMENT-SETUP.md"), "utf8");

  assert.match(setupGuide, /npm ci/);
  assert.match(setupGuide, /npm run doctor/);
  assert.match(setupGuide, /npm run agent:bootstrap/);
  assert.match(setupGuide, /npm run test:e2e:desktop/);
});
