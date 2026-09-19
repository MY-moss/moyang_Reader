import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const minimumNodeMajor = 22;
const minimumRust = { major: 1, minor: 88 };
const requiredWindowsTarget = "x86_64-pc-windows-msvc";
const webView2ClientId = "{F3017226-FE2A-4295-8BDF-00D3A674333E}";

const statusLabels = {
  pass: "通过",
  warn: "警告",
  fail: "失败",
  skip: "跳过",
};

const statusIcons = {
  pass: "✓",
  warn: "!",
  fail: "×",
  skip: "-",
};

function commandName(name, platform) {
  if (platform === "win32" && ["npm", "npx"].includes(name)) return `${name}.cmd`;
  if (platform === "win32" && name === "git") return "git.exe";
  return name;
}

function quoteWindowsArgument(value) {
  const text = String(value);
  return /[\s"&|<>^]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

function defaultRunCommand(command, args, cwd) {
  try {
    const runsThroughCmd = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
    const executable = runsThroughCmd ? process.env.ComSpec || "cmd.exe" : command;
    const commandArgs = runsThroughCmd
      ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArgument).join(" ")]
      : args;
    return {
      ok: true,
      stdout: execFileSync(executable, commandArgs, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
      stderr: "",
    };
  } catch (error) {
    return {
      ok: false,
      stdout: typeof error?.stdout === "string" ? error.stdout.trim() : "",
      stderr: typeof error?.stderr === "string" ? error.stderr.trim() : error?.message || "命令执行失败",
    };
  }
}

function makeCheck(id, label, status, message, details = "") {
  return { id, label, status, message, details };
}

function parseVersion(value) {
  const match = String(value ?? "").match(/(?:^|\s|v)(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3] ?? "0", 10),
  };
}

function compareVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
}

function commandOutput(run, command, args, cwd) {
  const result = run(command, args, cwd);
  return result?.ok ? String(result.stdout ?? "").trim() : "";
}

function locateVsWhere(platform, env, fsApi) {
  if (platform !== "win32") return "vswhere.exe";
  const candidates = [
    env.VSWHERE_PATH,
    env["ProgramFiles(x86)"]
      ? path.join(env["ProgramFiles(x86)"], "Microsoft Visual Studio", "Installer", "vswhere.exe")
      : "",
    env.ProgramFiles ? path.join(env.ProgramFiles, "Microsoft Visual Studio", "Installer", "vswhere.exe") : "",
  ].filter(Boolean);
  return candidates.find((candidate) => fsApi.existsSync(candidate)) ?? "vswhere.exe";
}

function runVsWhere(run, vswhere, args, cwd) {
  return run(vswhere, args, cwd);
}

function checkPlatform(platform, arch) {
  const platformCheck =
    platform === "win32"
      ? makeCheck("windows", "Windows", "pass", "检测到 Windows 环境。")
      : makeCheck("windows", "Windows", "fail", "Moyang Reader 桌面开发需要 Windows x64。", `当前平台：${platform}`);
  const archCheck =
    arch === "x64"
      ? makeCheck("architecture", "CPU 架构", "pass", "检测到 x64。")
      : makeCheck("architecture", "CPU 架构", "fail", "需要 x64 架构。", `当前架构：${arch}`);
  return [platformCheck, archCheck];
}

function checkNodeAndNpm({ platform, nodeVersion, run, root }) {
  const node = parseVersion(nodeVersion);
  let nodeCheck;
  if (!node) {
    nodeCheck = makeCheck("node", "Node.js", "fail", "无法解析 Node.js 版本。", nodeVersion);
  } else if (node.major < minimumNodeMajor) {
    nodeCheck = makeCheck("node", "Node.js", "fail", `需要 Node.js ${minimumNodeMajor} 或更高版本。`, nodeVersion);
  } else if (node.major !== minimumNodeMajor) {
    nodeCheck = makeCheck(
      "node",
      "Node.js",
      "warn",
      `当前为 Node.js ${node.major}；CI 约定使用 Node.js ${minimumNodeMajor}。`,
      nodeVersion,
    );
  } else {
    nodeCheck = makeCheck("node", "Node.js", "pass", `Node.js ${minimumNodeMajor} 主版本符合约定。`, nodeVersion);
  }

  const npmCommand = commandName("npm", platform);
  const npmVersion = commandOutput(run, npmCommand, ["--version"], root);
  const npmCheck = npmVersion
    ? makeCheck("npm", "npm", "pass", "npm 可用。", npmVersion)
    : makeCheck("npm", "npm", "fail", "找不到 npm；请安装 Node.js 22 LTS 后重启终端。", "npm --version 失败");
  return [nodeCheck, npmCheck];
}

