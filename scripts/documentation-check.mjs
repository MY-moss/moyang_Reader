import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const documentationFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "PRIVACY.md",
  "docs/UPDATE.md",
  "docs/RELEASE-POLICY.md",
  "docs/USER-GUIDE.md",
  "docs/UI-INTERACTION.md",
  "docs/ROADMAP.md",
  "docs/FUTURE-DEVELOPMENT-PLAN.md",
  "docs/AI-TASKS.md",
  "docs/AI-HANDOFF.md",
  "docs/AI-WORKFLOW.md",
  "docs/AI-TAKEOVER-PROMPT.md",
  "docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md",
  "docs/DEVELOPMENT-SETUP.md",
];

const requiredFragments = new Map([
  [
    "README.md",
    [
      "当前稳定版本：`v0.11.0`",
      "当前开发阶段是 v1.0 Freeze / 接手收口",
      "下载完成停在“已更新”",
      "GitHub Release",
      "Cloudflare Pages",
      "手动重启",
      "SECURITY.md",
      "v0.13 Freeze / Compatibility / RC",
      "v1.3 AI",
      "docs/DEVELOPMENT-SETUP.md",
      "npm ci",
    ],
  ],
  [
    "CONTRIBUTING.md",
    ["SECURITY.md", "不要在公开 Issue", "BLOCKED_EXTERNAL", "Dependabot", "docs/DEVELOPMENT-SETUP.md", "npm ci"],
  ],
  [
    "SECURITY.md",
    [
      "Private Vulnerability Reporting",
      "v0.11.0",
      "BLOCKED_EXTERNAL",
      "7 个自然日",
      "14 个自然日",
      "GitHub Release 的 `latest.json`",
      "SHA-256",
      "Cloudflare Pages",
      "Authenticode",
    ],
  ],
  ["PRIVACY.md", ["Cloudflare Pages 镜像", "GitHub Releases", "mailto", "不支持的协议会被拦截"]],
  [
    "docs/UPDATE.md",
    [
      "更多 → 更新",
      "moyang-reader-mirror.pages.dev/latest.json",
      "releases/latest/download/latest.json",
      "v0.11.0",
      "手动重启",
      "javascript:",
      "Authenticode",
      "release-status.json",
    ],
  ],
  ["docs/RELEASE-POLICY.md", ["Tauri updater 的 `.sig`", "NSIS Authenticode", "静态镜像工作流", "blocked"]],
  ["docs/USER-GUIDE.md", ["更多 → 更新", "手动重启", "javascript:", "文件关联", "权限"]],
  ["docs/UI-INTERACTION.md", ["更新入口固定在“更多”操作栏", "javascript:", "文件关联"]],
  [
    "docs/ROADMAP.md",
    [
      "v0.13",
      "Freeze / Compatibility / RC",
      "v1.1",
      "v1.3",
      "不为未来先造空接口",
      "D00 v1.0 truth-source / onboarding freeze",
      "D02 development doctor DONE",
      "D03 standard developer verification path DONE",
      "D04 v1.0 Freeze execution contract DONE",
      "D05 architecture complexity budget DONE",
      "D06 App.tsx document-search orchestration DONE",
      "D07 App.tsx reading-position orchestration DONE",
      "D08 App.tsx reading-rail orchestration DONE",
      "D09 App.tsx update orchestration DONE",
      "D10 App.tsx annotation orchestration DONE",
      "D11 App.tsx settings orchestration DONE",
      "D12 App.tsx command orchestration DONE",
    ],
  ],
  [
    "docs/AI-TASKS.md",
    [
      "# Moyang Reader — AI 任务队列",
      "## v1.0 Freeze / 接手收口（当前阶段）",
      "D00",
      "D01",
      "D02",
      "DONE — PR #509",
      "D03",
      "DONE — PR #511",
      "冻结契约：当前唯一可执行范围是本节的 `D00–Dxx` 任务；v1.x 候选、Future Issues 和 Future Development Plan 中的条目全部保持 `GATED`",
      "D04",
      "DONE — PR #513",
      "D05",
      "DONE — PR #515",
      "D06",
      "DONE — PR #517",
      "文内查找编排提取",
      "D07",
      "DONE — PR #519",
      "阅读位置恢复与保存编排提取",
      "reading-position-controller",
      "D08",
      "DONE — PR #521",
      "阅读进度栏与标题观察编排提取",
      "reading-rail-controller",
      "D09",
      "DONE — PR #523",
      "更新生命周期编排提取",
      "update-controller",
      "D10",
      "DONE — PR #525",
      "批注高亮生命周期编排提取",
      "annotation-controller",
      "D11",
      "DONE — PR #527",
      "设置与偏好生命周期编排提取",
      "settings-lifecycle",
      "D12",
      "DONE — PR #529",
      "命令编排提取",
      "reader-command-controller",
      "architecture-budget.json",
      "check:architecture",
      "Dependabot",
      "BLOCKED_EXTERNAL",
      "A13",
      "v0.13",
      "v1.0",
    ],
  ],
  [
    "docs/AI-HANDOFF.md",
    [
      "# Moyang Reader 当前交接摘要",
      "当前稳定版本：`v0.11.0`",
      "当前最早动作是重新核对最新 `main`、预算变化和稳定职责边界，再定义 `D13`",
      "Dependabot",
      "BLOCKED_EXTERNAL",
      "GitHub Release",
      "v1.x GATED",
    ],
  ],
  ["docs/FUTURE-DEVELOPMENT-PLAN.md", ["当前状态：`GATED`", "不是当前开发许可"]],
  [
    "docs/AI-WORKFLOW.md",
    [
      "Dependabot",
      "BLOCKED_EXTERNAL",
      "v0.13",
      "Freeze / Compatibility / RC",
      "v1.3",
      "真实用户动作",
      "v1.0 Freeze 执行契约",
      "当前唯一可执行范围是 `docs/AI-TASKS.md` 的 `D00–Dxx`",
    ],
  ],
  [
    "docs/AI-TAKEOVER-PROMPT.md",
    [
      "Dependabot",
      "BLOCKED_EXTERNAL",
      "v0.13 Freeze/Compatibility/RC",
      "v1.3 AI",
      "provider/mock-first",
      "docs/DEVELOPMENT-SETUP.md",
    ],
  ],
  [
    "docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md",
    [
      "真实内置用户动作",
      "B04",
      "v0.13",
      "v1.3",
      "provider-first",
      "SECURITY.md",
      "architecture-budget.json",
      "check:architecture",
      "超出增量预算",
    ],
  ],
  [
    "docs/DEVELOPMENT-SETUP.md",
    [
      "# Windows 开发环境",
      "Node.js 22",
      "Rust 1.88",
      "Microsoft C++ Build Tools",
      "WebView2",
      "npm ci",
      "npm run doctor",
      "npm run verify:dev",
      "npm run agent:bootstrap",
      "npm run desktop",
      "npm run test:e2e:desktop",
      "WORKSPACE-CLEANUP.md",
    ],
  ],
]);

