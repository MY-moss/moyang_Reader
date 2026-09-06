import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepositoryRoot } from "./repository-root.mjs";

const gitCommand = process.platform === "win32" ? "git.exe" : "git";

function runGit(root, args) {
  try {
    return {
      ok: true,
      value: execFileSync(gitCommand, args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
    return {
      ok: false,
      value: "",
      error: stderr || error?.message || "git command failed",
    };
  }
}

export function parseGitHubRepositoryUrl(remoteUrl) {
  if (!remoteUrl) return null;
  const trimmed = remoteUrl.trim().replace(/\.git$/i, "");
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;
  const sshMatch = trimmed.match(/^(?:ssh:\/\/git@github\.com\/|git@github\.com:)([^/]+)\/([^/]+)$/i);
  return sshMatch ? `${sshMatch[1]}/${sshMatch[2]}` : null;
}

export function findFirstActiveTask(taskMarkdown) {
  const sections = taskMarkdown.split(/^###\s+/m).slice(1);
  for (const section of sections) {
    const [heading = ""] = section.split("\n", 1);
    const statusMatch = section.match(/\*\*状态：([^*]+)\*\*/);
    if (!statusMatch) continue;
    const status = statusMatch[1].trim();
    if (status.startsWith("DONE") || status.startsWith("CANCELLED")) continue;
    const taskMatch = heading.match(/^([A-Z]\d{2})\s*[—-]\s*(.+)$/);
    return {
      id: taskMatch?.[1] ?? "UNKNOWN",
      title: taskMatch?.[2]?.trim() ?? heading.trim(),
      status,
    };
  }
  return null;
}

function parseAheadBehind(value) {
  const [behindText = "0", aheadText = "0"] = value.trim().split(/\s+/);
  return {
    behind: Number.parseInt(behindText, 10) || 0,
    ahead: Number.parseInt(aheadText, 10) || 0,
  };
}

async function fetchJson(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "moyang-reader-agent-bootstrap",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function summarizeWorktrees(raw) {
  if (!raw.trim()) return [];
  const result = [];
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) result.push(current);
      current = { path: line.slice(9), branch: "detached" };
    } else if (current && line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }
  if (current) result.push(current);
  return result;
}

function formatList(items, emptyText) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${emptyText}`;
}

export async function buildAgentContext(projectRoot = process.cwd()) {
  const root = resolveRepositoryRoot(path.resolve(projectRoot));
  const status = runGit(root, ["status", "--short", "--branch"]);
  const branch = runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = runGit(root, ["rev-parse", "HEAD"]);
  const remoteUrl = runGit(root, ["remote", "get-url", "origin"]);
  const repoFullName = remoteUrl.ok ? parseGitHubRepositoryUrl(remoteUrl.value) : null;

  const fetchResult = runGit(root, ["fetch", "origin", "--prune"]);
  const originMain = runGit(root, ["rev-parse", "origin/main"]);
  const aheadBehind = originMain.ok
    ? runGit(root, ["rev-list", "--left-right", "--count", "origin/main...HEAD"])
    : { ok: false, value: "" };
  const divergence = aheadBehind.ok ? parseAheadBehind(aheadBehind.value) : { behind: 0, ahead: 0 };
  const worktrees = summarizeWorktrees(runGit(root, ["worktree", "list", "--porcelain"]).value);

  let remoteStatus = fetchResult.ok && repoFullName ? "OK" : "UNKNOWN";
  let openPrs = [];
  let openIssues = [];
  if (remoteStatus === "OK") {
    try {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
      const [prs, issues] = await Promise.all([
        fetchJson(`https://api.github.com/repos/${repoFullName}/pulls?state=open&per_page=30`, token),
        fetchJson(`https://api.github.com/repos/${repoFullName}/issues?state=open&per_page=30`, token),
      ]);
      openPrs = prs.map(
        (pr) =>
          `#${pr.number} ${pr.title} [${pr.head?.ref ?? "?"} → ${pr.base?.ref ?? "?"}]${pr.draft ? " DRAFT" : ""}`,
      );
      openIssues = issues
        .filter((issue) => !issue.pull_request)
        .slice(0, 20)
        .map((issue) => `#${issue.number} ${issue.title}`);
    } catch {
      remoteStatus = "UNKNOWN";
      openPrs = [];
      openIssues = [];
    }
  }

  const taskPath = path.join(root, "docs", "AI-TASKS.md");
  const taskMarkdown = fs.existsSync(taskPath) ? fs.readFileSync(taskPath, "utf8") : "";
  const activeTask = findFirstActiveTask(taskMarkdown);
  const workingTreeDirty =
    status.ok && status.value.split(/\r?\n/).slice(1).some((line) => line.trim().length > 0);
  const onLatestMain =
    branch.ok &&
    branch.value === "main" &&
    head.ok &&
    originMain.ok &&
    head.value === originMain.value &&
    divergence.ahead === 0 &&
    divergence.behind === 0;

  const canStartNewTask =
    remoteStatus === "OK" &&
    fetchResult.ok &&
    onLatestMain &&
    openPrs.length === 0 &&
    !workingTreeDirty &&
    activeTask?.status === "TODO";

  const reasons = [];
  if (remoteStatus !== "OK") reasons.push("remote/GitHub 状态无法确认");
  if (!onLatestMain) reasons.push("当前不在与 origin/main 完全一致的 clean main 起点");
  if (openPrs.length > 0) reasons.push("存在 Open PR，必须先处理它");
  if (workingTreeDirty) reasons.push("当前 worktree 有未提交改动");
  if (activeTask && activeTask.status !== "TODO") reasons.push(`最早任务状态为 ${activeTask.status}`);

  const generatedAt = new Date().toISOString();
  const context =
    `# Moyang Reader Local Agent Context\n\n` +
    `Generated: ${generatedAt}\n\n` +
    `> 这是本机缓存，不是项目状态机。GitHub / origin/main 和受版本控制文档优先。不要提交 .codex-cache。\n\n` +
    `## Repository\n\n` +
    `- repo: ${repoFullName ?? "UNKNOWN"}\n` +
    `- branch: ${branch.ok ? branch.value : "UNKNOWN"}\n` +
    `- HEAD: ${head.ok ? head.value : "UNKNOWN"}\n` +
    `- origin/main: ${originMain.ok ? originMain.value : "UNKNOWN"}\n` +
    `- ahead: ${divergence.ahead}\n` +
    `- behind: ${divergence.behind}\n` +
    `- REMOTE_STATUS: ${remoteStatus}\n` +
    `- NEW_TASK_ALLOWED: ${canStartNewTask ? "YES" : "NO"}\n\n` +
    `## Working tree\n\n` +
    `\`\`\`text\n${status.ok ? status.value : status.error ?? "UNKNOWN"}\n\`\`\`\n\n` +
    `## First unfinished AI task\n\n` +
    (activeTask
      ? `- ${activeTask.id} — ${activeTask.title}\n- status: ${activeTask.status}\n`
      : `- none detected\n`) +
    `\n## Open PRs\n\n${remoteStatus === "OK" ? formatList(openPrs, "none") : "- UNKNOWN — do not assume none"}\n` +
    `\n## Open Issues (first 20)\n\n${remoteStatus === "OK" ? formatList(openIssues, "none") : "- UNKNOWN"}\n` +
    `\n## Local worktrees\n\n${formatList(
      worktrees.map((item) => `${item.branch}: ${item.path}`),
      "none",
    )}\n` +
    `\n## Start decision\n\n` +
    (canStartNewTask
      ? `可以从最新 origin/main 开始“最早 TODO”这一项；仍需先阅读 AGENTS.md 和架构契约。\n`
      : `不要开始新的任务。${reasons.length ? `原因：${reasons.join("；")}。` : "先确认阻塞状态。"}\n`) +
    `\n如果已经在一个现有任务分支上工作，REMOTE_STATUS=UNKNOWN 时只允许继续该任务，不允许开启后续任务。\n`;

  return { root, context, remoteStatus, canStartNewTask, activeTask };
}

async function main() {
  const result = await buildAgentContext(process.cwd());
  const cacheDir = path.join(result.root, ".codex-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const contextPath = path.join(cacheDir, "agent-context.md");
  fs.writeFileSync(contextPath, result.context, "utf8");
  process.stdout.write(`${result.context}\nLocal context written to ${contextPath}\n`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(`agent bootstrap failed: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
