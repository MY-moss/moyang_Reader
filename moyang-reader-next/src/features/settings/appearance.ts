export type ReadingFont = "serif" | "sans" | "system";
export type EditorFont = "mono" | "system";
export type ExportTemplate = "book" | "report" | "compact";
export const readingFonts: Record<ReadingFont, string> = {
  serif: 'Georgia, "SimSun", "Songti SC", serif',
  sans: '"Segoe UI", "Microsoft YaHei", sans-serif',
  system: 'system-ui, "Microsoft YaHei", sans-serif',
};
export const editorFonts: Record<EditorFont, string> = {
  mono: 'Consolas, "Cascadia Code", "Microsoft YaHei", monospace',
  system: 'system-ui, "Microsoft YaHei", sans-serif',
};
export function normalizeAppearance(value: Record<string, unknown>) {
  return {
    readingFont: (value.readingFont === "sans" || value.readingFont === "system"
      ? value.readingFont
      : "serif") as ReadingFont,
    editorFont: (value.editorFont === "system" ? "system" : "mono") as EditorFont,
    exportTemplate: (value.exportTemplate === "report" || value.exportTemplate === "compact"
      ? value.exportTemplate
      : "book") as ExportTemplate,
  };
}
