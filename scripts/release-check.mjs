import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function normalizeVersion(value) {
  return typeof value === "string" ? value.trim().replace(/^v/i, "") : "";
}

export function isSemver(value) {
  return (
    typeof value === "string" &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(normalizeVersion(value))
  );
}

export function validateExpectedVersion(expectedVersion, projectVersion) {
  if (!isSemver(expectedVersion)) {
    return ["发布版本不是有效的 SemVer。"];
  }
  if (normalizeVersion(expectedVersion) !== normalizeVersion(projectVersion)) {
    return ["发布版本必须与项目当前版本一致。"];
  }
  return [];
}

export function validatePublicDocumentation(projectRoot = defaultRoot) {
  const errors = [];
  const updateDocPath = path.join(projectRoot, "docs", "UPDATE.md");
  const contents = fs.readFileSync(updateDocPath, "utf8");

  if (
    /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s]+[\\/]/i.test(contents) ||
    /(?:^|[\s`"'(])\/(?:Users|home)\/[^\s`"')]+/i.test(contents)
  ) {
    errors.push("docs/UPDATE.md 不得包含本机用户绝对路径。");
  }
  if (/TAURI_SIGNING_PRIVATE_KEY_PASSWORD\s*=\s*(?:["']{2}|`{2})/i.test(contents)) {
    errors.push("docs/UPDATE.md 不得示例化空的签名私钥密码。");
  }
  if (/(?:当前|目前).{0,12}(?:未设置密码|无密码)/i.test(contents)) {
    errors.push("docs/UPDATE.md 不得披露或鼓励使用无密码签名密钥。");
  }

  return errors;
}

export function validateManifest(manifest, expectedVersion = null) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["latest.json 必须是 JSON 对象。"];
  }

  if (!isSemver(manifest.version)) {
    errors.push("latest.json.version 不是有效的 SemVer。");
  } else if (expectedVersion && normalizeVersion(manifest.version) !== normalizeVersion(expectedVersion)) {
    errors.push("latest.json.version 与项目版本不一致。");
  }

  const platforms = manifest.platforms;
  if (!platforms || typeof platforms !== "object" || Array.isArray(platforms)) {
    errors.push("latest.json.platforms 缺失。");
    return errors;
  }

  if (!platforms["windows-x86_64"] || typeof platforms["windows-x86_64"] !== "object") {
    errors.push("latest.json 缺少 windows-x86_64 平台。");
  }

  for (const [platformName, platform] of Object.entries(platforms)) {
    if (!platform || typeof platform !== "object" || Array.isArray(platform)) {
      errors.push(`${platformName} 平台配置缺失或格式错误。`);
      continue;
    }
    if (typeof platform.url !== "string" || !/^https:\/\//i.test(platform.url)) {
      errors.push(`${platformName}.url 必须是 HTTPS 地址。`);
    }
    if (typeof platform.signature !== "string" || platform.signature.trim().length < 20) {
      errors.push(`${platformName}.signature 缺失或过短。`);
    }
  }

  return errors;
}

export function validateReleaseWorkflow(projectRoot = defaultRoot) {
  const errors = [];
  const releasePath = path.join(projectRoot, ".github", "workflows", "release.yml");
  const mirrorPath = path.join(projectRoot, ".github", "workflows", "mirror-release.yml");
  const healthPath = path.join(projectRoot, ".github", "workflows", "mirror-health.yml");
  const release = fs.readFileSync(releasePath, "utf8");
  const mirror = fs.readFileSync(mirrorPath, "utf8");
  const health = fs.existsSync(healthPath) ? fs.readFileSync(healthPath, "utf8") : "";

  if (!/workflow_dispatch:\s*\n\s+inputs:\s*\n\s+version:/m.test(release)) {
    errors.push("release.yml 必须为手动发布提供 version 输入。");
  }
  if (!/INPUT_VERSION/.test(release) || !/EVENT_NAME\s*-eq\s*"workflow_dispatch"/.test(release)) {
    errors.push("release.yml 必须根据 workflow_dispatch 输入解析发布版本，不能把分支名当作版本标签。");
  }
  for (const field of ["uploadUpdaterJson: true", "uploadUpdaterSignatures: true", "updaterJsonPreferNsis: true"]) {
    if (!release.includes(field)) errors.push(`release.yml 缺少 ${field}。`);
  }
  if (!mirror.includes("release:") || !mirror.includes("types: [published]")) {
    errors.push("mirror-release.yml 必须在 Release 发布后触发。");
  }
  if (mirror.includes("workflow_run:")) {
    errors.push("mirror-release.yml 不应同时使用 workflow_run 自动触发，避免同一 Release 重复部署。");
  }
  if (!mirror.includes("scripts/prepare-mirror.mjs")) {
    errors.push("mirror-release.yml 必须运行镜像清单自检脚本。");
  }
  if (!mirror.includes("Require Cloudflare credentials") || !mirror.includes("正式 Release 不允许跳过镜像上传")) {
    errors.push("mirror-release.yml 必须要求 Cloudflare 凭据，不能把未上传的镜像标记为成功。");
  }
  if (mirror.includes("CLOUDFLARE_DEPLOY_ENABLED=false")) {
    errors.push("mirror-release.yml 不得在正式发布中静默跳过 Cloudflare 资产上传。");
  }
  if (!mirror.includes("cloudflare/wrangler-action@") || !mirror.includes("pages deploy")) {
    errors.push("mirror-release.yml 必须通过 Wrangler 部署静态 Cloudflare Pages 镜像。");
  }
  if (!mirror.includes("Start-Sleep") || !mirror.includes("Cache-Control")) {
    errors.push("mirror-release.yml 必须对镜像传播和临时 HTTP 错误进行重试验证。");
  }
  if (!health.includes("schedule:") || !health.includes("workflow_dispatch:") || !health.includes("latest.json")) {
    errors.push("mirror-health.yml 必须提供定时和手动镜像健康检查。");
  }
  if (!fs.existsSync(path.join(projectRoot, "scripts", "mirror-worker.js"))) {
    errors.push("缺少 scripts/mirror-worker.js 镜像代理源文件。");
  }
  return errors;
}

export function validateProject(projectRoot = defaultRoot) {
  const errors = [];
  const packageJson = readJson(path.join(projectRoot, "package.json"));
  const tauriConfig = readJson(path.join(projectRoot, "src-tauri", "tauri.conf.json"));
  const releaseConfig = readJson(path.join(projectRoot, "src-tauri", "tauri.release.conf.json"));
  const cargoText = fs.readFileSync(path.join(projectRoot, "src-tauri", "Cargo.toml"), "utf8");
  errors.push(...validatePublicDocumentation(projectRoot));
  const cargoVersion = cargoText.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? "";

  const versions = [
    ["package.json", packageJson.version],
    ["src-tauri/Cargo.toml", cargoVersion],
    ["src-tauri/tauri.conf.json", tauriConfig.version],
  ];
  const normalizedVersions = versions.map((entry) => normalizeVersion(entry[1]));
  if (normalizedVersions.some((version) => !version)) {
    errors.push("package.json、Cargo.toml 和 tauri.conf.json 都必须声明版本。");
  } else if (new Set(normalizedVersions).size !== 1) {
    errors.push("package.json、Cargo.toml 和 tauri.conf.json 的版本不一致。");
  }

  const updater = tauriConfig.plugins?.updater;
  if (!updater || typeof updater !== "object") {
    errors.push("tauri.conf.json 缺少 updater 配置。");
  } else {
    if (typeof updater.pubkey !== "string" || updater.pubkey.trim().length < 40 || /private/i.test(updater.pubkey)) {
      errors.push("updater.pubkey 缺失或不是公开公钥内容。");
    }
    if (!Array.isArray(updater.endpoints) || updater.endpoints.length < 2) {
      errors.push("updater.endpoints 至少需要镜像和 GitHub 两个地址。");
    } else if (updater.endpoints.some((endpoint) => typeof endpoint !== "string" || !/^https:\/\//i.test(endpoint))) {
      errors.push("updater.endpoints 必须全部使用 HTTPS。");
    } else {
      if (!updater.endpoints.some((endpoint) => endpoint.includes("moyang-reader-mirror.pages.dev/latest.json"))) {
        errors.push("updater.endpoints 缺少 Cloudflare Pages 镜像地址。");
      }
      if (
        !updater.endpoints.some((endpoint) =>
          endpoint.includes("github.com/MY-moss/moyang_Reader/releases/latest/download/latest.json"),
        )
      ) {
        errors.push("updater.endpoints 缺少 GitHub Release 回退地址。");
      }
    }
  }

  if (releaseConfig.bundle?.createUpdaterArtifacts !== true) {
    errors.push("tauri.release.conf.json 必须启用 createUpdaterArtifacts: true。");
  }

  errors.push(...validateReleaseWorkflow(projectRoot));

  return {
    version: normalizeVersion(packageJson.version),
    errors,
  };
}

export function runReleaseCheck(args = [], projectRoot = defaultRoot) {
  const project = validateProject(projectRoot);
  const errors = [...project.errors];
  const manifestFlag = args.find((arg) => arg.startsWith("--manifest="));
  const versionFlag = args.find((arg) => arg.startsWith("--version="));

  if (versionFlag) {
    errors.push(...validateExpectedVersion(versionFlag.slice("--version=".length), project.version));
  }

  if (manifestFlag) {
    const manifestPath = path.resolve(projectRoot, manifestFlag.slice("--manifest=".length));
    try {
      const manifest = readJson(manifestPath);
      errors.push(...validateManifest(manifest, project.version));
    } catch (cause) {
      errors.push("无法读取 latest.json：" + (cause instanceof Error ? cause.message : String(cause)));
    }
  }

  if (errors.length > 0) {
    console.error("Release preflight failed:");
    errors.forEach((error) => console.error("- " + error));
    return 1;
  }

  console.log(
    "Release preflight passed for v" + project.version + (manifestFlag ? " and latest.json" : " configuration"),
  );
  return 0;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) {
  process.exitCode = runReleaseCheck(process.argv.slice(2));
}
