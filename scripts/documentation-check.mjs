import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateAiProcess } from "./ai-process-check.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const documentationFiles = [
  "README.md",
  "PRIVACY.md",
  "docs/UPDATE.md",
  "docs/RELEASE-POLICY.md",
  "docs/USER-GUIDE.md",
  "docs/UI-INTERACTION.md",
];

const requiredFragments = new Map([
  ["README.md", ["下载完成停在“已更新”", "GitHub Release", "手动重启"]],
  ["PRIVACY.md", ["Cloudflare Pages 镜像", "GitHub Releases", "mailto", "不支持的协议会被拦截"]],
  [
    "docs/UPDATE.md",
    [
      "更多 → 更新",
      "moyang-reader-mirror.pages.dev/latest.json",
      "releases/latest/download/latest.json",
      "手动重启",
      "javascript:",
      "Authenticode",
      "release-status.json",
    ],
  ],
  ["docs/RELEASE-POLICY.md", ["Tauri updater 的 `.sig`", "NSIS Authenticode", "静态镜像工作流", "blocked"]],
  ["docs/USER-GUIDE.md", ["更多 → 更新", "手动重启", "javascript:", "文件关联", "权限"]],
  ["docs/UI-INTERACTION.md", ["更新入口固定在“更多”操作栏", "javascript:", "文件关联"]],
]);

const staleClaims = [
  ["README.md", /签名更新包安装后自动重启/],
  ["docs/USER-GUIDE.md", /校验通过后自动重启/],
  ["docs/UPDATE.md", /(?:本次|当前) `?v0\.10\.2`? (?:发布后|的静态)/],
];

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
      errors.push(`${relativePath} 仍包含过时的更新行为说明：${pattern}`);
    }
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

  errors.push(...validateAiProcess(projectRoot));
  return errors;
}

export function runDocumentationCheck(projectRoot = defaultRoot) {
  const errors = validateDocumentation(projectRoot);
  if (errors.length > 0) {
    console.error("Documentation check failed:");
    errors.forEach((error) => console.error("- " + error));
    return 1;
  }
  console.log("Documentation check passed: links, update/opener guidance and AI handoff rules are consistent.");
  return 0;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) {
  process.exitCode = runDocumentationCheck();
}
