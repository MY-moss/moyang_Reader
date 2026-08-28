import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function normalizeVersion(value) {
  return typeof value === "string" ? value.trim().replace(/^v/i, "") : "";
}

function requireHttps(value, label) {
  let parsed;
  try {
    parsed = new globalThis.URL(value);
  } catch {
    throw new Error(`${label} 不是有效 URL。`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} 必须使用 HTTPS。`);
  }
  return parsed;
}

function isSafeAssetName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function assetNameFromUrl(value, platformName) {
  const parsed = requireHttps(value, `${platformName}.url`);
  const assetName = decodeURIComponent(path.posix.basename(parsed.pathname));
  if (!isSafeAssetName(assetName)) {
    throw new Error(`${platformName}.url 缺少安装包文件名。`);
  }
  return assetName;
}

function readReleaseAssets(assetMapPath) {
  if (!assetMapPath) return [];
  const payload = JSON.parse(fs.readFileSync(assetMapPath, "utf8"));
  const assets = Array.isArray(payload) ? payload : payload?.assets;
  if (!Array.isArray(assets)) {
    throw new Error("Release 资产映射缺少 assets 数组。");
  }
  return assets.filter((asset) => asset && typeof asset.name === "string");
}

function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function localInstallerNames(assetDir) {
  return fs
    .readdirSync(assetDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && entry.name !== "latest.json" && !entry.name.endsWith(".sig") && !entry.name.endsWith(".json"),
    )
    .map((entry) => entry.name)
    .filter((assetName) => isRegularFile(path.join(assetDir, assetName)))
    .filter((assetName) => isRegularFile(path.join(assetDir, `${assetName}.sig`)));
}

function mappedAssetNames(value, assetName, releaseAssets) {
  const matches = releaseAssets
    .filter((asset) => {
      const assetId = asset.id == null ? "" : String(asset.id);
      const assetUrl = typeof asset.url === "string" ? asset.url : "";
      const apiUrl = typeof asset.apiUrl === "string" ? asset.apiUrl : "";
      const browserUrl = typeof asset.browser_download_url === "string" ? asset.browser_download_url : "";
      return assetUrl === value || apiUrl === value || browserUrl === value || assetId === assetName;
    })
    .map((asset) => asset.name)
    .filter((name) => isSafeAssetName(name) && name !== "latest.json" && !name.endsWith(".sig"));
  return [...new Set(matches)];
}

function resolveAssetName({ value, platformName, assetDir, releaseAssets }) {
  const urlAssetName = assetNameFromUrl(value, platformName);
  if (isRegularFile(path.join(assetDir, urlAssetName))) return urlAssetName;

  const mappedNames = mappedAssetNames(value, urlAssetName, releaseAssets).filter(
    (name) => isRegularFile(path.join(assetDir, name)) && isRegularFile(path.join(assetDir, `${name}.sig`)),
  );
  if (mappedNames.length === 1) return mappedNames[0];
  if (mappedNames.length > 1) {
    throw new Error(`${platformName}.url 映射到多个本地安装包：${mappedNames.join(", ")}。`);
  }

  const candidates = localInstallerNames(assetDir);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new Error(
      `${platformName}.url 无法映射本地安装包：${value}。请提供 Release 资产映射；当前候选：${candidates.join(", ")}。`,
    );
  }
  return urlAssetName;
}

function mirrorAssetUrl(baseUrl, version, assetName) {
  return `${baseUrl.replace(/\/+$/, "")}/v${version}/${encodeURIComponent(assetName)}`;
}

export function prepareMirror({
  manifestPath,
  assetDir,
  outputDir,
  baseUrl,
  expectedVersion = null,
  assetMapPath = null,
}) {
  const base = requireHttps(baseUrl, "镜像地址");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const releaseAssets = readReleaseAssets(assetMapPath);
  const version = normalizeVersion(manifest?.version);
  if (!version) throw new Error("latest.json.version 缺失。");
  if (expectedVersion && normalizeVersion(expectedVersion) !== version) {
    throw new Error("latest.json.version 与发布版本不一致。");
  }

  const platforms = manifest?.platforms;
  if (!platforms || typeof platforms !== "object" || Array.isArray(platforms)) {
    throw new Error("latest.json.platforms 缺失。");
  }

  const assets = new Map();
  for (const [platformName, platform] of Object.entries(platforms)) {
    if (!platform || typeof platform.url !== "string") {
      throw new Error(`${platformName}.url 缺失。`);
    }
    const assetName = resolveAssetName({
      value: platform.url,
      platformName,
      assetDir,
      releaseAssets,
    });
    const assetPath = path.join(assetDir, assetName);
    const signaturePath = `${assetPath}.sig`;
    if (!fs.existsSync(assetPath)) throw new Error(`缺少安装包：${assetName}`);
    if (!fs.existsSync(signaturePath)) throw new Error(`缺少签名文件：${assetName}.sig`);
    assets.set(assetName, { assetPath, signaturePath });
    platform.url = mirrorAssetUrl(base.toString(), version, assetName);
  }

  const versionDir = path.join(outputDir, `v${version}`);
  fs.mkdirSync(versionDir, { recursive: true });
  for (const [assetName, files] of assets) {
    fs.copyFileSync(files.assetPath, path.join(versionDir, assetName));
    fs.copyFileSync(files.signaturePath, path.join(versionDir, `${assetName}.sig`));
  }

  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  fs.writeFileSync(path.join(outputDir, "latest.json"), manifestText, "utf8");
  fs.writeFileSync(path.join(versionDir, "latest.json"), manifestText, "utf8");

  return { version, assets: [...assets.keys()] };
}

function argumentValue(args, name) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length) ?? "";
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    const manifestPath = argumentValue(args, "manifest");
    const assetDir = argumentValue(args, "asset-dir");
    const outputDir = argumentValue(args, "output");
    const baseUrl = argumentValue(args, "base-url");
    const version = argumentValue(args, "version");
    const assetMapPath = argumentValue(args, "asset-map");
    if (!manifestPath || !assetDir || !outputDir || !baseUrl) {
      throw new Error("必须提供 --manifest、--asset-dir、--output 和 --base-url。");
    }
    const result = prepareMirror({
      manifestPath,
      assetDir,
      outputDir,
      baseUrl,
      expectedVersion: version || null,
      assetMapPath: assetMapPath || null,
    });
    console.log(`Prepared Cloudflare mirror for v${result.version}: ${result.assets.join(", ")}`);
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