function checkRust({ platform, run, root }) {
  const rustcCommand = commandName("rustc", platform);
  const cargoCommand = commandName("cargo", platform);
  const rustupCommand = commandName("rustup", platform);
  const rustc = run(rustcCommand, ["--version"], root);
  const rustVersion = rustc.ok ? parseVersion(rustc.stdout) : null;
  const rustCheck = !rustVersion
    ? makeCheck("rust", "Rust", "fail", "找不到可用的 rustc，或版本无法解析。", rustc.stderr || rustc.stdout)
    : compareVersions(rustVersion, minimumRust) < 0
      ? makeCheck("rust", "Rust", "fail", "Rust 版本低于仓库要求的 1.88。", rustc.stdout)
      : makeCheck("rust", "Rust", "pass", "Rust 版本符合仓库最低要求。", rustc.stdout);

  const cargo = run(cargoCommand, ["--version"], root);
  const cargoCheck = cargo.ok
    ? makeCheck("cargo", "Cargo", "pass", "Cargo 可用。", cargo.stdout)
    : makeCheck("cargo", "Cargo", "fail", "找不到 Cargo；请通过 rustup 安装 stable MSVC 工具链。", cargo.stderr);

  if (platform !== "win32") {
    return [
      rustCheck,
      cargoCheck,
      makeCheck("rust-toolchain", "Rust MSVC 工具链", "skip", "仅在 Windows 桌面环境检查。"),
      makeCheck("rust-target", "Rust MSVC target", "skip", "仅在 Windows 桌面环境检查。"),
    ];
  }

  const activeToolchain = run(rustupCommand, ["show", "active-toolchain"], root);
  const toolchainText = `${activeToolchain.stdout ?? ""} ${activeToolchain.stderr ?? ""}`;
  const toolchainCheck =
    activeToolchain.ok && /(?:stable|\d+\.\d+\.\d+).*x86_64-pc-windows-msvc/i.test(toolchainText)
      ? makeCheck("rust-toolchain", "Rust MSVC 工具链", "pass", "默认工具链为 Windows MSVC。", activeToolchain.stdout)
      : makeCheck(
          "rust-toolchain",
          "Rust MSVC 工具链",
          "fail",
          "默认 Rust 工具链不是 x86_64-pc-windows-msvc。",
          activeToolchain.stderr || activeToolchain.stdout,
        );

  const installedTargets = run(rustupCommand, ["target", "list", "--installed"], root);
  const targetCheck =
    installedTargets.ok && installedTargets.stdout.split(/\r?\n/).includes(requiredWindowsTarget)
      ? makeCheck("rust-target", "Rust MSVC target", "pass", `${requiredWindowsTarget} 已安装。`)
      : makeCheck(
          "rust-target",
          "Rust MSVC target",
          "fail",
          `缺少 ${requiredWindowsTarget}；请通过 rustup 安装。`,
          installedTargets.stderr || installedTargets.stdout,
        );
  return [rustCheck, cargoCheck, toolchainCheck, targetCheck];
}

