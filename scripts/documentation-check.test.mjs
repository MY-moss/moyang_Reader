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
    ["README.md", ""],
    ["SECURITY.md", ""],
    ["PRIVACY.md", "应用先从公开 Cloudflare Pages 镜像检查更新，镜像不可用时回退到 GitHub Releases。"],
    ["docs/RELEASE-POLICY.md", "更新端点按配置顺序先尝试公开 Cloudflare Pages 动态镜像，再回退到 GitHub Release。"],
    ["docs/USER-GUIDE.md", "更新器先尝试公开 Cloudflare Pages 镜像，镜像不可用时回退 GitHub Release。"],
    ["docs/UPDATE.md", ""],
    ["docs/UI-INTERACTION.md", ""],
  ]);

  const errors = validateUpdaterAuthorityClaims(documents);

  assert.equal(errors.length, 3);
});

test("requires the canonical Windows development setup guide", () => {
  const setupGuide = fs.readFileSync(path.join(sourceRoot, "docs", "DEVELOPMENT-SETUP.md"), "utf8");

  assert.match(setupGuide, /npm ci/);
  assert.match(setupGuide, /npm run doctor/);
  assert.match(setupGuide, /npm run verify:dev/);
  assert.match(setupGuide, /npm run agent:bootstrap/);
  assert.match(setupGuide, /npm run test:e2e:desktop/);
});

test("requires an explicit v1.0 freeze contract", () => {
  const taskQueue = fs.readFileSync(path.join(sourceRoot, "docs", "AI-TASKS.md"), "utf8");
  const readme = fs.readFileSync(path.join(sourceRoot, "README.md"), "utf8");
  const futurePlan = fs.readFileSync(path.join(sourceRoot, "docs", "FUTURE-DEVELOPMENT-PLAN.md"), "utf8");

  assert.match(taskQueue, /当前唯一可执行范围是本节的 `D00–Dxx` 任务/);
  assert.match(taskQueue, /v1\.x 候选、Future Issues 和 Future Development Plan 中的条目全部保持 `GATED`/);
  assert.match(readme, /当前唯一可执行范围是 `docs\/AI-TASKS\.md` 的 `D00–Dxx`/);
  assert.match(futurePlan, /当前状态：`GATED`/);
});
