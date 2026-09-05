import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedStatuses = new Set(["verified", "blocked", "pending"]);
const requiredAssetKinds = ["installer", "signature", "manifest"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeVersion(value) {
  return typeof value === "string" ? value.trim().replace(/^v/i, "") : "";
}

function isSemver(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(normalizeVersion(value));
}

function readProjectVersions(projectRoot, errors) {
  let packageJson;
  let tauriConfig;
  let cargoText;
  try {
    packageJson = readJson(path.join(projectRoot, "package.json"));
    tauriConfig = readJson(path.join(projectRoot, "src-tauri", "tauri.conf.json"));
    cargoText = fs.readFileSync(path.join(projectRoot, "src-tauri", "Cargo.toml"), "utf8");
  } catch (cause) {
    errors.push("无法读取项目版本文件：" + (cause instanceof Error ? cause.message : String(cause)));
    return null;
  }

  const versions = {
    package: normalizeVersion(packageJson.version),
    cargo: normalizeVersion(cargoText.match(/^version\s*=\s*"([^"]+)"/m)?.[1]),
    tauri: normalizeVersion(tauriConfig.version),
  };
  if (Object.values(versions).some((version) => !isSemver(version))) {
    errors.push("package.json、Cargo.toml 和 tauri.conf.json 必须声明有效的 SemVer 版本。");
  } else if (new Set(Object.values(versions)).size !== 1) {
    errors.push("package.json、Cargo.toml 和 tauri.conf.json 的版本不一致。");
  }
  return versions;
}

function readText(projectRoot, relativePath, label, errors) {
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  } catch (cause) {
    errors.push(`${label} 无法读取：` + (cause instanceof Error ? cause.message : String(cause)));
    return "";
  }
}

function validateChangelog(changelogText, version, errors) {
  if (!/^## \[Unreleased\]\s*$/m.test(changelogText)) {
    errors.push("CHANGELOG.md 必须包含 [Unreleased] 段落。");
  }
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^## \\[${escapedVersion}\\](?:\\s|$)`, "m").test(changelogText)) {
    errors.push(`CHANGELOG.md 缺少当前版本 [${version}] 段落。`);
  }
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  const normalized = value.replaceAll("\\", "/");
  return (
    !path.isAbsolute(value) &&
    !path.posix.isAbsolute(normalized) &&
    !path.win32.isAbsolute(normalized) &&
    !normalized.split("/").includes("..")
  );
}

function validateEvidenceReference(projectRoot, value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} 缺少证据。`);
    return;
  }
  if (/^https:\/\//i.test(value)) return;
  if (!isSafeRelativePath(value)) {
    errors.push(`${label} 必须是 HTTPS 地址或仓库内相对路径。`);
    return;
  }
  if (!fs.existsSync(path.resolve(projectRoot, value))) {
    errors.push(`${label} 指向的证据文件不存在：${value}。`);
  }
}

function validateStatusEntry(projectRoot, entry, label, errors) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${label} 状态缺失或格式错误。`);
    return;
  }
  if (!allowedStatuses.has(entry.status)) {
    errors.push(`${label} 状态必须是 verified、blocked 或 pending。`);
  }
  validateEvidenceReference(projectRoot, entry.evidence, `${label}证据`, errors);
  if (entry.status !== "verified" && (typeof entry.reason !== "string" || entry.reason.trim() === "")) {
    errors.push(`${label} 为 ${entry.status} 时必须记录原因。`);
  }
}

function validateReleaseAssets(projectRoot, release, version, errors) {
  if (!release || typeof release !== "object" || Array.isArray(release)) {
    errors.push("release-status.json 缺少 release 状态对象。");
    return;
  }
  if (!isSemver(release.version) || normalizeVersion(release.version) !== version) {
    errors.push("release-status.json 的发布版本与项目版本不一致。");
  }
  if (release.tag !== `v${version}`) {
    errors.push("release-status.json 的 tag 必须与版本一致。");
  }
  if (!["planned", "published"].includes(release.status)) {
    errors.push("release.status 必须是 planned 或 published。");
  }
  validateEvidenceReference(projectRoot, release.evidence, "Release 总证据", errors);
  validateStatusEntry(projectRoot, release.githubRelease, "GitHub Release", errors);
  const expectedGithubStatus = release.status === "published" ? "verified" : "pending";
  if (release.githubRelease?.status !== expectedGithubStatus) {
    errors.push(`GitHub Release 在 ${release.status} 状态下必须标记为 ${expectedGithubStatus}。`);
  }

  if (!Array.isArray(release.assets) || release.assets.length !== requiredAssetKinds.length) {
    errors.push("Release 资产必须恰好包含 Windows x64 安装包、签名文件和 latest.json。");
    return;
  }

  const seenKinds = new Set();
  const expectedNames = {
    installer: `Moyang.Reader_${version}_x64-setup.exe`,
    signature: `Moyang.Reader_${version}_x64-setup.exe.sig`,
    manifest: "latest.json",
  };
  for (const asset of release.assets) {
    const label = `Release 资产 ${asset?.kind ?? "未知"}`;
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      errors.push("Release 资产条目格式错误。");
      continue;
    }
    if (!requiredAssetKinds.includes(asset.kind)) {
      errors.push(`${label} 类型不在 Windows x64 资产集合中。`);
      continue;
    }
    if (seenKinds.has(asset.kind)) {
      errors.push(`Release 资产类型重复：${asset.kind}。`);
    }
    seenKinds.add(asset.kind);
    if (asset.name !== expectedNames[asset.kind]) {
      errors.push(`${label} 文件名与版本不一致。`);
    }
    if (!isSafeRelativePath(asset.name) || asset.name.includes("/") || asset.name.includes("\\")) {
      errors.push(`${label} 文件名必须是安全的单层相对文件名。`);
    }
    if (!/^https:\/\//i.test(asset.url ?? "")) {
      errors.push(`${label} 下载地址必须使用 HTTPS。`);
    }
    if (!Number.isInteger(asset.size) || asset.size <= 0) {
      errors.push(`${label} 必须记录正整数文件大小。`);
    }
    if (!/^[0-9a-f]{64}$/i.test(asset.sha256 ?? "")) {
      errors.push(`${label} 必须记录 64 位 SHA-256。`);
    }
    const expectedStatus = release.status === "published" ? "verified" : "pending";
    if (asset.status !== expectedStatus) {
      errors.push(`${label} 在 ${release.status} 状态下必须标记为 ${expectedStatus}。`);
    }
  }
  for (const kind of requiredAssetKinds) {
    if (!seenKinds.has(kind)) errors.push(`Release 资产缺少 ${kind}。`);
  }
}