const staleClaims = [
  ["README.md", /签名更新包安装后自动重启/],
  ["README.md", /镜像不可用时回退 GitHub Release/],
  ["README.md", /v0\.13[–-]v0\.14[^\n]*轻量知识库/],
  ["README.md", /当前稳定版本：`v0\.10\.14`/],
  ["README.md", /\*\*v0\.10\.14\*\*：当前稳定 Windows x64 版本/],
  ["README.md", /^npm install\s*$/m],
  ["CONTRIBUTING.md", /^npm install\s*$/m],
  ["docs/ROADMAP.md", /正式 Release 仍是 0\.10\.x/],
  ["docs/ROADMAP.md", /下一项是 C02/],
  ["docs/AI-HANDOFF.md", /当前最早可执行任务是 `C04`/],
  ["docs/REQUIREMENTS.md", /批准队列与运行状态分别以/],
  ["docs/USER-GUIDE.md", /校验通过后自动重启/],
  ["docs/UPDATE.md", /(?:本次|当前) `?v0\.10\.2`? (?:发布后|的静态)/],
  ["docs/AI-WORKFLOW.md", /v0\.14[^\n]*AiProvider/],
  ["docs/AI-WORKFLOW.md", /v1\.0 前先稳定内部能力接口/],
  ["docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md", /未来方向（D01）/],
  ["docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md", /D02 才稳定/],
  ["docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md", /D03 mock/],
  ["docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md", /v0\.14[^\n]*AiProvider/],
];

