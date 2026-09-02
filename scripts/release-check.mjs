import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Pin the confirmed logo set so an old generated icon cannot silently return in a release.
const windowsIconAssets = [
  {
    path: "icons/icon.ico",
    format: "ico",
    sha256: "2c59d6951f93442bda7aac94bc0c18ad17187692cd67e3f4afea4958a09ebfdc",
  },
  {
    path: "icons/icon.png",
    width: 512,
    height: 512,
    sha256: "ab68a23e2f2f47333ec0e4515bd023902b36e7b27e4567c5fd99cedbb6d2003e",
  },
  {
    path: "icons/32x32.png",
    width: 32,
    height: 32,
    sha256: "a121d8b7c86266677258cbc8080bc56b73dce98b874ecfed953c275174232305",
  },
  {
    path: "icons/64x64.png",
    width: 64,
    height: 64,
    sha256: "66059e52ba8f0df962c8150907b69d6b1ec9c7d4d2eb8c1f75a0b08d7202993a",
  },
  {
    path: "icons/128x128.png",
    width: 128,
    height: 128,
    sha256: "a04a9d8c005c908676a47e5cc3fb63a1a72fa1044db544567adba3205d46b6c1",
  },
  {
    path: "icons/128x128@2x.png",
    width: 256,
    height: 256,
    sha256: "bed101c6cf6aefa3f78abacc052f2d7dcbc25691da892e11983e062579a39d04",
  },
  {
    path: "icons/Square30x30Logo.png",
    width: 30,
    height: 30,
    sha256: "1ba254e4e2b0538087ad9528493b0629b7a9c0ebee3f7d276aaed5064e6f6c3a",
  },
  {
    path: "icons/Square44x44Logo.png",
    width: 44,
    height: 44,
    sha256: "973ef215576cdca433b0f6a754bfe6da5a4fb4502d42611dadbb485687101406",
  },
  {
    path: "icons/Square71x71Logo.png",
    width: 71,
    height: 71,
    sha256: "b3b3e5e15930ceedc7c62e8c3d415280804a7340c0b52c4c087781b831a45d20",
  },
  {
    path: "icons/Square89x89Logo.png",
    width: 89,
    height: 89,
    sha256: "53607330128157f9e08a8be474e0f30e8f48841d21ccba3a9c29a0287896d52f",
  },
  {
    path: "icons/Square107x107Logo.png",
    width: 107,
    height: 107,
    sha256: "4877211ca0e78153d06084e643dc06e03786da7ab1ca6819844497cb6cf03b06",
  },
  {
    path: "icons/Square142x142Logo.png",
    width: 142,
    height: 142,
    sha256: "613cfedf0cfae7df759d21778cf2bd81dd25a031db5ed130b2b7846f21e4a28d",
  },
  {
    path: "icons/Square150x150Logo.png",
    width: 150,
    height: 150,
    sha256: "ae095eefac6d0bcbf17807d59eb5a8a72896305bc996cabe22fb4802838929a7",
  },
  {
    path: "icons/Square284x284Logo.png",
    width: 284,
    height: 284,
    sha256: "fddb6eed122f228c27fab0319eb036586d123a3c6c09567b4a5aca006697de9e",
  },
  {
    path: "icons/Square310x310Logo.png",
    width: 310,
    height: 310,
    sha256: "b211d65eae227821e01287fb877f1db3eec8e048f921ed83dc1ff1ecd0f01857",
  },
  {
    path: "icons/StoreLogo.png",
    width: 50,
    height: 50,
    sha256: "25e23225fbe91e12d7b486c3087860737cbdebcece7b952d1c32ee091757a2e8",
  },
];

const windowsIconPaths = windowsIconAssets.map(({ path: iconPath }) => iconPath);

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

function pngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, pngSignature.length).equals(pngSignature) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return null;
  }

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isSafeIconPath(value) {
  const normalized = value.replaceAll("\\", "/");
  return (
    !path.isAbsolute(value) &&
    !path.posix.isAbsolute(normalized) &&
    !path.win32.isAbsolute(normalized) &&
    !normalized.split("/").includes("..")
  );
}

function validateIco(errors, iconPath, buffer, canonicalPng) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    errors.push(`${iconPath} 不是有效的 Windows ICO 文件。`);
    return;
  }

  const count = buffer.readUInt16LE(4);
  if (count === 0 || buffer.length < 6 + count * 16) {
    errors.push(`${iconPath} 缺少有效的图像目录。`);
    return;
  }

  const sizes = new Set();
  let canonicalFound = false;
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = buffer[entryOffset] || 256;
    const height = buffer[entryOffset + 1] || 256;
    const byteLength = buffer.readUInt32LE(entryOffset + 8);
    const imageOffset = buffer.readUInt32LE(entryOffset + 12);
    const imageEnd = imageOffset + byteLength;
    sizes.add(`${width}x${height}`);

    if (byteLength === 0 || imageOffset < 6 + count * 16 || imageEnd > buffer.length) {
      errors.push(`${iconPath} 的第 ${index + 1} 个图像条目越界或为空。`);
      continue;
    }

    const image = buffer.subarray(imageOffset, imageEnd);
    const dimensions = pngDimensions(image);
    if (!dimensions || dimensions.width !== width || dimensions.height !== height) {
      errors.push(`${iconPath} 的第 ${index + 1} 个图像条目不是匹配尺寸的 PNG。`);
      continue;
    }
    if (width === 256 && height === 256 && canonicalPng && image.equals(canonicalPng)) {
      canonicalFound = true;
    }
  }

  for (const requiredSize of ["16x16", "24x24", "32x32", "48x48", "64x64", "256x256"]) {
    if (!sizes.has(requiredSize)) {
      errors.push(`${iconPath} 缺少 Windows ${requiredSize} 图像尺寸。`);
    }
  }
  if (canonicalPng && !canonicalFound) {
    errors.push(`${iconPath} 缺少与应用 Logo 同源的 256x256 图像。`);
  }
}

