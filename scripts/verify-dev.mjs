import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEV_VERIFY_STEPS = Object.freeze([
  Object.freeze({ npmScript: "doctor", label: "开发环境前置条件" }),
  Object.freeze({ npmScript: "test:workflow", label: "工作流辅助测试" }),
  Object.freeze({ npmScript: "test", label: "Vitest 单元与组件测试" }),
  Object.freeze({ npmScript: "lint", label: "ESLint" }),
  Object.freeze({ npmScript: "check:architecture", label: "架构边界检查" }),
  Object.freeze({ npmScript: "build", label: "生产构建" }),
]);

function quoteWindowsArgument(value) {
  const text = String(value);
  return /[\s"&|<>^]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

export function runNpmScript(step, cwd = defaultRoot, platform = process.platform) {
  try {
    if (platform === "win32") {
      const commandLine = ["npm.cmd", "run", step.npmScript].map(quoteWindowsArgument).join(" ");
      execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandLine], {
        cwd,
        stdio: "inherit",
      });
    } else {
      execFileSync("npm", ["run", step.npmScript], { cwd, stdio: "inherit" });
    }
    return { status: 0 };
  } catch (error) {
    return { status: Number.isInteger(error?.status) ? error.status : 1 };
  }
}

export function runVerification({ cwd = defaultRoot, run = runNpmScript, log = console.log } = {}) {
  const completedSteps = [];
  for (const step of DEV_VERIFY_STEPS) {
    log(`[verify:dev] ${step.label}：npm run ${step.npmScript}`);
    const result = run(step, cwd);
    if (result?.status !== 0) {
      return {
        ok: false,
        failedStep: step,
        exitCode: Number.isInteger(result?.status) && result.status > 0 ? result.status : 1,
      };
    }
    completedSteps.push(step);
  }
  return { ok: true, completedSteps, exitCode: 0 };
}

function main() {
  const result = runVerification();
  if (result.ok) {
    console.log("[verify:dev] 轻量开发验证全部通过；接下来可按需运行 npm run desktop。");
  } else {
    console.error(`[verify:dev] ${result.failedStep.label} 失败；请先处理该步骤后重试。`);
  }
  process.exitCode = result.exitCode;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) main();
