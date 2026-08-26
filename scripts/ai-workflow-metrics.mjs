#!/usr/bin/env node

import fs from "node:fs";
import readline from "node:readline";

const DEFAULT_CUTOFF = Number.POSITIVE_INFINITY;
const phaseRanges = [
  [1, 8, "需求与调研规划"],
  [9, 18, "首轮功能与更新发布链路"],
  [19, 33, "CI/分支/权限阻塞"],
  [34, 62, "UI/功能迭代与版本发布"],
  [63, 70, "v0.9路线与实现"],
  [71, 87, "体验问题/发布追踪"],
  [88, 88, "Windows边界收敛"],
];

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};

const inputPath = readArg("--file") ?? process.env.MOYANG_SESSION_LOG;
const cutoffOrdinal = Number(readArg("--cutoff-ordinal", DEFAULT_CUTOFF));

if (!inputPath) {
  console.error("Usage: node scripts/ai-workflow-metrics.mjs --file <session.jsonl> [--cutoff-ordinal N]");
  process.exit(2);
}

const increment = (map, key, amount = 1) => map.set(key, (map.get(key) ?? 0) + amount);
const sortedObject = (map, limit = 30) =>
  Object.fromEntries([...map.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit));

function newUsage() {
  return { input: 0, cached: 0, output: 0, reasoning: 0, total: 0, requests: 0, toolCalls: 0 };
}

function newTask(index, timestamp = null, id = null) {
  return { index, start: timestamp, end: null, id, userText: "", usage: newUsage() };
}

function phaseForTask(index) {
  return phaseRanges.find(([from, to]) => index >= from && index <= to)?.[2] ?? "未归类";
}

function textFromContent(content) {
  const values = Array.isArray(content) ? content : [content];
  return values.map((value) => (typeof value === "string" ? value : (value?.text ?? ""))).join(" ");
}

function outputText(payload) {
  return Array.isArray(payload?.output)
    ? payload.output.map((item) => item?.text ?? "").join("\n")
    : String(payload?.output ?? "");
}

function usageFromPayload(payload) {
  const usage = payload?.info?.last_token_usage;
  if (!usage || typeof usage !== "object") return null;
  return {
    input: Number(usage.input_tokens ?? 0),
    cached: Number(usage.cached_input_tokens ?? 0),
    output: Number(usage.output_tokens ?? 0),
    reasoning: Number(usage.reasoning_output_tokens ?? 0),
    total: Number(usage.total_tokens ?? 0),
  };
}

function addUsage(target, value) {
  if (!value) return;
  for (const key of ["input", "cached", "output", "reasoning", "total"]) target[key] += value[key];
  target.requests += 1;
}

