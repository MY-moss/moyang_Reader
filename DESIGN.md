---
name: Moyang Reader
description: 暖白墨绿、阅读优先的本地文档与 AI 工作台
colors:
  canvas: "#f5f3ee"
  surface: "#faf9f5"
  surface-strong: "#fffefa"
  ink: "#30352f"
  muted: "#686e63"
  line: "#e3e3da"
  line-strong: "#b8bcb0"
  accent: "#3c6454"
  accent-deep: "#294d3d"
  accent-soft: "#e7eee4"
  dark-canvas: "#20231f"
  dark-surface: "#262a24"
  dark-surface-strong: "#2c3029"
  dark-ink: "#e9ebe2"
  dark-muted: "#afb6a5"
  dark-line: "#41483b"
  dark-line-strong: "#67725b"
  dark-accent: "#aecaa0"
  dark-accent-deep: "#d3e4c7"
  dark-accent-soft: "#3a4834"
typography:
  ui-body:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "14px"
  label:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "13px"
  toolbar:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "12px"
  reader-body:
    fontFamily: 'Georgia, "SimSun", "Songti SC", serif'
    fontSize: "calc(17px * var(--reading-zoom, 1))"
    lineHeight: 1.95
  ai-body:
    fontFamily: '"Source Han Serif SC", "Noto Serif CJK SC", "SimSun", Georgia, serif'
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.9
  document-title:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "28px"
    fontWeight: 550
    lineHeight: 1.5
  reader-heading-1:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "calc(32px * var(--reading-zoom, 1))"
    lineHeight: 1.45
  reader-heading-2:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "calc(24px * var(--reading-zoom, 1))"
    lineHeight: 1.5
  reader-heading-3:
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", sans-serif'
    fontSize: "calc(20px * var(--reading-zoom, 1))"
    lineHeight: 1.55
rounded:
  compact: "4px"
  control: "5px"
  field: "6px"
  popover: "7px"
  surface: "8px"
  dialog: "10px"
  composer: "12px"
  chip: "99px"
spacing:
  tight: "4px"
  small: "8px"
  control: "10px"
  medium: "12px"
  panel: "16px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.surface-strong}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-secondary:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "6px"
  input:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-deep}"
    rounded: "{rounded.control}"
    padding: "10px"
  tag-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-deep}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  preview-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: "18px"
  document-tab-preview:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.toolbar}"
    padding: "9px 8px 8px 13px"
  chat-composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.composer}"
    padding: "12px"
---

# Design System: Moyang Reader

## Overview

**Creative North Star: "暖白墨绿的阅读工作台"**

这是对已批准产品方向和当前代码的描述性归纳，并非另行批准的概念命名。暖白纸面、墨绿强调和本机字体让正文成为中心；导航、标签、属性与操作保持可扫描、可收起。阅读空间和 AI 空间共享工作台语言，保留各自内容的存储边界。

本规范于 2026-10-16 从实现提取，并按 0.13 扩展合并更新。依据为 [PRODUCT.md](PRODUCT.md)、[工作台任务](tasks/workbench-upgrade.md)、[聊天与更新任务及方向契约](tasks/workbench-chat-updates.md)、[样式加载顺序](src/styles/index.css)、[study.css](src/styles/study.css)、[workbench.css](src/styles/workbench.css)、[ai-space.css](src/styles/ai-space.css)、[chat.css](src/styles/chat.css) 及实际组件；字体还核对了 [appearance.ts](src/features/settings/appearance.ts)。运行时令牌继续由现有样式定义，本文记录其用途；不另设颜色真源。本轮沿用既有视觉体系，没有独立 QUALITY BAR 卡或批准设计图，不补造这些材料。

本轮实际画面与限制记录在 [.impeccable/raster-provenance.md](.impeccable/raster-provenance.md)。聊天收尾的六项问题已由独立审阅者限定复核为 resolved；该结论不等于全部产品或最终发布包验收。存储位置截图目前只覆盖列表上半部，最终迁移确认、结果与路径提示修正仍需对应画面证据。

