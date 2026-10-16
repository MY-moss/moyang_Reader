import type { ExtensionPackage, McpConfiguration } from "../../shared/extension-types";
import { contentHash } from "../documents/source-chunks";

export const APP_VERSION = "0.15.1";
export const MAX_PACKAGE_BYTES = 16 * 1024 * 1024;
export const themeTokens = [
  "--canvas",
  "--surface",
  "--surface-strong",
  "--ink",
  "--muted",
  "--line",
  "--line-strong",
  "--accent",
  "--accent-deep",
  "--accent-soft",
];
const versionPattern = /^\d+\.\d+\.\d+$/;
export function compareVersions(a: string, b: string) {
  const left = a.split(".").map(Number),
    right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("扩展内容必须是一个对象。");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`扩展缺少${label}。`);
}
export function validateMcp(value: unknown): McpConfiguration {
  const m = object(value);
  if (typeof m.command === "string" && m.command.trim()) {
    if (m.url !== undefined) throw new Error("MCP 请选择本地命令或远程地址中的一种。");
    if (m.args !== undefined && (!Array.isArray(m.args) || m.args.some((a) => typeof a !== "string")))
      throw new Error("MCP 参数必须是文字数组。");
    if (m.env !== undefined && Object.values(object(m.env)).some((v) => typeof v !== "string"))
      throw new Error("MCP 环境变量必须是文字。");
    return { command: m.command, args: (m.args ?? []) as string[], env: (m.env ?? {}) as Record<string, string> };
  }
  if (typeof m.url !== "string" || !/^https?:\/\//.test(m.url)) throw new Error("MCP 缺少有效命令或 HTTP 地址。");
  new URL(m.url);
  if (m.headers !== undefined && Object.values(object(m.headers)).some((v) => typeof v !== "string"))
    throw new Error("MCP 请求头必须是文字。");
  return { url: m.url, headers: (m.headers ?? {}) as Record<string, string> };
}
export function validatePackage(value: unknown): ExtensionPackage {
  const p = object(value);
  if (p.format !== "moyang-extension") throw new Error("请选择 Moyang 扩展包（manifest.json 或 JSON 包）。");
  for (const [key, label] of Object.entries({
    id: "ID",
    name: "名称",
    version: "版本",
    minAppVersion: "最低应用版本",
    author: "作者",
    description: "说明",
  }))
    text(p[key], label);
  if (!/^[a-z0-9][a-z0-9._-]{1,99}$/.test(p.id as string))
    throw new Error("扩展 ID 仅支持小写字母、数字、点、横线和下划线。");
  if (!versionPattern.test(p.version as string) || !versionPattern.test(p.minAppVersion as string))
    throw new Error("版本格式应为三段数字，例如 1.0.0。");
  if (p.homepage !== undefined && (typeof p.homepage !== "string" || !/^https?:\/\//.test(p.homepage)))
    throw new Error("扩展来源网址无效。");
  if (p.readme !== undefined && typeof p.readme !== "string") throw new Error("扩展说明应为文字。");
  if (p.kind === "reader") {
    if (p.documentAnalysis !== undefined && typeof p.documentAnalysis !== "boolean")
      throw new Error("文档分析能力声明无效。");
    if (
      p.formats !== undefined &&
      (!Array.isArray(p.formats) ||
        !p.formats.length ||
        p.formats.some((f) => !["markdown", "text", "docx"].includes(String(f))))
    )
      throw new Error("阅读插件支持的格式应为 markdown、text 或 docx。");
    text(p.entry, "入口文件");
    const files = object(p.files);
    if (Object.values(files).some((content) => typeof content !== "string"))
      throw new Error("插件代码文件必须是文字。");
    text(files[p.entry], "入口代码");
    if (!Array.isArray(p.commands) || !p.commands.length) throw new Error("阅读插件至少需要一个命令。");
    const ids = new Set<string>();
    for (const item of p.commands) {
      const command = object(item);
      text(command.id, "命令 ID");
      text(command.name, "命令名称");
      if (ids.has(command.id) || !/^[a-z0-9_-]+$/.test(command.id)) throw new Error("命令 ID 无效或重复。");
      if (command.modifiesDocument !== undefined && typeof command.modifiesDocument !== "boolean")
        throw new Error("命令的修改能力声明无效。");
      ids.add(command.id);
    }
  } else if (p.kind === "theme") {
    const theme = object(p.theme);
    for (const mode of ["light", "dark"]) {
      const colors = object(theme[mode]);
      if (!Object.keys(colors).length) throw new Error("主题需要浅色和深色配色。");
      for (const [key, color] of Object.entries(colors))
        if (!themeTokens.includes(key) || typeof color !== "string" || !/^#[\da-f]{6}$/i.test(color))
          throw new Error(`主题颜色 ${key} 无效，请使用支持的颜色令牌和六位色值。`);
    }
  } else if (p.kind === "skill") {
    const skill = object(p.skill);
    text(skill.body, "技能正文");
    if (!Array.isArray(skill.assets)) throw new Error("技能资源列表无效。");
    const paths = new Set<string>();
    for (const item of skill.assets) {
      const asset = object(item);
      text(asset.path, "资源路径");
      if (asset.path.startsWith("/") || /(^|[\\/])\.\.([\\/]|$)|[:\\]/.test(asset.path) || paths.has(asset.path))
        throw new Error("技能资源路径无效或重复。");
      if (!["utf8", "base64"].includes(String(asset.encoding)) || typeof asset.content !== "string")
        throw new Error("技能资源内容无效。");
      paths.add(asset.path);
    }
  } else if (p.kind === "mcp") {
    p.mcp = validateMcp(p.mcp);
  } else if (p.kind === "assistant") {
    const assistant = object(p.assistant);
    text(assistant.prompt, "助手提示词");
    if (
      assistant.prompt.length > 12000 ||
      !Array.isArray(assistant.starters) ||
      assistant.starters.length > 8 ||
      assistant.starters.some((s) => typeof s !== "string" || s.length > 500)
    )
      throw new Error("助手提示词最多 12000 字符，可提供最多 8 条简短开场问题。");
  } else throw new Error("不支持此扩展类型。");
  if (new TextEncoder().encode(JSON.stringify(p)).byteLength > MAX_PACKAGE_BYTES)
    throw new Error("扩展包超过 16 MB，请拆分大型资源。");
  return structuredClone(p) as ExtensionPackage;
}
export function compatiblePackage(pkg: ExtensionPackage) {
  return compareVersions(pkg.minAppVersion, APP_VERSION) <= 0;
}
export function parseCatalog(value: unknown): ExtensionPackage[] {
  const catalog = object(value);
  if (catalog.format !== "moyang-extension-catalog" || !Array.isArray(catalog.packages))
    throw new Error("地址没有返回 Moyang 扩展目录。");
  const packages = catalog.packages.map(validatePackage);
  if (new Set(packages.map((p) => p.id)).size !== packages.length) throw new Error("目录内存在重复扩展 ID。");
  return packages;
}
export async function readExtensionFile(file: File): Promise<ExtensionPackage> {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error("扩展文件超过 16 MB。");
  const skillPackage = async () => {
    const { importAiFile, skillMarkdown } = await import("../ai/transfers");
    const fields = await importAiFile(file, "skill");
    const name = fields.title.toLowerCase();
    const id = /^[a-z0-9][a-z0-9._-]{0,79}$/.test(name)
      ? name
      : `local-${(await contentHash(fields.title)).slice(0, 20)}`;
    const version =
      typeof fields.skill_meta.version === "string" && versionPattern.test(fields.skill_meta.version)
        ? fields.skill_meta.version
        : null;
    return validatePackage({
      format: "moyang-extension",
      id: `skill.${id}`,
      name: fields.title,
      version: version ?? "1.0.0",
      ...(version ? {} : { sourceFormat: "agent-skill" }),
      minAppVersion: APP_VERSION,
      kind: "skill",
      description: fields.summary,
      author: "本地导入",
      skill: { body: skillMarkdown(fields), assets: fields.assets },
    });
  };
  if (file.name.toLowerCase().endsWith(".md")) return skillPackage();
  if (!file.name.toLowerCase().endsWith(".zip")) return validatePackage(JSON.parse(await file.text()));
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifest = zip.file("manifest.json");
  if (!manifest) return skillPackage();
  const pkg = object(JSON.parse(await manifest.async("string")));
  const files: Record<string, string> = {};
  let bytes = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || entry.name === "manifest.json") continue;
    const content = await entry.async("string");
    bytes += new TextEncoder().encode(content).byteLength;
    if (bytes > MAX_PACKAGE_BYTES) throw new Error("解压后的扩展超过 16 MB。");
    files[entry.name] = content;
  }
  if (pkg.kind === "reader") pkg.files = files;
  if (pkg.kind === "skill") {
    if (!files["SKILL.md"]) throw new Error("技能包需要 SKILL.md。");
    pkg.skill = {
      body: files["SKILL.md"],
      assets: await Promise.all(
        Object.values(zip.files)
          .filter((e) => !e.dir && !["manifest.json", "SKILL.md"].includes(e.name))
          .map(async (e) => ({ path: e.name, encoding: "base64", content: await e.async("base64") })),
      ),
    };
  }
  return validatePackage(pkg);
}
export function localSkillRevision(pkg: ExtensionPackage, previous?: ExtensionPackage): ExtensionPackage {
  if (pkg.sourceFormat !== "agent-skill" || !previous || pkg.id !== previous.id || previous.kind !== "skill")
    return pkg;
  const parts = previous.version.split(".").map(Number);
  return {
    ...pkg,
    version:
      JSON.stringify(pkg.skill) === JSON.stringify(previous.skill)
        ? previous.version
        : `${parts[0]}.${parts[1]}.${parts[2] + 1}`,
  };
}
