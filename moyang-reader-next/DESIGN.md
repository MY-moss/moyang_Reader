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
---

# Design System: Moyang Reader

## Overview

**Creative North Star: "暖白墨绿的阅读工作台"**

这是对已批准产品方向和当前代码的描述性归纳，并非另行批准的概念命名。暖白纸面、墨绿强调和本机字体让正文成为中心；导航、标签、属性与操作保持可扫描、可收起。阅读空间和 AI 空间共享工作台语言，保留各自内容的存储边界。

本规范于 2026-10-16 从实现提取。依据为 [PRODUCT.md](PRODUCT.md)、[本轮任务](tasks/workbench-upgrade.md)、[study.css](src/styles/study.css)、[workbench.css](src/styles/workbench.css)、[ai-space.css](src/styles/ai-space.css) 及实际组件；字体还核对了 [appearance.ts](src/features/settings/appearance.ts)。本轮为代码主导，没有独立方向契约、QUALITY BAR 卡或批准设计图；本文不补造这些材料，也不替代最终视觉审阅结论。

**Key Characteristics:**

- 语义化暖白与墨绿，浅色、深色和跟随系统覆盖同一组角色。
- 正文使用本机衬线字体，工具与标题使用本机无衬线字体。
- 统一侧栏、固定双窗格、页面式设置，内容保持连续。
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

**The Independent Density Rule.** 舒适与紧凑只调整导航、列表和控件间距；正文大小由阅读设置独立控制。

## Layout

工作台占满窗口高度。统一左侧栏承载品牌、阅读/AI 空间选择、搜索、内容导航、设置、帮助和密度。主内容区承载文档工具、标签、正文、状态与右侧上下文；空间切换不再占据顶部独立条。

侧栏默认 260px、右上下文默认 320px，可保存的拖动范围分别为 220–380px、260–440px。1100px 及以下的 CSS 将全局侧栏收窄为 220px；低于 900px 时改用覆盖导航。阅读正文默认最大宽度 760px；AI 文档和编辑页面最大宽度 860px。间距是从现有代码提取的常用值，并非强制所有尺寸落在单一倍率网格上。

| 条件                 | 当前行为                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| 窗口宽度低于 1100px  | 右上下文默认收起，手动打开时覆盖正文；不覆盖保存的右栏偏好。                                            |
| 窗口宽度低于 900px   | 全局侧栏默认收起；打开后为带遮罩的覆盖导航，宽度为 290px 与 85vw 中较小者；不改写已保存的侧栏开合偏好。 |
| 窗口宽度不超过 820px | AI 内容列表与详情分步显示，详情提供返回入口。                                                           |
| 窗口宽度不超过 760px | 固定双窗格改为上下排列，仍保留两个窗格的独立标签。                                                      |
| 720px 窄桌面档       | AI 页边距进一步收紧；设置分类在低于 720px 时改为横向换行。                                              |

900px 与 720px 是需要验证的桌面窄窗口尺寸，不代表两个面板共用这两个开合断点，也不代表完整移动端支持。响应式变化只改变当前呈现；重新放大窗口恢复用户保存的布局。

**The Stable Workspace Rule.** 窗口缩小触发临时呈现状态，用户主动调整才更新保存的布局。

## Elevation & Depth

正文、侧栏和设置主体通过色面与细边线区分；阅读正文与编辑纸面不使用浮起卡片效果。浮层才需要阴影：导航抽屉、上下文覆盖层、关联预览、窗格菜单和通知采用低透明度软阴影。精确阴影及运动值放在 [.impeccable/design.json](.impeccable/design.json)，避免与前置令牌重复。

欢迎内容和正文没有强制入场动画。普通控件保留已有的短暂状态过渡；减少动态效果偏好会关闭平滑滚动并将动画、过渡时长降到几乎即时。

**The Quiet Surface Rule.** 主任务面靠留白、细边线与色差分层；阴影用于解释覆盖关系。

## Shapes

