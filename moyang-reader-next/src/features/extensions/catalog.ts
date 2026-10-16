import type { ExtensionPackage } from "../../shared/extension-types";
export const curatedCatalogUrl =
  "https://raw.githubusercontent.com/MY-moss/moyang_Reader/main/moyang-reader-next/public/extensions/catalog.json";

const base = {
  format: "moyang-extension" as const,
  version: "1.0.0",
  minAppVersion: "0.12.0",
  author: "Moyang",
  license: "MIT",
  homepage: "https://github.com/MY-moss/moyang_Reader/tree/main/moyang-reader-next",
};
export const builtInCatalog: ExtensionPackage[] = [
  {
    ...base,
    id: "moyang.reading-report",
    formats: ["markdown", "text", "docx"],
    name: "阅读概览",
    kind: "reader",
    description: "统计中文字符、英文词数、标题与阅读时间，并列出文档大纲。",
    readme:
      "打开一份文档，在命令面板运行“生成阅读概览”。只读取当前页，不修改内容，不联网。阅读时长按每分钟约 400 个汉字或 200 个英文词估算。",
    entry: "main.js",
    commands: [{ id: "report", name: "生成阅读概览" }],
    files: {
      "main.js": `export default function run({text,title}) {
      const chinese=(text.match(/[\\u3400-\\u9fff]/g)||[]).length;
      const words=(text.match(/[a-zA-Z]+(?:['’-][a-zA-Z]+)*/g)||[]).length;
      let fenced=false; const headings=[];
      for(const line of text.split(/\\r?\\n/)){ if(/^\\s*(\x60\x60\x60|~~~)/.test(line)){fenced=!fenced;continue;} if(!fenced && /^#{1,6}\\s/.test(line)) headings.push(line); }
      const minutes=Math.max(1,Math.ceil(chinese/400+words/200));
      return {report: title+'\\n\\n中文字符：'+chinese+'\\n英文词数：'+words+'\\n预计阅读：'+minutes+' 分钟\\n\\n'+(headings.length?'文档大纲\\n'+headings.join('\\n'):'未找到 Markdown 标题。')};
    }`,
    },
  },
  {
    ...base,
    id: "moyang.tidy-markdown",
    name: "段落留白整理",
    kind: "reader",
    description: "把连续多余空行收为一个段落间隔，保留代码块、硬换行与原换行格式。",
    readme: "运行后先显示修改前后内容，采用后可用原有撤销恢复。仅整理 Markdown/TXT 的多余空行，不重排文字或更改链接。",
    entry: "main.js",
    commands: [{ id: "tidy", name: "整理段落留白", modifiesDocument: true }],
    files: {
      "main.js": `export default function run({text}) {
      const eol=text.includes('\\r\\n')?'\\r\\n':'\\n'; let fence='',empty=0; const out=[];
      for(const line of text.split(/\\r?\\n/)){
        const m=line.match(/^ {0,3}(\x60{3,}|~{3,})/);
        if(m){if(!fence)fence=m[1];else if(m[1][0]===fence[0]&&m[1].length>=fence.length)fence='';}
        if(fence||line.trim()){empty=0;out.push(line);}else if(++empty<=1)out.push(line);
      }
      return {replacement:out.join(eol),report:'已整理多余空行；代码块和 Markdown 硬换行保持原样。'};
    }`,
    },
  },
  {
    ...base,
    id: "moyang.mist-theme",
    name: "雾青书房",
    kind: "theme",
    description: "偏冷的纸白与青灰配色，浅色清爽，深色柔和。",
    theme: {
      light: {
        "--canvas": "#f1f5f4",
        "--surface": "#f8fbfa",
        "--surface-strong": "#ffffff",
        "--ink": "#263b38",
        "--muted": "#586f6a",
        "--line": "#d9e4e0",
        "--line-strong": "#acbeb8",
        "--accent": "#2e6560",
        "--accent-deep": "#234f4b",
        "--accent-soft": "#dfede9",
      },
      dark: {
        "--canvas": "#1d2726",
        "--surface": "#24302e",
        "--surface-strong": "#2b3936",
        "--ink": "#e5eeeb",
        "--muted": "#adbfba",
        "--line": "#40544d",
        "--line-strong": "#637b72",
        "--accent": "#a0cec2",
        "--accent-deep": "#c7e8de",
        "--accent-soft": "#354f46",
      },
    },
  },
  {
    ...base,
    id: "moyang.evidence-memory",
    name: "有据可查的记忆整理",
    kind: "skill",
    description: "帮助 Agent 在任务结束时区分长期结论、临时进展与推测，并正确处理更正。",
    skill: {
      body: "---\nname: evidence-memory\ndescription: 在任务结束时整理有来源的偏好、决定与经验，避免重复、推测和跨项目污染。\n---\n\n# 任务结束的记忆整理\n\n先使用当前任务原有的 checkpoint_id，不另建检查点。检查本轮是否出现明确偏好、已验证事实、决定或可复用经验。\n\n1. 用来源文字和任务结果核对结论；进度、闲聊、猜测不保存。\n2. 召回相同项目的已有记忆，重复信息不重复写入。\n3. 用户明确更正时引用旧条目及版本，替代并保留历史；推测矛盾进入待处理列表。\n4. 项目决定保留项目范围，只有用户明确的通用偏好才跨项目共享。\n5. 使用 conclude_task 提交本轮决定及来源；没有新内容时提交空 decisions 和原因。\n6. 工具失败时保留原检查点并说明待处理，不把失败说成成功。\n\n更多例子按需读取 references/examples.md。",
      assets: [
        {
          path: "references/examples.md",
          encoding: "utf8",
          content:
            "# 例子\n\n值得保存：用户明确要求以后统一用两空格缩进；验证过的项目构建步骤。\n\n不值得保存：正在运行测试；可能需要重写；今天聊过的天气。\n\n更正：用户明确废弃旧规则时更新已有条目，引用本轮来源；模型自行推测冲突时不直接覆盖。",
        },
      ],
    },
  },
  {
    ...base,
    id: "mcp.sequential-thinking",
    name: "Sequential Thinking",
    kind: "mcp",
    author: "Model Context Protocol",
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    description: "官方参考 MCP 服务，提供分步问题分析工具。需要本机 Node.js，由客户端启动。",
    readme:
      "此处安装连接定义，再选择 Codex 或 Claude Code 查看配置并安装。首次由客户端启动时，npx 会下载固定版本 1.0.0；请确保 Node.js 与网络可用。此工具不提供独立模型，也不是 Moyang 长期记忆服务。",
    mcp: /Windows/i.test(navigator.userAgent)
      ? {
          command: "cmd",
          args: ["/c", "npx", "-y", "@modelcontextprotocol/server-sequential-thinking@1.0.0"],
          env: { DISABLE_THOUGHT_LOGGING: "true" },
        }
      : {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sequential-thinking@1.0.0"],
          env: { DISABLE_THOUGHT_LOGGING: "true" },
        },
  },
];
