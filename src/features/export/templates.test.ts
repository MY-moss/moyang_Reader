import JSZip from "jszip";
import { expect, it } from "vitest";
import { buildDocxExport, buildHtmlExport } from "./export";
it("applies report and compact typography to real HTML and DOCX outputs", async () => {
  const options = { paper: "a4", orientation: "portrait", margin: "standard", template: "report" } as const;
  expect(buildHtmlExport("报告", "<p>正文</p>", options)).toContain('font-family: Arial, "Microsoft YaHei"');
  const bytes = await buildDocxExport("报告", "<p>正文</p>", options);
  const zip = await JSZip.loadAsync(bytes);
  const styles = await zip.file("word/styles.xml")!.async("string");
  expect(styles.match(/<w:rPrDefault>/g)).toHaveLength(1);
  expect(styles).toContain('w:ascii="Arial"');
  expect(styles).toContain('w:line="330"');
  expect(buildHtmlExport("讲义", "<p>正文</p>", { ...options, template: "compact" })).toContain("font-size: 13px");
});
