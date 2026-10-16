import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

export async function updateArchive(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "SHA256.json"), "utf8"));
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(directory, file.name));
    if (crypto.createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error(`Package checksum mismatch: ${file.name}`);
  }
  const zip = new JSZip();
  const add = (root, prefix = "") => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!prefix && ["ollama", "updates", "online-update.json", "activate-update.ps1"].includes(entry.name)) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) add(path.join(root, entry.name), name + "/");
      else if (entry.isFile()) zip.file(name, fs.readFileSync(path.join(root, entry.name)));
      else throw new Error(`Unsupported package entry: ${name}`);
    }
  };
  add(directory);
  // This download also serves first-time installations: do not claim the local
  // model bundled with the full on-device package is present in the small ZIP.
  zip.file("SHA256.json", JSON.stringify({ ...manifest, bundled_model: false }, null, 2));
  zip.file("使用说明.txt", `Moyang Reader Next ${manifest.version}\n\n解压后打开 Moyang Reader Next.exe，保留 moyang-ai-mcp.exe。\n这是不含 Ollama 运行程序和模型的轻量包；普通阅读、关键词检索与自定义 API 聊天可直接使用。语义检索需要已安装的 Ollama 和 qwen3-embedding:0.6b。在线升级会沿用原有模型。\n插件市场安装“书房聊天”后，在 API 服务中填写自己的地址、密钥与模型。\n设置 → 存储位置：查看占用，并迁移 AI、聊天、草稿与缓存到其他磁盘。\n设置 → 应用更新：启动检查、可选自动下载、保存后重启。\n使用与恢复：https://github.com/MY-moss/moyang_Reader/tree/main/docs\n`);
  return { manifest, bytes: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }) };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const pointer = JSON.parse(fs.readFileSync(path.join(root, "release/latest.json"), "utf8"));
  if (!/^[\w.+-]+$/.test(pointer.directory) || [".", ".."].includes(pointer.directory)) throw new Error("Invalid release pointer");
  const { manifest, bytes } = await updateArchive(path.join(root, "release", pointer.directory));
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  if (manifest.version !== version) throw new Error("Build a current portable package before preparing a release");
  const output = path.join(root, "release", `publish-${version}`); fs.mkdirSync(output, { recursive: true });
  const filename = `moyang-reader-${version}-windows-x64.zip`, archive = path.join(output, filename);
  fs.writeFileSync(archive, bytes);
  const key = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || path.join(root, ".local/release-signing/moyang-update.key");
  if (!fs.existsSync(key)) throw new Error("Signing key missing. See docs/ONLINE-UPDATES.md; never generate a replacement for an existing channel.");
  const publicKey = fs.readFileSync(key + ".pub", "utf8").trim();
  const configuredKey = JSON.parse(fs.readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8")).plugins.updater.pubkey;
  if (publicKey !== configuredKey) throw new Error("Signing key does not match this application's update channel");
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/@tauri-apps/cli/tauri.js"), "signer", "sign", "-f", key, archive], { cwd: root, env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || "" }, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("Signing failed; check the local signing key and password.");
  const tag = `reader-v${version}`;
  const feed = { version, notes: `Moyang Reader ${version} 已发布。新增功能和使用说明见 GitHub 发布页。`, pub_date: new Date().toISOString(), platforms: { "windows-x86_64-portable": { signature: fs.readFileSync(archive + ".sig", "utf8").trim(), url: `https://github.com/MY-moss/moyang_Reader/releases/download/${tag}/${filename}` } } };
  fs.writeFileSync(path.join(output, "reader-update.json"), JSON.stringify(feed, null, 2));
  fs.writeFileSync(path.join(output, "SHA256SUMS.txt"), `${crypto.createHash("sha256").update(bytes).digest("hex")}  ${filename}\n`);
  console.log(JSON.stringify({ output, version, tag, archiveBytes: bytes.length, modelIncluded: false }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
