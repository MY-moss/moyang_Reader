import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateReleaseStatus } from "./release-status-check.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyStatusFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-release-status-"));
  fs.mkdirSync(path.join(root, "docs", "handoff"), { recursive: true });
  fs.mkdirSync(path.join(root, "src-tauri"), { recursive: true });
  for (const relativePath of [
    "package.json",
    "CHANGELOG.md",
    "docs/NEXT.md",
    "docs/AI-HANDOFF.md",
    "docs/AI-TAKEOVER-PROMPT.md",
    "docs/RELEASE-POLICY.md",
    "docs/release-status.json",
    "docs/handoff/v0.11.md",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
  ]) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relativePath), target);
  }
  return root;
}

function readStatus(root) {
  const statusPath = path.join(root, "docs", "release-status.json");
  return JSON.parse(fs.readFileSync(statusPath, "utf8"));
}

function writeStatus(root, status) {
  fs.writeFileSync(path.join(root, "docs", "release-status.json"), JSON.stringify(status, null, 2) + "\n", "utf8");
}

test("accepts the checked-in release and handoff status", () => {
  assert.deepEqual(validateReleaseStatus(sourceRoot), []);
});

test("rejects a NEXT file with duplicate or missing readiness status", () => {
  const root = copyStatusFixture();
  try {
    const nextPath = path.join(root, "docs", "NEXT.md");
    const next = fs.readFileSync(nextPath, "utf8");
    fs.writeFileSync(nextPath, next.replace("- 状态：READY", "- 状态：READY\n- 状态：BLOCKED"), "utf8");
    let errors = validateReleaseStatus(root);
    assert.equal(
      errors.some((error) => error.includes("唯一状态")),
      true,
    );

    fs.writeFileSync(nextPath, next.replace("- 状态：READY", ""), "utf8");
    errors = validateReleaseStatus(root);
    assert.equal(
      errors.some((error) => error.includes("唯一状态")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects release status when versions, assets, or changelog drift", () => {
  const root = copyStatusFixture();
  try {
    const status = readStatus(root);
    status.release.version = "0.10.13";
    status.release.assets[0].name = "unsafe/installer.exe";
    writeStatus(root, status);
    fs.writeFileSync(
      path.join(root, "CHANGELOG.md"),
      fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").replace("## [0.10.14]", "## [0.10.13]"),
      "utf8",
    );

    const errors = validateReleaseStatus(root);
    assert.equal(
      errors.some((error) => error.includes("版本")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("资产")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("CHANGELOG")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("requires evidence for blocked external release checks and existing handoff links", () => {
  const root = copyStatusFixture();
  try {
    const status = readStatus(root);
    status.mirror.staticWorkflow.reason = "";
    status.externalChecks.authenticode.evidence = "docs/missing.md";
    status.handoff.versionArchive = "docs/handoff/missing.md";
    writeStatus(root, status);

    const errors = validateReleaseStatus(root);
    assert.equal(
      errors.some((error) => error.includes("镜像") && error.includes("原因")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("证据") || error.includes("不存在")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("交接")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