function validateHandoff(projectRoot, handoff, errors) {
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) {
    errors.push("release-status.json 缺少 handoff 状态对象。");
    return;
  }
  const links = [
    ["AI-TASKS", handoff.next],
    ["AI-HANDOFF", handoff.summary],
    ["AI 接手提示词", handoff.takeover],
    ["版本交接归档", handoff.versionArchive],
    ["发布政策", handoff.releasePolicy],
  ];
  for (const [label, relativePath] of links) {
    if (!isSafeRelativePath(relativePath)) {
      errors.push(`${label} 交接链接必须是仓库内安全相对路径。`);
      continue;
    }
    if (!fs.existsSync(path.resolve(projectRoot, relativePath))) {
      errors.push(`${label} 交接链接指向的文件不存在：${relativePath}。`);
    }
  }
}

export function validateReleaseStatus(projectRoot = defaultRoot) {
  const errors = [];
  const versions = readProjectVersions(projectRoot, errors);
  if (!versions) return errors;
  const version = versions.package;

  let status;
  try {
    status = readJson(path.join(projectRoot, "docs", "release-status.json"));
  } catch (cause) {
    errors.push("无法读取 docs/release-status.json：" + (cause instanceof Error ? cause.message : String(cause)));
    return errors;
  }
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    return ["docs/release-status.json 必须是 JSON 对象。"];
  }
  if (status.schemaVersion !== 1) errors.push("release-status.json 的 schemaVersion 必须是 1。");

  validateChangelog(readText(projectRoot, "CHANGELOG.md", "CHANGELOG.md", errors), version, errors);
  validateReleaseAssets(projectRoot, status.release, version, errors);
  validateStatusEntry(projectRoot, status.mirror?.publicAssets, "公开镜像资产", errors);
  validateStatusEntry(projectRoot, status.mirror?.staticWorkflow, "静态镜像工作流", errors);
  validateStatusEntry(projectRoot, status.externalChecks?.oldVersionUpdate, "旧版本自动更新", errors);
  validateStatusEntry(projectRoot, status.externalChecks?.authenticode, "Authenticode", errors);
  validateHandoff(projectRoot, status.handoff, errors);
  return errors;
}

export function runReleaseStatusCheck(args = [], projectRoot = defaultRoot) {
  const errors = validateReleaseStatus(projectRoot);
  const versionFlag = args.find((arg) => arg.startsWith("--version="));
  if (versionFlag) {
    const expectedVersion = normalizeVersion(versionFlag.slice("--version=".length));
    let actualVersion = "";
    try {
      actualVersion = normalizeVersion(
        readJson(path.join(projectRoot, "docs", "release-status.json")).release?.version,
      );
    } catch {
      // The detailed missing/invalid status error is already reported above.
    }
    if (!isSemver(expectedVersion) || expectedVersion !== actualVersion) {
      errors.push("命令发布版本必须与结构化交接状态版本一致。");
    }
  }

  if (errors.length > 0) {
    console.error("Release/handoff status check failed:");
    errors.forEach((error) => console.error("- " + error));
    return 1;
  }

  const status = readJson(path.join(projectRoot, "docs", "release-status.json"));
  console.log(
    `Release/handoff status check passed for v${normalizeVersion(status.release.version)} (${status.release.status}; static mirror ${status.mirror.staticWorkflow.status}).`,
  );
  return 0;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFile === import.meta.url) {
  process.exitCode = runReleaseStatusCheck(process.argv.slice(2), defaultRoot);
}