function addOperationMarkers(input, operations) {
  const patterns = [
    ["ci_run_query", /github_fetch_commit_workflow_runs|actions\/runs\?|workflow_runs/gi],
    ["ci_job_query", /github_fetch_workflow_run_jobs|workflow-jobs/gi],
    ["ci_wait", /tools\.wait\s*\(|wait_threads|Start-Sleep|run.*watch/gi],
    ["frontend_test", /npm test|vitest run/gi],
    ["lint", /npm run lint/gi],
    ["format_check", /npm run format:check|prettier --check/gi],
    ["build", /npm run build|vite build|cargo build/gi],
    ["browser_e2e", /test:e2e(?!:desktop)|playwright/gi],
    ["desktop_e2e", /test:e2e:desktop|desktop-e2e/gi],
    ["rust_test", /cargo test/gi],
    ["rust_quality", /cargo fmt|cargo clippy/gi],
    ["release_check", /release:check|test:release|release preflight/gi],
    ["package_or_installer", /tauri.*build|nsis|installer|setup\.exe|\.sig|latest\.json/gi],
    ["git_commit", /git commit/gi],
    ["git_push", /git push/gi],
    ["pr_create", /github_create_pull_request|pull request/gi],
    ["pr_merge", /github_merge_pull_request|merge pull request/gi],
    ["release_action", /github_create_release|create_release|github_upload_release|release upload/gi],
  ];
  for (const [name, pattern] of patterns) {
    const count = input.match(pattern)?.length ?? 0;
    if (count > 0) increment(operations, name, count);
  }
}

function addFailureMarkers(value, failures) {
  const text = String(value ?? "");
  const patterns = [
    ["usage_limit_exceeded", /usage_limit_exceeded/i],
    ["network reset", /recv failure|connection (?:was )?reset|socket hang up/i],
    ["permission/auth", /not accessible by integration|\b403\b|permission denied|unauthorized/i],
    ["merge/conflict", /GH006|merge conflict|not mergeable/i],
    ["timeout", /timeout|timed out/i],
    ["toolchain/not found", /tauri-driver not found|cargo install|not found/i],
    ["test/build", /exit code [1-9]|conclusion.*failure|tests? failed|build failed/i],
    ["generic error", /\berror\b|\bfailed\b/i],
  ];
  for (const [name, pattern] of patterns) {
    if (pattern.test(text)) increment(failures, name);
  }
}

const fileReadPatterns = [
  /Get-Content\b[^\n]*?-LiteralPath\s+["']([^"']+)["']/gi,
  /Get-Content\s+["']([^"']+)["']/gi,
  /fs\.readFileSync\(\s*["']([^"']+)["']/gi,
  /view_image\(\s*\{[^}]*?path:\s*["']([^"']+)["']/gi,
  /github_fetch_file\(\s*\{[^}]*?path:\s*["']([^"']+)["']/gi,
];

const records = new Map();
const payloadTypes = new Map();
const roles = new Map();
const nestedTools = new Map();
const directTools = new Map();
const fileReads = new Map();
const operations = new Map();
const failures = new Map();
const duplicateInputs = new Map();
const repeatedWorkflowRuns = new Map();
const repeatedCommitQueries = new Map();
const tasks = [];
const totals = newUsage();
const failureFlags = { nonzeroExit: 0, isError: 0, usageLimit: 0, turnAborted: 0, rerunJobs: 0 };
let currentTask = null;
let taskIndex = 0;
let linesRead = 0;
let processedLines = 0;
let parsed = 0;
let invalid = 0;
let outerToolCalls = 0;
let toolOutputs = 0;
let compactions = 0;
let turnContexts = 0;

for await (const line of readline.createInterface({
  input: fs.createReadStream(inputPath),
  crlfDelay: Infinity,
})) {
  linesRead += 1;
  if (!line.trim()) continue;

  let record;
  try {
    record = JSON.parse(line);
  } catch {
    invalid += 1;
    continue;
  }

  if (Number(record.ordinal) > cutoffOrdinal) break;

  parsed += 1;
  processedLines += 1;

  increment(records, record.type ?? "unknown");
  const payload = record.payload ?? {};
  increment(payloadTypes, payload.type ?? "none");
  if (payload.role) increment(roles, payload.role);
  if (record.type === "compacted") compactions += 1;
  if (record.type === "turn_context") turnContexts += 1;

  if (payload.type === "task_started") {
    currentTask = newTask(++taskIndex, record.timestamp, payload.turn_id ?? null);
    tasks.push(currentTask);
  }

  if (!currentTask) {
    currentTask = newTask(++taskIndex);
    tasks.push(currentTask);
  }

  if (payload.type === "task_complete") currentTask.end = record.timestamp;
  if (record.type === "response_item" && payload.type === "message" && payload.role === "user") {
    currentTask.userText += ` ${textFromContent(payload.content)}`;
  }

  if (payload.type === "token_count") {
    const usage = usageFromPayload(payload);
    addUsage(totals, usage);
    addUsage(currentTask.usage, usage);
  }

  if (payload.type === "custom_tool_call" || payload.type === "function_call") {
    outerToolCalls += 1;
    currentTask.usage.toolCalls += 1;
    const name = payload.name ?? payload.tool_name ?? payload.type;
    const input = String(payload.input ?? payload.arguments ?? "");
    increment(duplicateInputs, `${name}|${input.replace(/\s+/g, " ").trim()}`);

    const toolNames = [...input.matchAll(/tools\.([A-Za-z0-9_]+)\s*\(/g)].map((match) => match[1]);
    for (const toolName of toolNames) {
      increment(nestedTools, toolName);
      if (toolName !== "exec") increment(directTools, toolName);
      if (toolName === "mcp__codex_apps__github_fetch_workflow_run_jobs") {
        const runId = input.match(/run_id\s*:\s*(\d+)/)?.[1];
        if (runId) increment(repeatedWorkflowRuns, runId);
      }
      if (toolName === "mcp__codex_apps__github_fetch_commit_workflow_runs") {
        const sha = input.match(/commit_sha\s*:\s*["']([0-9a-f]{7,40})/i)?.[1];
        if (sha) increment(repeatedCommitQueries, sha);
      }
      if (toolName === "mcp__codex_apps__github_rerun_workflow_job") failureFlags.rerunJobs += 1;
    }

    for (const pattern of fileReadPatterns) {
      for (const match of input.matchAll(pattern)) increment(fileReads, match[1]);
    }
    addOperationMarkers(input, operations);
    addFailureMarkers(input, failures);
  }

  if (payload.type === "custom_tool_call_output" || payload.type === "function_call_output") {
    toolOutputs += 1;
    const output = outputText(payload);
    const exitCodes = output.match(/"exit_code"\s*:\s*(-?\d+)/g) ?? [];
    for (const exitCode of exitCodes) {
      if (Number(exitCode.match(/-?\d+/)?.[0] ?? 0) !== 0) failureFlags.nonzeroExit += 1;
    }
    if (/isError\s*["']?\s*:\s*true/i.test(output)) failureFlags.isError += 1;
    if (/usage_limit_exceeded/i.test(output)) failureFlags.usageLimit += 1;
    addFailureMarkers(output, failures);
  }

  if (record.type === "event_msg" && payload.type === "turn_aborted") failureFlags.turnAborted += 1;
}

const phase = new Map();
for (const task of tasks) {
  const name = phaseForTask(task.index);
  const summary = phase.get(name) ?? {
    tasks: 0,
    input: 0,
    cached: 0,
    output: 0,
    reasoning: 0,
    total: 0,
    requests: 0,
    toolCalls: 0,
  };
  summary.tasks += 1;
  for (const key of ["input", "cached", "output", "reasoning", "total", "requests", "toolCalls"]) {
    summary[key] += task.usage[key];
  }
  phase.set(name, summary);
}

totals.cacheRatio = totals.cached / Math.max(1, totals.input);
totals.averageInputPerRequest = totals.input / Math.max(1, totals.requests);
totals.averageTotalPerRequest = totals.total / Math.max(1, totals.requests);
totals.toolCalls = outerToolCalls;

const completedDurations = tasks
  .map((task) => {
    if (!task.start || !task.end) return null;
    const durationMs = Date.parse(task.end) - Date.parse(task.start);
    return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
  })
  .filter((durationMs) => durationMs !== null)
  .sort((left, right) => left - right);
const percentile = (values, fraction) =>
  values.length === 0 ? null : values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];

const repeatedInputs = [...duplicateInputs.entries()]
  .filter(([, count]) => count > 1)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 20)
  .map(([key, count]) => ({ count, name: key.split("|", 1)[0], input: key.slice(key.indexOf("|") + 1, 360) }));

console.log(
  JSON.stringify(
    {
      inputPath,
      cutoffOrdinal: Number.isFinite(cutoffOrdinal) ? cutoffOrdinal : null,
      lines: processedLines,
      linesRead,
      parsed,
      invalid,
      tasks: tasks.length,
      compactions,
      turnContexts,
      records: Object.fromEntries(records),
      payloadTypes: sortedObject(payloadTypes),
      roles: Object.fromEntries(roles),
      tokenUsage: totals,
      outerToolCalls,
      toolOutputs,
      nestedTools: sortedObject(nestedTools, 40),
      directTools: sortedObject(directTools, 20),
      operationMarkers: sortedObject(operations, 40),
      failureMarkers: sortedObject(failures, 30),
      failureFlags,
      distinctToolInputs: duplicateInputs.size,
      repeatedToolInputs: repeatedInputs,
      fileReads: { distinct: fileReads.size, top: sortedObject(fileReads, 30) },
      repeatedWorkflowRuns: [...repeatedWorkflowRuns.entries()]
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20),
      repeatedCommitQueries: [...repeatedCommitQueries.entries()]
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 15),
      taskDurationMs: {
        completed: completedDurations.length,
        total: completedDurations.reduce((sum, durationMs) => sum + durationMs, 0),
        average: completedDurations.length
          ? completedDurations.reduce((sum, durationMs) => sum + durationMs, 0) / completedDurations.length
          : null,
        p50: percentile(completedDurations, 0.5),
        p95: percentile(completedDurations, 0.95),
      },
      phase: Object.fromEntries(phase),
    },
    null,
    2,
  ),
);
