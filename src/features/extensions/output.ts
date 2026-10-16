import type { ExtensionCommand, ExtensionOutput } from "../../shared/extension-types";

export function validateOutput(value: unknown, command: ExtensionCommand, source: string): ExtensionOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("插件返回的结果格式无效。");
  const result = value as ExtensionOutput;
  if (
    (result.report !== undefined && typeof result.report !== "string") ||
    (result.replacement !== undefined && typeof result.replacement !== "string")
  )
    throw new Error("插件返回的正文或报告格式无效。");
  if (result.replacement !== undefined && !command.modifiesDocument)
    throw new Error("此命令没有声明修改正文能力，结果未应用。");
  if (
    result.findings !== undefined &&
    (!Array.isArray(result.findings) ||
      result.findings.some(
        (item) =>
          !item ||
          typeof item.label !== "string" ||
          (item.detail !== undefined && typeof item.detail !== "string") ||
          !Number.isInteger(item.line) ||
          item.line < 1 ||
          !Number.isInteger(item.from) ||
          !Number.isInteger(item.to) ||
          item.from < 0 ||
          item.to <= item.from ||
          item.to > source.length,
      ))
  )
    throw new Error("插件返回的来源位置无效。");
  if (result.files !== undefined) {
    if (
      !Array.isArray(result.files) ||
      result.files.length > 32 ||
      result.files.some(
        (file) =>
          !file ||
          typeof file.name !== "string" ||
          !/^[^\\/:*?"<>|]{1,120}\.(md|txt|csv)$/i.test(file.name) ||
          [...file.name].some((character) => character.charCodeAt(0) < 32) ||
          typeof file.content !== "string",
      ) ||
      new Set(result.files.map((file) => file.name)).size !== result.files.length
    )
      throw new Error("插件导出文件无效，请使用唯一的 Markdown、TXT 或 CSV 文件名。");
    if (result.files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).length, 0) > 16 * 1024 * 1024)
      throw new Error("插件导出内容超过 16 MB，请拆分文档后重试。");
  }
  if (!result.report && result.replacement === undefined && !result.findings?.length && !result.files?.length)
    throw new Error("插件没有返回阅读报告或修改结果。");
  return result;
}