**Key Characteristics:**

- 语义化暖白与墨绿，浅色、深色和跟随系统覆盖同一组角色。
- 正文使用本机衬线字体，工具与标题使用本机无衬线字体。
- 统一侧栏、固定双窗格、页面式设置，内容保持连续。
- 可选聊天沿用同一工作台，服务、模型、资料来源与确认保存入口清楚可见。
- 低阴影、细分隔、温和圆角，强调当前状态而非装饰。

## Colors

### Primary

墨绿强调由 `accent`、`accent-deep`、`accent-soft` 组成：操作与焦点用强调色，链接和选中导航文字用深强调色，选中行与悬停面用浅强调色。AI 保存按钮使用深强调色；阅读器主要入口使用强调色。

### Neutral

`canvas` 是最外层底色，`surface` 用于侧栏和次级区域，`surface-strong` 是正文与输入面。`ink` 表示正文，`muted` 表示辅助说明和占位，`line` 与 `line-strong` 分别用于普通分隔和需要辨认的边界。

前置区的 `dark-*` 是同名语义角色在深色主题中的取值，不是第二套品牌。运行时仍通过原来的 CSS 变量切换；跟随系统与显式深色保持一致。错误、外部修改和搜索命中沿用现有状态色，不能拿来替代导航强调。

扩展文件中的八级色阶由这些已用色值推导，仅供设计面板预览，不是新增的应用颜色令牌。

**The Semantic Theme Rule.** 新增文字、目录、占位和选中状态使用语义变量；同时检查显式深色及系统深色，不把浅色文字值固定到组件中。

## Typography

工具字体来自 `font-ui`，正文默认选择本机衬线字体；不依赖联网字体。前置区区分阅读器正文和 AI 正文的实际字体栈：阅读器会由用户字体偏好覆盖根变量，AI 当前使用根级正文栈，不能宣称两个空间的字体设置已同步。

阅读器正文的基础字号、行高与三级标题见前置区。阅读缩放使用 `reading-zoom`，默认 100%。AI 预览和编辑正文共同采用 `ai-body`，标题依次为正文的 1.85 / 1.45 / 1.2 倍，四至六级为 1 倍；均使用工具字体、600 字重、1.5 行高。段落、列表、引用、代码与表格上下间距一致，避免进入编辑时正文突然变成表单排版。

工具栏和标签主要使用 `toolbar`，全局导航与状态使用 `label`，AI 一般控件使用 `ui-body`。页面标题按任务层级设置，不额外引入装饰性展示字体体系。

聊天主标题与 API 服务标题使用工具字体、20px、600 字重，720px 窄窗聊天标题降为 18px。消息保持继承的工具字体与 1.85 行高；说明及次级动作 12px，一般聊天控件 13px。聊天输入、文本框和服务字段的占位说明使用 `muted`、不降低不透明度；深色与系统主题共享这一规则。

**The Independent Density Rule.** 舒适与紧凑只调整导航、列表和控件间距；正文大小由阅读设置独立控制。

本轮实测补齐阅读上下文的字号：文档类型、保存状态、目录/关联/属性、进度与跳转操作至少 12px，当前标题与文档名称 13px；类型徽标不参与压缩。错误色在显式与系统深色下使用 #f3a28f，浅色沿用 #a94f3e。

## Layout

工作台占满窗口高度。统一左侧栏承载品牌、阅读/AI 空间选择、搜索、内容导航、插件市场、设置和帮助。密度进入“设置 → 外观”，不再占一个常驻底部入口。主内容区承载文档工具、标签、正文、状态与右侧上下文；空间切换不再占据顶部独立条。阅读管理收在“更多内容”，AI 筛选按需展开。

侧栏默认 260px、右上下文默认 320px，可保存的拖动范围分别为 220–380px、260–440px。1100px 及以下的 CSS 将全局侧栏收窄为 220px；低于 900px 时改用覆盖导航。阅读正文默认最大宽度 760px；AI 文档和编辑页面最大宽度 860px。间距是从现有代码提取的常用值，并非强制所有尺寸落在单一倍率网格上。

