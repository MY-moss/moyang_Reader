import type { ExportTemplate } from "../settings/appearance";

export function exportTemplateStyle(template: ExportTemplate = "book") {
  if (template === "report")
    return {
      font: "Arial",
      eastAsia: "Microsoft YaHei",
      size: 22,
      line: 330,
      css: 'body, h1, h2, h3, h4, h5, h6 { font-family: Arial, "Microsoft YaHei", sans-serif; } body { font-size: 15px; line-height: 1.6; } h1, h2, h3 { font-weight: 700; }',
    };
  if (template === "compact")
    return {
      font: "Calibri",
      eastAsia: "Microsoft YaHei",
      size: 20,
      line: 280,
      css: 'body { font-family: Arial, "Microsoft YaHei", sans-serif; font-size: 13px; line-height: 1.45; } p, ul, ol, blockquote, pre, table { margin-bottom: 10px; } h1 { font-size: 28px; } h2 { margin-top: 24px; font-size: 21px; } .export-header { margin-bottom: 20px; }',
    };
  return { font: "Georgia", eastAsia: "SimSun", size: 24, line: 400, css: "" };
}
