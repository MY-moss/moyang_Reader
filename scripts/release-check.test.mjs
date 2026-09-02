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
  validateProject,
  validateReleaseWorkflow,
  validateWindowsIconAssets,
} from "./release-check.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createIconFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-windows-icons-"));
  fs.mkdirSync(path.join(root, "src", "assets"), { recursive: true });
  const sourceIcons = path.join(sourceRoot, "src-tauri", "icons");
  const targetIcons = path.join(root, "src-tauri", "icons");
  fs.mkdirSync(targetIcons, { recursive: true });
  for (const entry of fs.readdirSync(sourceIcons, { withFileTypes: true })) {
    if (entry.isFile()) fs.copyFileSync(path.join(sourceIcons, entry.name), path.join(targetIcons, entry.name));
  }
  fs.copyFileSync(
    path.join(sourceRoot, "src", "assets", "moyang-reader-logo.png"),
    path.join(root, "src", "assets", "moyang-reader-logo.png"),
  );
  const config = JSON.parse(fs.readFileSync(path.join(sourceRoot, "src-tauri", "tauri.conf.json"), "utf8"));
  return { root, config };
}

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

test("requires the canonical Windows icon set and release-check integration", () => {
  assert.deepEqual(validateWindowsIconAssets(sourceRoot), []);
  assert.deepEqual(validateProject(sourceRoot).errors, []);
});

test("rejects missing, stale, and unsafe Windows icon resources", () => {
  const { root, config } = createIconFixture();
  try {
    fs.rmSync(path.join(root, "src-tauri", "icons", "icon.ico"));
    let errors = validateWindowsIconAssets(root, config);
    assert.equal(
      errors.some((error) => error.includes("icons/icon.ico") && error.includes("缺失或为空")),
      true,
    );

    fs.copyFileSync(
      path.join(sourceRoot, "src-tauri", "icons", "32x32.png"),
      path.join(root, "src-tauri", "icons", "icon.png"),
    );
    errors = validateWindowsIconAssets(root, config);
    assert.equal(
      errors.some((error) => error.includes("icons/icon.png") && error.includes("不一致")),
      true,
    );

    const icoPath = path.join(root, "src-tauri", "icons", "icon.ico");
    fs.copyFileSync(path.join(sourceRoot, "src-tauri", "icons", "icon.ico"), icoPath);
    const ico = fs.readFileSync(icoPath);
    ico[16] ^= 0xff;
    fs.writeFileSync(icoPath, ico);
    errors = validateWindowsIconAssets(root, config);
    assert.equal(
      errors.some((error) => error.includes("icons/icon.ico") && error.includes("不一致")),
      true,
    );

    fs.writeFileSync(path.join(root, "src-tauri", "icons", "icon.svg"), '<path d="M214 752V272" fill="#356b67" />');
    errors = validateWindowsIconAssets(root, {
      ...config,
      bundle: { ...config.bundle, icon: ["icons/icon.svg"] },
    });
    assert.equal(
      errors.some((error) => error.includes("必须指向 .ico 或 .png")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("旧字母 M 图标")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("guards release and mirror workflows against stale or incomplete publishing", () => {
  assert.deepEqual(validateReleaseWorkflow(sourceRoot), []);
});

test("runs release builds through the direct Tauri CLI and retries transient publishing failures", () => {
  const release = fs.readFileSync(path.join(sourceRoot, ".github", "workflows", "release.yml"), "utf8");
  assert.match(release, /^\s+tauriScript:\s+npx tauri\s*$/m);
  assert.match(release, /^\s+retryAttempts:\s+3\s*$/m);
});

test("rejects a mirror workflow that can silently skip deployment or duplicate triggers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-release-workflow-"));
  try {
    fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.copyFileSync(
      path.join(sourceRoot, ".github", "workflows", "release.yml"),
      path.join(root, ".github", "workflows", "release.yml"),
    );
    fs.copyFileSync(
      path.join(sourceRoot, ".github", "workflows", "mirror-health.yml"),
      path.join(root, ".github", "workflows", "mirror-health.yml"),
    );
    const mirrorPath = path.join(root, ".github", "workflows", "mirror-release.yml");
    const mirror = fs
      .readFileSync(path.join(sourceRoot, ".github", "workflows", "mirror-release.yml"), "utf8")
      .replace(
        "  workflow_dispatch:",
        '  workflow_run:\n    workflows: ["Release"]\n    types: [completed]\n  workflow_dispatch:',
      )
      .replace(
        'throw "缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID；正式 Release 不允许跳过镜像上传。"',
        '"CLOUDFLARE_DEPLOY_ENABLED=false" >> $env:GITHUB_ENV',
      );
    fs.writeFileSync(mirrorPath, mirror);
    fs.copyFileSync(
      path.join(sourceRoot, "scripts", "mirror-worker.js"),
      path.join(root, "scripts", "mirror-worker.js"),
    );

    const errors = validateReleaseWorkflow(root);
    assert.equal(
      errors.some((error) => error.includes("workflow_run")),
      true,
    );
    assert.equal(
      errors.some((error) => error.includes("静默跳过")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