| 条件                  | 当前行为                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| 窗口宽度低于 1100px   | 右上下文默认收起，手动打开时覆盖正文；不覆盖保存的右栏偏好。                                            |
| 窗口宽度低于 900px    | 全局侧栏默认收起；打开后为带遮罩的覆盖导航，宽度为 290px 与 85vw 中较小者；不改写已保存的侧栏开合偏好。 |
| 窗口宽度不超过 1000px | 聊天和 API 页边距收紧，API 服务列表列宽由 190px 降为 150px。                                            |
| 窗口宽度不超过 820px  | AI 内容列表与详情分步显示，详情提供返回入口。                                                           |
| 窗口宽度不超过 760px  | 固定双窗格改为上下排列，仍保留两个窗格的独立标签。                                                      |
| 720px 窄桌面档        | AI 页边距进一步收紧；设置分类在低于 720px 时改为横向换行。                                              |
| 窗口宽度不超过 720px  | API 配置改为单列，服务选择在顶端横向滚动；聊天操作可以换行，输入区保持在内容下方。                      |

900px 与 720px 是需要验证的桌面窄窗口尺寸，不代表两个面板共用这两个开合断点，也不代表完整移动端支持。响应式变化只改变当前呈现；重新放大窗口恢复用户保存的布局。

**The Stable Workspace Rule.** 窗口缩小触发临时呈现状态，用户主动调整才更新保存的布局。

窄窗覆盖导航具有初始焦点、Tab 循环、Escape 退出和入口焦点恢复；打开时背景不可操作。真正空白的 AI 分类在窄窗列表中也显示新建与连接入口，搜索无结果沿用独立空态。帮助按当前页面默认选择阅读、AI 或市场主题。

聊天区域由页面标题、独立滚动的消息区和底部输入区组成，消息参考宽度为 800px、输入参考宽度为 820px。API 服务页在聊天区域内替换消息页，提供明确的“返回聊天”，宽屏使用服务列表与表单两列；它不另建一个全局空间。存储位置和应用更新属于全局设置分类，不占用 AI 文档栏。保存回答是临时覆盖面板，不形成第三个编辑窗格。

## Elevation & Depth

正文、侧栏和设置主体通过色面与细边线区分；阅读正文与编辑纸面不使用浮起卡片效果。浮层才需要阴影：导航抽屉、上下文覆盖层、关联预览、窗格菜单和通知采用低透明度软阴影。精确阴影及运动值放在 [.impeccable/design.json](.impeccable/design.json)，避免与前置令牌重复。

欢迎内容和正文没有强制入场动画。普通控件保留已有的短暂状态过渡；减少动态效果偏好会关闭平滑滚动并将动画、过渡时长降到几乎即时。

**The Quiet Surface Rule.** 主任务面靠留白、细边线与色差分层；阴影用于解释覆盖关系。

## Shapes

控件以小圆角矩形为主，具体尺度见前置区。常规边线为 1px。标签胶囊保留自身圆形端部，文档标签使用上侧圆角；不要将胶囊形推广为所有导航按钮的形状。正文与页面式设置不包裹在额外圆角卡片中。

全局导航、文档工具与聊天动作通过共用 `Icon` 使用 Lucide 内联 SVG（默认 18px，24×24 视框，1.75 描边，圆端点与连接），随文字颜色变化；不依赖字体字符来表现导航图标。装饰图标对辅助技术隐藏，按钮自身保留可访问名称。图标由本地依赖打包，不通过外部字体或网络图标服务加载。

聊天输入容器采用 12px 圆角；单条用户消息采用 10px 圆角与正文纸面，助手消息直接排在聊天底色上。两者是聊天内的角色区别，不推广为正文阅读卡片。

## Components

### Buttons