控件以小圆角矩形为主，具体尺度见前置区。常规边线为 1px。标签胶囊保留自身圆形端部，文档标签使用上侧圆角；不要将胶囊形推广为所有导航按钮的形状。正文与页面式设置不包裹在额外圆角卡片中。

全局导航和文档工具使用内联 SVG 图标（18px，24×24 视框，1.6 描边，圆端点与连接），随文字颜色变化；不依赖字体字符来表现导航图标。

## Components

### Buttons

主要按钮突出当前提交动作；次级按钮保留边框；工具动作通常透明。AI 主按钮悬停使用亮度变化，次级按钮悬停切到辅助面并加强边框，导航和文档工具悬停使用浅强调面。禁用状态降低不透明度并移除可点击光标。AI 控件的键盘焦点采用强调色 2px 轮廓和 2px 外偏移；其他已有组件保留其可见焦点行为。

### Inputs / Fields

常规输入使用正文面、细边框和温和圆角；占位说明用辅助文字色并保持不透明。标题编辑是正文的一部分：AI 标题使用无边框透明输入框，字号与文档标题一致。需要用户输入的摘要和属性保持明确标签。

### Navigation

统一侧栏在空间之间切换内容区。AI 导航即使通过 portal 渲染进全局侧栏，也必须保留自身按钮、悬停、选中和焦点样式。当前项使用浅强调面与深强调文字，并由 `aria-current` 或 `aria-pressed` 表达状态。

### Document Tabs / Panes

固定两窗格，每个窗格独立拥有临时与保留标签。单击打开临时预览，双击或编辑后保留；临时标签以斜体辅助文字区分。当前标签通过纸面底色和底部强调线定位，长文件名截断，完整名称由可访问标签或提示提供。双窗格保持细分隔，比例在足够宽度下可调整。

### Cards / Tags / Related Preview

列表以横向细线组织，不将每一行都变成浮起卡片。标签保留胶囊形并在悬停、选中时加强强调色。来源和关联内容使用次级面，打开侧边预览时保持当前文档上下文；浮动预览明确提供关闭入口。

### Settings / Editing

插件市场与设置同属侧栏底部的全局页面，互斥打开；空间导航和搜索可直接返回内容。市场采用列表与详情结构，窄窗口逐层进入；安装、更新、停用、回退和冲突都有文字状态。主题扩展只覆盖已有颜色令牌，不改变字号和布局密度。

设置占据工作台主内容区域，使用“外观、编辑、导出版式、通用与隐私、数据恢复”分类；每次只呈现当前分类。返回工作台或 Escape 关闭，恢复先前焦点。设置页本身没有模态遮罩、圆角外壳或浮起阴影。

Markdown 默认可编辑，保留选区工具条、斜杠菜单与源码模式。阅读器和 AI 正文共用编辑器组件；AI 属性折叠为次级区域。自动保存等待停止输入约 1.2 秒，中文输入法组词期间暂停，保存和冲突状态使用文字反馈；切换内容保留草稿。具体会话和保存行为以应用代码及使用指南为准。

## Do's and Don'ts

### Do:

- **Do** 让标题、正文与编辑模式共享清晰层级，让属性处于次级位置。
- **Do** 使用同一组语义颜色覆盖浅色、深色及系统主题。
- **Do** 分别验证 900px、720px 窗口和恢复宽窗口后的布局偏好。
- **Do** 让界面密度、正文字号和阅读字体各自承担自己的设置职责。
- **Do** 使用已实现的导航 SVG 与可见焦点、选中、禁用反馈。

### Don't:

- **Don't** 恢复顶部独立空间导航或把设置改回模态工作区。
- **Don't** 在进入 AI 编辑时改变正文的字体层级、列表缩进或引用结构。
- **Don't** 将旧样式文件中已被覆盖的渐变、眉题和浮起正文卡片作为新页面规范。
- **Don't** 把尚未独立批准的设计契约、图片或视觉审阅结论写成既成事实。
