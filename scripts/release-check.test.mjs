import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isSemver,
  normalizeVersion,
  validateExpectedVersion,
  validateManifest,
  validatePublicDocumentation,
  validateReleaseWorkflow,
} from "./release-check.mjs";

test("normalizes release versions and accepts semver", () => {
  assert.equal(normalizeVersion("v0.5.1"), "0.5.1");
  assert.equal(isSemver("v0.5.1"), true);
  assert.equal(isSemver("0.5"), false);
});

test("requires a release tag version to match the project version", () => {
  assert.deepEqual(validateExpectedVersion("v0.5.1", "0.5.1"), []);
  assert.equal(validateExpectedVersion("v0.5", "0.5.1").length, 1);
  assert.equal(validateExpectedVersion("v0.5.2", "0.5.1").length, 1);
});

test("accepts a complete Windows updater manifest", () => {
  const errors = validateManifest(
    {
      version: "v0.5.1",
      platforms: {
        "windows-x86_64": {
          url: "https://github.com/MY-moss/moyang_Reader/releases/download/v0.5.1/Moyang.Reader_0.5.1_x64-setup.exe",
          signature: "x".repeat(64),
        },
      },
    },
    "0.5.1",
  );

  assert.deepEqual(errors, []);
});

test("rejects incomplete or unsafe updater metadata", () => {
  const errors = validateManifest(
    {
      version: "v0.5.2",
      platforms: {
        "windows-x86_64": {
          url: "http://example.com/update.exe",
          signature: "short",
        },
      },
    },
    "0.5.1",
  );

  assert.equal(
    errors.some((error) => error.includes("version")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("HTTPS")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("signature")),
    true,
  );
});

test("validates updater metadata for every declared platform", () => {
  const errors = validateManifest(
    {
      version: "0.5.1",
      platforms: {
        "windows-x86_64": {
          url: "https://github.com/example/windows.exe",
          signature: "x".repeat(64),
        },
        "darwin-aarch64": {
          url: "http://example.com/macos.tar.gz",
          signature: "short",
        },
        "linux-x86_64": null,
      },
    },
    "0.5.1",
  );

  assert.equal(
    errors.some((error) => error.includes("darwin-aarch64.url") && error.includes("HTTPS")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("darwin-aarch64.signature")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("linux-x86_64") && error.includes("格式错误")),
    true,
  );
});

test("rejects private local paths and empty signing passwords in public docs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-release-docs-"));
  fs.mkdirSync(path.join(root, "docs"));
  const windowsPath = ["C:", "Users", "Example", ".moyang-reader", "signing.key"].join("\\");
  const emptyPassword = ["TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "=", String.fromCharCode(34, 34)].join("");
  fs.writeFileSync(path.join(root, "docs", "UPDATE.md"), [`Key path: ${windowsPath}`, emptyPassword].join("\n"));

  const errors = validatePublicDocumentation(root);
  assert.equal(
    errors.some((error) => error.includes("绝对路径")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("空的签名私钥密码")),
    true,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("guards release and mirror workflows against stale or incomplete publishing", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  assert.deepEqual(validateReleaseWorkflow(root), []);
});