主要按钮突出当前提交动作；次级按钮保留边框；工具动作通常透明。AI 主按钮悬停使用亮度变化，次级按钮悬停切到辅助面并加强边框，导航和文档工具悬停使用浅强调面。禁用状态降低不透明度并移除可点击光标。AI 控件的键盘焦点采用强调色 2px 轮廓和 2px 外偏移；其他已有组件保留其可见焦点行为。

### Inputs / Fields

常规输入使用正文面、细边框和温和圆角；占位说明用辅助文字色并保持不透明。标题编辑是正文的一部分：AI 标题使用无边框透明输入框，字号与文档标题一致。需要用户输入的摘要和属性保持明确标签。

### Navigation

统一侧栏在空间之间切换内容区。AI 导航即使通过 portal 渲染进全局侧栏，也必须保留自身按钮、悬停、选中和焦点样式。当前项使用浅强调面与深强调文字，并由 `aria-current` 或 `aria-pressed` 表达状态。

快速打开的格式标记、最近标记、路径、快捷键和底部提示至少 12px；标记使用 `accent-deep`，路径与提示使用 `muted`，避免浅色硬编码文字残留到系统深色。搜索入口复用共用图标，不增加重复的英文眉题。本段记录本轮 GitHub 可访问性问题修复后的代码规范；具体回归结果以对应测试报告为准。

### Document Tabs / Panes

固定两窗格，每个窗格独立拥有临时与保留标签。单击打开临时预览，双击或编辑后保留；临时标签以斜体辅助文字区分。当前标签通过纸面底色和底部强调线定位，长文件名截断，完整名称由可访问标签或提示提供。双窗格保持细分隔，比例在足够宽度下可调整。

### Cards / Tags / Related Preview

列表以横向细线组织，不将每一行都变成浮起卡片。标签保留胶囊形并在悬停、选中时加强强调色。来源和关联内容使用次级面，打开侧边预览时保持当前文档上下文；浮动预览明确提供关闭入口。

### Settings / Editing

插件市场与设置同属侧栏底部的全局页面，互斥打开；空间导航和搜索可直接返回内容。市场采用列表与详情结构，窄窗口逐层进入；安装、更新、停用、回退和冲突都有文字状态。主题扩展只覆盖已有颜色令牌，不改变字号和布局密度。

设置占据工作台主内容区域，使用“外观、编辑、导出版式、通用与隐私、数据恢复、应用更新、存储位置”分类；每次只呈现当前分类。返回工作台或 Escape 关闭，恢复先前焦点。设置页本身没有模态遮罩、圆角外壳或浮起阴影。

Markdown 默认可编辑，保留选区工具条、斜杠菜单与源码模式。阅读器和 AI 正文共用编辑器组件；AI 属性折叠为次级区域。自动保存等待停止输入约 1.2 秒，中文输入法组词期间暂停，保存和冲突状态使用文字反馈；切换内容保留草稿。具体会话和保存行为以应用代码及使用指南为准。

### Optional Chat / API Services

只有安装并启用助手扩展后，AI 空间才显示聊天入口。停用不删除历史；普通阅读与知识、记忆、技能的导航保持独立。聊天顶部只保留历史、新对话与 API 服务，助手、服务和模型的选择放在输入区；当前使用的模型信息保留在回答上。聊天首次打开引导配置自己的 API，已有配置时呈现助手建议问题。

输入区以 `Ctrl+Enter` 发送、Enter 换行，中文组词期间不发送。流式响应提供停止和重新回答，失败保留可恢复内容。未发送草稿拥有可恢复身份，历史里标记“未发送”；切换空间不销毁已访问聊天。资料召回默认关闭，项目范围与附加文档由用户决定，实际发送的资料在消息中折叠展示；回答不会自动成为记忆。

API 服务按名称组织，分别显示协议、地址、密钥与默认模型。密钥字段不回显旧值，空值保留已存密钥，清除有单独选项。保存、获取模型、测试回答的反馈使用明确文字；只有实际建立可取消的回答测试时显示“停止测试”。删除服务先说明会保留聊天记录。控件的禁用、悬停与 2px 强调色焦点保持一致，不用颜色单独表示运行结果。

### Save Answer Panel

