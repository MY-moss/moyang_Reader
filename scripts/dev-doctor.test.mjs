import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectDoctorChecks, doctorExitCode, formatDoctorReport, summarizeDoctorChecks } from "./dev-doctor.mjs";

function createFakeFs(existingPaths) {
  const normalized = new Set([...existingPaths].map((candidate) => path.resolve(candidate)));
  return {
    existsSync(candidate) {
      return normalized.has(path.resolve(candidate));
    },
  };
}

function createCommandRunner(results = {}) {
  return (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const result = results[key] ?? results[command];
    if (!result) return { ok: false, stdout: "", stderr: `未配置命令：${key}` };
    return typeof result === "string" ? { ok: true, stdout: result, stderr: "" } : result;
  };
}

function createWindowsFixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-doctor-"));
  const existing = [
    path.join(root, "package.json"),
    path.join(root, "package-lock.json"),
    path.join(root, "node_modules"),
    path.join(root, "node_modules", "react"),
    path.join(root, "node_modules", "vite"),
    path.join(root, "node_modules", "@tauri-apps", "cli"),
  ];
  const env = {
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
    ProgramFiles: "C:\\Program Files",
    WindowsSdkDir: "C:\\Program Files (x86)\\Windows Kits\\10\\",
    ...overrides.env,
  };
  const fsApi = createFakeFs([...existing, env.WindowsSdkDir]);
  const run = createCommandRunner({
    "npm.cmd --version": "10.9.2",
    "rustc --version": "rustc 1.88.0 (6b00bc388 2025-06-23)",
    "cargo --version": "cargo 1.88.0",
    "rustup show active-toolchain": "stable-x86_64-pc-windows-msvc (active, default)",
    "rustup target list --installed": "x86_64-pc-windows-msvc\ni686-pc-windows-msvc",
    "where.exe cl.exe": "C:\\BuildTools\\cl.exe",
    "reg.exe query HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00D3A674333E} /v pv":
      "pv    REG_SZ    140.0.3485.54",
    "git.exe --version": "git version 2.50.1.windows.1",
    "git.exe status --short --branch": "## codex/d02-dev-doctor-2026-09-19",
    ...overrides.commands,
  });
  return {
    root,
    env,
    fsApi,
    run,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test("reports a usable Windows x64 development environment", () => {
  const fixture = createWindowsFixture();
  try {
    const checks = collectDoctorChecks({
      root: fixture.root,
      platform: "win32",
      arch: "x64",
      nodeVersion: "22.14.0",
      env: fixture.env,
      fsApi: fixture.fsApi,
      run: fixture.run,
    });
    assert.equal(doctorExitCode(checks), 0);
    assert.deepEqual(summarizeDoctorChecks(checks), { pass: 13, warn: 0, fail: 0, skip: 0 });
  } finally {
    fixture.cleanup();
  }
});

test("reports missing desktop prerequisites without attempting installation", () => {
  const fixture = createWindowsFixture({
    commands: {
      "rustc --version": { ok: true, stdout: "rustc 1.87.0", stderr: "" },
      "rustup target list --installed": { ok: true, stdout: "", stderr: "" },
      "where.exe cl.exe": { ok: false, stdout: "", stderr: "INFO: Could not find files" },
      "vswhere.exe": { ok: false, stdout: "", stderr: "not found" },
      "reg.exe query HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00D3A674333E} /v pv":
        {
          ok: false,
          stdout: "",
          stderr: "not found",
        },
      "reg.exe query HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00D3A674333E} /v pv": {
        ok: false,
        stdout: "",
        stderr: "not found",
      },
      "reg.exe query HKCU\\Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00D3A674333E} /v pv": {
        ok: false,
        stdout: "",
        stderr: "not found",
      },
      "git.exe status --short --branch": "## codex/d02-dev-doctor-2026-09-19\n M notes.md",
    },
  });
  try {
    const checks = collectDoctorChecks({
      root: fixture.root,
      platform: "win32",
      arch: "x64",
      nodeVersion: "21.7.0",
      env: { ...fixture.env, WindowsSdkDir: "C:\\missing" },
      fsApi: createFakeFs([
        path.join(fixture.root, "package.json"),
        path.join(fixture.root, "package-lock.json"),
        path.join(fixture.root, "node_modules"),
      ]),
      run: fixture.run,
    });
    const byId = new Map(checks.map((check) => [check.id, check]));
    assert.equal(byId.get("node").status, "fail");
    assert.equal(byId.get("rust").status, "fail");
    assert.equal(byId.get("rust-target").status, "fail");
    assert.equal(byId.get("msvc").status, "fail");
    assert.equal(byId.get("windows-sdk").status, "fail");
    assert.equal(byId.get("webview2").status, "fail");
    assert.equal(byId.get("dependencies").status, "fail");
    assert.equal(byId.get("git").status, "warn");
    assert.equal(doctorExitCode(checks), 1);
    const report = formatDoctorReport(checks);
    assert.match(report, /不会安装依赖/);
    assert.match(report, /npm ci/);
    assert.match(report, /WebView2 Runtime/);
  } finally {
    fixture.cleanup();
  }
});

test("skips Windows-only checks on non-Windows hosts while still checking shared tools", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-doctor-nonwin-"));
  const existing = [
    path.join(root, "package.json"),
    path.join(root, "package-lock.json"),
    path.join(root, "node_modules"),
    path.join(root, "node_modules", "react"),
    path.join(root, "node_modules", "vite"),
    path.join(root, "node_modules", "@tauri-apps", "cli"),
  ];
  const run = createCommandRunner({
    npm: "10.9.2",
    rustc: "rustc 1.88.0",
    cargo: "cargo 1.88.0",
    git: "git version 2.50.1",
    "git status --short --branch": "## main",
  });
  try {
    const checks = collectDoctorChecks({
      root,
      platform: "linux",
      arch: "x64",
      nodeVersion: "22.14.0",
      fsApi: createFakeFs(existing),
      run,
    });
    const byId = new Map(checks.map((check) => [check.id, check]));
    assert.equal(byId.get("windows").status, "fail");
    assert.equal(byId.get("msvc").status, "skip");
    assert.equal(byId.get("webview2").status, "skip");
    assert.equal(byId.get("rust-target").status, "skip");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