export function validateWindowsIconAssets(projectRoot = defaultRoot, tauriConfig = null) {
  const errors = [];
  const config = tauriConfig ?? readJson(path.join(projectRoot, "src-tauri", "tauri.conf.json"));
  const configuredIcons = config?.bundle?.icon;
  const configRoot = path.resolve(projectRoot, "src-tauri");

  if (!Array.isArray(configuredIcons) || configuredIcons.length === 0) {
    errors.push("tauri.conf.json 必须显式声明 bundle.icon Windows 图标路径。");
  } else {
    for (const [index, configuredIcon] of configuredIcons.entries()) {
      if (typeof configuredIcon !== "string" || !isSafeIconPath(configuredIcon)) {
        errors.push(`bundle.icon[${index}] 必须是 src-tauri 内的安全相对路径。`);
        continue;
      }
      if (![".ico", ".png"].includes(path.extname(configuredIcon).toLowerCase())) {
        errors.push(`bundle.icon[${index}] 必须指向 .ico 或 .png Windows 图标资源。`);
      }
    }

    for (const iconPath of windowsIconPaths) {
      if (!configuredIcons.includes(iconPath)) {
        errors.push(`tauri.conf.json 的 bundle.icon 缺少 ${iconPath}。`);
      }
    }
  }

  const buffers = new Map();
  for (const asset of windowsIconAssets) {
    const assetPath = path.join(configRoot, ...asset.path.split("/"));
    let buffer;
    try {
      const stat = fs.statSync(assetPath);
      if (!stat.isFile() || stat.size === 0) throw new Error("empty");
      buffer = fs.readFileSync(assetPath);
    } catch {
      errors.push(`${asset.path} 缺失或为空。`);
      continue;
    }
    buffers.set(asset.path, buffer);

    if (sha256(buffer) !== asset.sha256) {
      errors.push(`${asset.path} 与已确认 Moyang Reader Logo 不一致，可能回退到旧图标。`);
    }
    if (asset.format === "ico") continue;
    const dimensions = pngDimensions(buffer);
    if (!dimensions) {
      errors.push(`${asset.path} 不是有效的 PNG 文件。`);
    } else if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
      errors.push(
        `${asset.path} 尺寸应为 ${asset.width}x${asset.height}，实际为 ${dimensions.width}x${dimensions.height}。`,
      );
    }
  }

  const canonicalPng = buffers.get("icons/128x128@2x.png");
  const appLogoPath = path.join(projectRoot, "src", "assets", "moyang-reader-logo.png");
  try {
    const appLogo = fs.readFileSync(appLogoPath);
    const dimensions = pngDimensions(appLogo);
    if (!dimensions || dimensions.width !== 256 || dimensions.height !== 256) {
      errors.push("src/assets/moyang-reader-logo.png 必须是 256x256 PNG。");
    } else if (!canonicalPng || !appLogo.equals(canonicalPng)) {
      errors.push("应用内 Logo 与 Windows 256x256 图标资源不一致。");
    }
  } catch {
    errors.push("src/assets/moyang-reader-logo.png 缺失或为空。");
  }

  const ico = buffers.get("icons/icon.ico");
  if (ico) validateIco(errors, "icons/icon.ico", ico, canonicalPng);

  const legacySvgPath = path.join(configRoot, "icons", "icon.svg");
  if (fs.existsSync(legacySvgPath)) {
    const legacySvg = fs.readFileSync(legacySvgPath, "utf8");
    if (/M214 752V272|#356b67/i.test(legacySvg)) {
      errors.push("src-tauri/icons/icon.svg 仍包含旧字母 M 图标，不能进入 Windows 图标资源目录。");
    }
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
  if (!release.includes("tauriScript: npx tauri")) {
    errors.push("release.yml 必须通过直接 Tauri CLI 构建，避免共享 Cargo 缓存导致 tauri-action 找不到安装包。");
  }
  if (!release.includes("retryAttempts: 3")) {
    errors.push("release.yml 必须为构建和上传保留至少三次瞬时失败重试。");
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
  if (!mirror.includes("release-assets.json") || !mirror.includes("--asset-map=")) {
    errors.push("mirror-release.yml 必须传入 Release 资产映射，避免把 GitHub API 资产 ID 当作本地文件名。");
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
  errors.push(...validateWindowsIconAssets(projectRoot, tauriConfig));
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