“存入 AI 库”打开右侧模态面板，宽度为 460px 与窗口宽度中较小者，内边距 28px、左侧细边线、可纵向滚动。背景遮罩覆盖工作台；面板从“保存为”开始聚焦，Tab 循环在面板内，Escape、取消或点击遮罩关闭，关闭后回到触发入口。用户确认类型、标题和正文后才保存，并保留对话来源；保存进行中防止重复提交和意外关闭。

### Storage Location

设置中的存储页按“内容名称 → 容量 → 实际路径”分组，使用细横线和可换行长路径，不做磁盘仪表盘。首次统计、失败、浏览器预览限制与迁移结果分别呈现；刷新占用与选择位置是不同动作。

迁移按“选择新位置 → 检查迁移 → 查看范围及剩余空间 → 保存并迁移”推进，更换目标或模型选项会清除旧检查结果。模型默认不迁移。开始前说明保存、关闭、复制校验和重启，以及先关闭连接资料库的 Agent；原路径仅在确实重定向时显示兼容说明。迁移期间采用全屏文字状态；重启后的结果可显示失败原因或仍保留的旧副本。普通笔记、手动备份和外部模型的边界放在可展开说明中。迁移确认和结果控件已按源码记录，尚不据此宣称视觉验收通过。

### Update Notice

应用更新页区分“启动检查”与“自动下载”，安装与重启始终是明确动作。检查按钮使用设置的次级按钮样式，运行时有文字反馈并禁用重复检查。通知挂在全局工作台，阅读、AI 和聊天均可看到：最新版本、发现新版、下载进度、下载并校验完成、失败使用独立状态及相应动作。

通知固定在右下方，宽度不超过 620px，距边 24px；小窗宽度不超过 `100vw - 48px`，长内容在通知内滚动。“稍后处理”只隐藏提示，保留待处理更新。重启前保存文档与对话，失败原因保留以便重试；不能把开始下载写成安装成功。

## Do's and Don'ts

### 0.15.3 一致性修订

页面级标题统一使用 `--page-title-size`（22px），正文标题继续独立。设置的主题与其他偏好同为明确选择项；返回按钮使用共用箭头和次级按钮。窄窗设置分类采用横排，导航按钮保留同一节点以支持关闭抽屉后的焦点恢复。设置层位于全局导航抽屉之下；文件树在全局侧栏内保持普通文档流，不能套用旧移动侧栏的绝对定位。

侧栏仅高亮当前显示的全局页面。AI 搜索在窄窗详情内触发时先回到列表，正在编辑的内容仍保留。扩展列表单独滚动，搜索和类型筛选留在顶部；选中与悬停内容使用强调文字色，主要按钮悬停保持可读的色差。空结果提供清除条件的直接操作。

API 服务未保存导航使用页内提示，继续编辑默认获得焦点；保存失败保留原页面、目标和输入。真实页面的浅深色与三个窗口宽度核对见 [本轮报告](docs/VALIDATION-INTERFACE-CONSISTENCY.md)。

### Do:

- **Do** 让标题、正文与编辑模式共享清晰层级，让属性处于次级位置。
- **Do** 使用同一组语义颜色覆盖浅色、深色及系统主题。
- **Do** 分别验证 900px、720px 窗口和恢复宽窗口后的布局偏好。
- **Do** 让界面密度、正文字号和阅读字体各自承担自己的设置职责。
- **Do** 使用共用 Lucide 图标与可见焦点、选中、禁用反馈。
- **Do** 让会发送资料、保存长期记忆、迁移存储或重启更新的动作在当前页面有明确范围与状态。

### Don't:

- **Don't** 恢复顶部独立空间导航或把设置改回模态工作区。
- **Don't** 在进入 AI 编辑时改变正文的字体层级、列表缩进或引用结构。
- **Don't** 将旧样式文件中已被覆盖的渐变、眉题和浮起正文卡片作为新页面规范。
- **Don't** 把尚未独立批准的设计契约、图片或视觉审阅结论写成既成事实。