function checkVisualStudio({ platform, run, root, env, fsApi }) {
  if (platform !== "win32") {
    return [
      makeCheck("msvc", "Microsoft C++ Build Tools", "skip", "仅在 Windows 桌面环境检查。"),
      makeCheck("windows-sdk", "Windows SDK", "skip", "仅在 Windows 桌面环境检查。"),
    ];
  }

  const cl = run("where.exe", ["cl.exe"], root);
  const vswhere = locateVsWhere(platform, env, fsApi);
  const buildTools = cl.ok
    ? cl
    : runVsWhere(
        run,
        vswhere,
        [
          "-latest",
          "-products",
          "*",
          "-requires",
          "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
          "-property",
          "installationPath",
        ],
        root,
      );
  const msvcCheck =
    buildTools.ok && String(buildTools.stdout ?? "").trim()
      ? makeCheck("msvc", "Microsoft C++ Build Tools", "pass", "已检测到 C++ 编译工具。", buildTools.stdout)
      : makeCheck(
          "msvc",
          "Microsoft C++ Build Tools",
          "fail",
          "未检测到 MSVC C++ 编译工具；请安装 Desktop development with C++。",
          buildTools.stderr || "cl.exe / vswhere.exe 检查失败",
        );

  const sdkDirectories = [
    env.WindowsSdkDir,
    env["ProgramFiles(x86)"] ? path.join(env["ProgramFiles(x86)"], "Windows Kits", "10") : "",
    env.ProgramFiles ? path.join(env.ProgramFiles, "Windows Kits", "10") : "",
  ].filter(Boolean);
  const detectedSdkDirectory = sdkDirectories.find((candidate) => fsApi.existsSync(candidate));
  const sdk = detectedSdkDirectory
    ? { ok: true, stdout: detectedSdkDirectory, stderr: "" }
    : runVsWhere(
        run,
        vswhere,
        [
          "-latest",
          "-products",
          "*",
          "-requiresAny",
          "Microsoft.VisualStudio.Component.Windows10SDK.19041",
          "Microsoft.VisualStudio.Component.Windows10SDK.20348",
          "Microsoft.VisualStudio.Component.Windows11SDK.22000",
          "Microsoft.VisualStudio.Component.Windows11SDK.22621",
          "-property",
          "installationPath",
        ],
        root,
      );
  const sdkCheck =
    sdk.ok && String(sdk.stdout ?? "").trim()
      ? makeCheck("windows-sdk", "Windows SDK", "pass", "已检测到 Windows SDK。", sdk.stdout)
      : makeCheck(
          "windows-sdk",
          "Windows SDK",
          "fail",
          "未检测到 Windows SDK；请在 Visual Studio Installer 中安装 Windows SDK。",
          sdk.stderr || "WindowsSdkDir / vswhere.exe 检查失败",
        );
  return [msvcCheck, sdkCheck];
}

function checkWebView2({ platform, run, root }) {
  if (platform !== "win32") return makeCheck("webview2", "WebView2 Runtime", "skip", "仅在 Windows 桌面环境检查。");

  const registryPaths = [
    `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\${webView2ClientId}`,
    `HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${webView2ClientId}`,
    `HKCU\\Software\\Microsoft\\EdgeUpdate\\Clients\\${webView2ClientId}`,
  ];
  for (const registryPath of registryPaths) {
    const result = run("reg.exe", ["query", registryPath, "/v", "pv"], root);
    if (result.ok && /\bpv\b/i.test(result.stdout) && !/0\.0\.0\.0/.test(result.stdout)) {
      return makeCheck("webview2", "WebView2 Runtime", "pass", "已检测到 WebView2 Runtime。", result.stdout);
    }
  }
  return makeCheck(
    "webview2",
    "WebView2 Runtime",
    "fail",
    "未检测到 WebView2 Runtime；浏览器预览不能替代桌面运行时。",
    "已检查 HKLM/HKCU EdgeUpdate 注册表项",
  );
}