const updaterAuthorityClaims = [
  ["docs/RELEASE-POLICY.md", /更新端点按配置顺序先尝试公开 Cloudflare Pages 动态镜像，再回退到 GitHub Release/],
  ["docs/USER-GUIDE.md", /更新器先尝试公开 Cloudflare Pages 镜像，镜像不可用时回退 GitHub Release/],
];

export function validateUpdaterAuthorityClaims(documents) {
  const errors = [];
  for (const [relativePath, pattern] of updaterAuthorityClaims) {
    if (pattern.test(documents.get(relativePath) ?? "")) {
      errors.push(`${relativePath} 仍把 Cloudflare 镜像写成 GitHub Release 之前的更新源：${pattern}`);
    }
  }
  return errors;
}

function readText(projectRoot, relativePath, errors) {
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  } catch (cause) {
    errors.push(`${relativePath} 无法读取：${cause instanceof Error ? cause.message : String(cause)}`);
    return "";
  }
}

function markdownLinkTargets(text) {
  const targets = [];
  const pattern = /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    targets.push(raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw);
  }
  return targets;
}

function isExternalLink(target) {
  return /^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(target);
}

function validateMarkdownLinks(projectRoot, relativePath, text, errors) {
  const documentPath = path.join(projectRoot, relativePath);
  for (const target of markdownLinkTargets(text)) {
    if (!target || target.startsWith("#") || isExternalLink(target)) continue;

    const withoutFragment = target.split(/[?#]/, 1)[0];
    if (!withoutFragment) continue;

    let decodedTarget;
    try {
      decodedTarget = decodeURIComponent(withoutFragment);
    } catch {
      errors.push(`${relativePath} 的链接目标无法解码：${target}`);
      continue;
    }

    const targetPath = path.resolve(path.dirname(documentPath), decodedTarget);
    if (!fs.existsSync(targetPath)) {
      errors.push(`${relativePath} 的链接目标不存在：${target}`);
    }
  }
}

export function validateDocumentation(projectRoot = defaultRoot) {
  const errors = [];
  const documents = new Map();

  for (const relativePath of documentationFiles) {
    const text = readText(projectRoot, relativePath, errors);
    documents.set(relativePath, text);
    validateMarkdownLinks(projectRoot, relativePath, text, errors);
  }

  for (const [relativePath, fragments] of requiredFragments) {
    const text = documents.get(relativePath) ?? "";
    for (const fragment of fragments) {
      if (!text.includes(fragment)) {
        errors.push(`${relativePath} 缺少一致性说明：${fragment}`);
      }
    }
  }

  for (const [relativePath, pattern] of staleClaims) {
    if (pattern.test(documents.get(relativePath) ?? "")) {
      errors.push(`${relativePath} 仍包含过时的路线/更新行为说明：${pattern}`);
    }
  }

  errors.push(...validateUpdaterAuthorityClaims(documents));

  const roadmap = documents.get("docs/ROADMAP.md") ?? "";
  if (!roadmap.includes("A07–A13 完成")) {
    errors.push("docs/ROADMAP.md 的 v0.11 Exit Gate 必须覆盖 A07–A13，不能漏掉 RC/发布预检 A13。");
  }

  const statusText = readText(projectRoot, "docs/release-status.json", errors);
  try {
    const status = JSON.parse(statusText);
    if (
      status.mirror?.staticWorkflow?.status === "blocked" &&
      !documents.get("docs/RELEASE-POLICY.md")?.includes("blocked")
    ) {
      errors.push("静态镜像状态为 blocked 时，发布政策必须保留阻塞语义。");
    }
    if (
      status.externalChecks?.authenticode?.status === "blocked" &&
      !documents.get("docs/RELEASE-POLICY.md")?.includes("Authenticode")
    ) {
      errors.push("Authenticode 状态为 blocked 时，发布政策必须保留证书边界。");
    }
  } catch (cause) {
    errors.push(`docs/release-status.json 不是有效 JSON：${cause instanceof Error ? cause.message : String(cause)}`);
  }

  return errors;
}

export function runDocumentationCheck(projectRoot = defaultRoot) {
  const errors = validateDocumentation(projectRoot);
  if (errors.length > 0) {
    console.error("Documentation check failed:");
    errors.forEach((error) => console.error("- " + error));
    return 1;
  }
  console.log(
    "Documentation check passed: links, security guidance, updater authority and roadmap gates are consistent.",
  );
  return 0;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) {
  process.exitCode = runDocumentationCheck();
}
