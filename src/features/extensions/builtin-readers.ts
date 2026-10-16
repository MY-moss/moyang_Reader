import type { ExtensionInput, ExtensionOutput, ExtensionPackage } from "../../shared/extension-types";

// Each function is serialized as a standalone module. Keep dependencies inside its body.
function tasks({ analysis, title }: ExtensionInput): ExtensionOutput {
  const tasks = analysis!.tasks;
  const pending = tasks.filter((task) => !task.checked);
  const done = tasks.filter((task) => task.checked);
  const lines = (items: typeof tasks) =>
    items.map((task) => `- [${task.checked ? "x" : " "}] ${task.text}（原文第 ${task.line} 行）`).join("\n");
  const report = `${title} · 待办清单\n\n未完成 ${pending.length} 项，已完成 ${done.length} 项。`;
  return {
    report: report + (!tasks.length ? "\n未找到 Markdown 复选任务，例如 - [ ] 待办。" : ""),
    findings: [...pending, ...done].map((task) => ({
      ...task,
      label: `${task.checked ? "已完成" : "待办"} · ${task.text}`,
    })),
    files: tasks.length
      ? [
          {
            name: "待办清单.md",
            content: `# ${title} · 待办\n\n## 未完成\n\n${lines(pending) || "无"}\n\n## 已完成\n\n${lines(done) || "无"}\n`,
          },
        ]
      : [],
  };
}
function links({ analysis, title }: ExtensionInput): ExtensionOutput {
  const links = analysis!.links;
  const unique = new Set(links.map((link) => link.url));
  return {
    report: `${title} · 链接清单\n\n共 ${links.length} 处引用，${unique.size} 个不同目标。包括 Markdown 链接、图片和引用式链接；不包含双链。仅整理当前文档，没有联网检查有效性。`,
    findings: links.map((link) => ({
      ...link,
      label: `${link.image ? "图片" : "链接"} · ${link.text || "未命名"}`,
      detail: link.url || "目标为空",
    })),
    files: links.length
      ? [
          {
            name: "链接清单.md",
            content:
              `# ${title} · 链接清单\n\n` +
              links
                .map((link) => `- 第 ${link.line} 行 · ${link.text || "未命名"}\n  ${link.url || "目标为空"}`)
                .join("\n\n") +
              "\n",
          },
        ]
      : [],
  };
}
function tables({ analysis, title }: ExtensionInput): ExtensionOutput {
  const tables = analysis!.tables;
  const cell = (text: string) => {
    // Spreadsheet programs can execute formula-looking text; preserve it as text.
    const literal = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + literal.replaceAll('"', '""') + '"';
  };
  return {
    report:
      `${title} · 表格导出\n\n找到 ${tables.length} 张 Markdown 表格。每张表单独导出 UTF-8 CSV，保留表头与行列，单元格取可读文字。以公式符号开头的值加单引号，防止电子表格将原文当公式执行。` +
      (tables.length > 32 ? "\n本次只导出前 32 张，请拆分文档后导出剩余表格。" : ""),
    findings: tables.map((table, index) => ({
      ...table,
      label: `表格 ${index + 1} · ${Math.max(0, table.rows.length - 1)} 行数据`,
      detail: table.rows[0]?.join(" · "),
    })),
    files: tables.slice(0, 32).map((table, index) => ({
      name: `表格-${index + 1}.csv`,
      content:
        "\uFEFF" +
        table.rows
          .map((row) => Array.from({ length: table.rows[0].length }, (_, i) => cell(row[i] ?? "")).join(","))
          .join("\r\n") +
        "\r\n",
    })),
  };
}
function health({ analysis, title }: ExtensionInput): ExtensionOutput {
  const { headings, links } = analysis!;
  const findings: NonNullable<ExtensionOutput["findings"]> = [];
  const seen = new Set<string>();
  let depth = 0;
  for (const heading of headings) {
    if (depth && heading.depth > depth + 1)
      findings.push({
        ...heading,
        label: "标题层级跳跃",
        detail: `从 ${depth} 级跳到 ${heading.depth} 级，检查是否缺少中间章节。`,
      });
    const normalized = heading.text.trim().toLocaleLowerCase();
    if (seen.has(normalized))
      findings.push({ ...heading, label: "重复标题", detail: `“${heading.text}”出现多次；若需引用章节，请核对目标。` });
    if (!normalized) findings.push({ ...heading, label: "空标题", detail: "补充标题文字，便于目录导航。" });
    seen.add(normalized);
    depth = heading.depth;
  }
  for (const link of links) {
    if (!link.url) findings.push({ ...link, label: "链接目标为空", detail: "补充链接目标，或改为普通文字。" });
    if (!link.text.trim())
      findings.push({ ...link, label: link.image ? "图片缺少替代文字" : "链接缺少说明", detail: link.url });
  }
  const report = `${title} · 文档体检\n\n${headings.some((h) => h.depth === 1) ? "已包含一级标题。" : "建议添加一级标题，方便识别文档主题。"}\n发现 ${findings.length} 处可核对的结构问题。重复标题也可能是有意安排，请按实际内容判断。这里只检查结构，不检查事实或外部链接有效性。`;
  return {
    report,
    findings,
    files: [
      {
        name: "文档体检.md",
        content:
          report +
          "\n\n" +
          findings.map((item) => `- 第 ${item.line} 行 · ${item.label}：${item.detail}`).join("\n") +
          "\n",
      },
    ],
  };
}

export const practicalReaders: ExtensionPackage[] = [
  {
    id: "moyang.task-extract",
    name: "待办提取",
    description: "从当前笔记提取未完成与已完成任务，回到原文核对，导出独立清单。",
    command: "提取文档待办",
    run: tasks,
  },
  {
    id: "moyang.link-inventory",
    name: "链接清单",
    description: "集中查看正文里的链接、图片和引用式链接，附原文位置并导出。",
    command: "整理文档链接",
    run: links,
  },
  {
    id: "moyang.table-export",
    name: "表格导出",
    description: "将 Markdown 表格分别导出为中文友好的 CSV，供电子表格继续整理。",
    command: "导出文档表格",
    run: tables,
  },
  {
    id: "moyang.document-health",
    name: "文档体检",
    description: "核对标题跳级、重复标题、空链接与图片说明，定位后自行修改。",
    command: "检查文档结构",
    run: health,
  },
].map(({ command, run, ...metadata }) => ({
  ...metadata,
  format: "moyang-extension",
  version: "1.0.0",
  minAppVersion: "0.14.0",
  kind: "reader",
  author: "Moyang",
  license: "MIT",
  homepage: "https://github.com/MY-moss/moyang_Reader",
  formats: ["markdown"],
  documentAnalysis: true,
  readme:
    "打开 Markdown 文档后，从此页直接运行，或在阅读页的更多操作中选择阅读插件。只处理当前文档，不联网，不修改正文；代码块和文档属性不会当作正文解析。结果可点击定位、复制或导出。",
  entry: "main.js",
  commands: [{ id: "run", name: command }],
  files: { "main.js": `export default ${run.toString()}` },
}));
