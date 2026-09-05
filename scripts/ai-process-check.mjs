import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(projectRoot, relativePath, errors) {
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  } catch (cause) {
    errors.push(`${relativePath} 无法读取：${cause instanceof Error ? cause.message : String(cause)}`);
    return "";
  }
}

export function validateAiProcess(projectRoot = defaultRoot) {
  const errors = [];
  const agents = read(projectRoot, "AGENTS.md", errors);
  const tasks = read(projectRoot, "docs/AI-TASKS.md", errors);
  const contract = read(projectRoot, "docs/AI-EXECUTION-CONTRACT.md", errors);
  const prTemplate = read(projectRoot, ".github/pull_request_template.md", errors);

  const required = [
    ["AGENTS.md", agents, "docs/AI-EXECUTION-CONTRACT.md"],
    ["AGENTS.md", agents, "GitHub 当前状态优先于任务板"],
    ["docs/AI-TASKS.md", tasks, "GitHub 当前 Issue / PR / target branch 状态优先于本文件"],
    ["docs/AI-TASKS.md", tasks, "IN_PROGRESS — PR #N"],
    ["docs/AI-TASKS.md", tasks, "DONE — PR #N"],
    ["docs/AI-EXECUTION-CONTRACT.md", contract, "GitHub 是“代码是否真的存在”的最终真源"],
    [".github/pull_request_template.md", prTemplate, "Issue / Task"],
    [".github/pull_request_template.md", prTemplate, "docs/AI-TASKS.md"],
  ];

  for (const [relativePath, text, fragment] of required) {
    if (!text.includes(fragment)) errors.push(`${relativePath} 缺少 AI 交接契约：${fragment}`);
  }

  // Active PR template must not resurrect the superseded governance protocol.
  const forbiddenInTemplate = ["AWAITING_APPROVAL", "ai:finish", "ai:render", "批准队列", "风险级别：T0"];
  for (const token of forbiddenInTemplate) {
    if (prTemplate.includes(token)) errors.push(`.github/pull_request_template.md 重新出现已废弃流程：${token}`);
  }

  // Status lines that claim work exists must point to a concrete PR.
  for (const [index, line] of tasks.split(/\r?\n/).entries()) {
    if (/\*\*状态：(?:IN_PROGRESS|DONE)\b/.test(line) && !/PR #\d+/.test(line)) {
      errors.push(`docs/AI-TASKS.md:${index + 1} 的 ${line.includes("DONE") ? "DONE" : "IN_PROGRESS"} 状态缺少 PR 号。`);
    }
  }

  return errors;
}

export function runAiProcessCheck(projectRoot = defaultRoot) {
  const errors = validateAiProcess(projectRoot);
  if (errors.length) {
    console.error("AI process check failed:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }
  console.log("AI process check passed: takeover, task status and PR template are consistent.");
  return 0;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) process.exitCode = runAiProcessCheck();