function checkDependencies({ root, fsApi }) {
  const packageJson = path.join(root, "package.json");
  const lockfile = path.join(root, "package-lock.json");
  const nodeModules = path.join(root, "node_modules");
  const requiredModules = [
    path.join(nodeModules, "react"),
    path.join(nodeModules, "vite"),
    path.join(nodeModules, "@tauri-apps", "cli"),
  ];

  if (!fsApi.existsSync(packageJson) || !fsApi.existsSync(lockfile)) {
    return makeCheck("dependencies", "项目依赖", "fail", "缺少 package.json 或 package-lock.json。", root);
  }
  if (!fsApi.existsSync(nodeModules)) {
    return makeCheck("dependencies", "项目依赖", "fail", "未发现 node_modules；请执行 npm ci。", "node_modules 不存在");
  }
  const missing = requiredModules.filter((modulePath) => !fsApi.existsSync(modulePath));
  return missing.length === 0
    ? makeCheck("dependencies", "项目依赖", "pass", "核心前端、构建和 Tauri 依赖已恢复。")
    : makeCheck(
        "dependencies",
        "项目依赖",
        "fail",
        "node_modules 不完整；请在当前工作树执行 npm ci。",
        missing.map((modulePath) => path.relative(root, modulePath)).join(", "),
      );
}

function checkGit({ platform, run, root }) {
  const gitCommand = commandName("git", platform);
  const version = run(gitCommand, ["--version"], root);
  if (!version.ok) return makeCheck("git", "Git", "fail", "找不到 Git。", version.stderr);

  const status = run(gitCommand, ["status", "--short", "--branch"], root);
  if (!status.ok) return makeCheck("git", "Git 工作树", "fail", "无法读取当前 Git 工作树。", status.stderr);
  const dirtyLines = status.stdout.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("##"));
  return dirtyLines.length === 0
    ? makeCheck("git", "Git 工作树", "pass", "Git 可用，当前工作树干净。", version.stdout)
    : makeCheck(
        "git",
        "Git 工作树",
        "warn",
        "Git 可用，但当前工作树有未提交改动；doctor 不会覆盖这些改动。",
        dirtyLines.slice(0, 8).join("\n"),
      );
}

export function collectDoctorChecks({
  root = defaultRoot,
  platform = process.platform,
  arch = process.arch,
  nodeVersion = process.versions.node,
  env = process.env,
  fsApi = fs,
  run = defaultRunCommand,
} = {}) {
  const resolvedRoot = path.resolve(root);
  return [
    ...checkPlatform(platform, arch),
    ...checkNodeAndNpm({ platform, nodeVersion, run, root: resolvedRoot }),
    ...checkRust({ platform, run, root: resolvedRoot }),
    ...checkVisualStudio({ platform, run, root: resolvedRoot, env, fsApi }),
    checkWebView2({ platform, run, root: resolvedRoot }),
    checkDependencies({ root: resolvedRoot, fsApi }),
    checkGit({ platform, run, root: resolvedRoot }),
  ];
}

export function summarizeDoctorChecks(checks) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warn: 0, fail: 0, skip: 0 },
  );
}

export function formatDoctorReport(checks) {
  const lines = ["Moyang Reader development doctor", "", "只读检查：不会安装依赖、修改系统设置或覆盖工作树。", ""];
  for (const check of checks) {
    lines.push(`${statusIcons[check.status]} ${check.label}：${statusLabels[check.status]} — ${check.message}`);
    if (check.details) {
      for (const detail of String(check.details).split(/\r?\n/).slice(0, 8)) {
        if (detail.trim()) lines.push(`  ${detail}`);
      }
    }
  }
  const summary = summarizeDoctorChecks(checks);
  lines.push("", `结果：${summary.pass} 通过，${summary.warn} 警告，${summary.fail} 失败，${summary.skip} 跳过。`);
  if (summary.fail > 0) lines.push("请先处理失败项，再运行 npm run doctor；警告项不会阻止 doctor 返回成功。");
  return lines.join("\n");
}

export function doctorExitCode(checks) {
  return summarizeDoctorChecks(checks).fail > 0 ? 1 : 0;
}

function main() {
  const checks = collectDoctorChecks();
  console.log(formatDoctorReport(checks));
  process.exitCode = doctorExitCode(checks);
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) main();
