import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Node 22's native cpSync aborts on some Windows volumes used by this project.
function copyTree(source, destination, filter = () => true) {
  if (!filter(source)) return;
  const stat = fs.lstatSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source))
      copyTree(path.join(source, entry), path.join(destination, entry), filter);
  } else if (stat.isFile()) fs.copyFileSync(source, destination);
  else throw new Error(`Unsupported package entry: ${source}`);
}

export function assemblePortablePackage({ root, target, outputRoot = path.join(root, "release"), now = new Date() }) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const files = [
    ["moyang-reader.exe", "Moyang Reader Next.exe"],
    ["moyang-ai-mcp.exe", "moyang-ai-mcp.exe"],
  ];
  for (const [source] of files)
    if (!fs.existsSync(path.join(target, source))) throw new Error(`Successful build is missing ${source}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const name = `${version}-${now.toISOString().replaceAll(":", "-")}-${crypto.randomBytes(3).toString("hex")}`;
  const stage = path.join(outputRoot, `.staging-${name}`);
  const destination = path.join(outputRoot, name);
  fs.mkdirSync(stage);
  // Publish independent complete packages: a running MCP or failed copy cannot
  // partially overwrite the previous package.
  for (const [source, name] of files) fs.copyFileSync(path.join(target, source), path.join(stage, name));
  const modelRoot = path.join(root, ".local/ollama");
  const bundledModel =
    fs.existsSync(path.join(modelRoot, "runtime/ollama.exe")) &&
    fs.existsSync(path.join(modelRoot, "models/manifests/registry.ollama.ai/library/qwen3-embedding/0.6b"));
  if (bundledModel) {
    for (const name of ["runtime", "models", "licenses"])
      copyTree(path.join(modelRoot, name), path.join(stage, "ollama", name));
    fs.writeFileSync(
      path.join(stage, "ollama/THIRD-PARTY.txt"),
      "Ollama v0.40.4: https://github.com/ollama/ollama/tree/v0.40.4 (MIT; licenses/Ollama-MIT.txt)\nQwen3-Embedding-0.6B: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B (Apache-2.0; licenses/Qwen3-Embedding-Apache-2.0.txt). Model obtained through Ollama, unchanged.\nRuntime component notices remain in runtime/lib/ollama.\n",
      "utf8",
    );
  }
  copyTree(
    path.join(root, "docs"),
    path.join(stage, "docs"),
    (source) => !source.includes(`${path.sep}screenshots`) && !source.includes(`${path.sep}research${path.sep}sources`),
  );
  for (const name of ["DESIGN.md", "PRODUCT.md", "LICENSE"])
    fs.copyFileSync(path.join(root, name), path.join(stage, name));
  fs.mkdirSync(path.join(stage, "tasks"));
  fs.copyFileSync(path.join(root, "tasks/workbench-upgrade.md"), path.join(stage, "tasks/workbench-upgrade.md"));
  // Raw artifacts and client reports are local evidence, not package dependencies.
  fs.writeFileSync(
    path.join(stage, "使用说明.txt"),
    `Moyang Reader Next ${version}\n\n双击 Moyang Reader Next.exe。保留同目录 moyang-ai-mcp.exe。\n${bundledModel ? "ollama 目录包含本地嵌入运行程序与 qwen3-embedding:0.6b，可离线运行。" : "使用语义检索前安装 Ollama，并在接入页准备 qwen3-embedding:0.6b。"}\n左侧切换阅读空间 / AI 空间。Markdown 默认编辑，停止输入后自动保存，Ctrl+S 立即保存。\nAI 空间 → 接入与备份：合并 Codex / Claude Code 配置；在客户端完成 MCP 权限和钩子信任。\n配置成功不代表真实客户端已验证。实际验收与待完成事项见 docs/VALIDATION-WORKBENCH.md。\n使用与恢复见 docs/USER-GUIDE.md、docs/AI-USER-GUIDE.md、docs/MIGRATION.md。\n新构建放在独立目录，已有包和运行中的 Agent 连接继续保留。启用新版 MCP 时，从新应用重新安装连接后重启客户端。\n本候选包不注册文件关联，不使用原项目更新渠道，不覆盖原项目。\n`,
    "utf8",
  );
  const manifest = {
    version,
    built_at: now.toISOString(),
    bundled_model: bundledModel,
    files: files.map(([, name]) => ({
      name,
      bytes: fs.statSync(path.join(stage, name)).size,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(stage, name)))
        .digest("hex"),
    })),
  };
  fs.writeFileSync(path.join(stage, "SHA256.json"), JSON.stringify(manifest, null, 2));
  fs.renameSync(stage, destination);
  const pointer = path.join(outputRoot, `.latest-${crypto.randomUUID()}.json`);
  fs.writeFileSync(pointer, JSON.stringify({ directory: name, ...manifest }, null, 2));
  fs.renameSync(pointer, path.join(outputRoot, "latest.json"));
  return { destination, ...manifest };
}
