# Moyang Reader UI Next — 桌面阅读工作台设计与交互规范

> Tracking: #464  
> 配套：`docs/MODERNIZATION-CAMPAIGN.md`  
> 状态：目标 UI/交互规范；通过 M2/M3/M7 分阶段迁移，不要求一次性 Big Bang  
> 适用：Windows x64 desktop；浏览器仅用于 UI 开发/测试

---

## 0. 设计目标

Moyang Reader 的 UI 不应该继续像“功能不断塞进工具栏的 Markdown 工具”，而要成为：

> **安静、克制、桌面原生感强、能长期阅读、但随功能增长仍保持清楚的个人阅读工作台。**

UI Next 解决的是五个问题：

1. 顶栏承载太多：打开、搜索、编辑、保存、专注、侧栏、右栏、更新、设置、导出都混在一起；
2. 设置藏在 More 菜单的嵌套 `<details>` 中，不适合以后继续增加 Reading Inbox / AI / Provider / Advanced；
3. Workspace / Context 侧栏已经承担多个领域，未来再继续加功能会越来越挤；
4. 当前 chrome 字号存在 9 / 10 / 11px 级别，桌面 DPI 下容易显得局促和廉价；
5. UI 组件与业务通过大量 props/callback 接线，新功能必须改多个核心组件。

本规范不是“换一套配色”。目标是同时改：

```text
Information Architecture
Component Boundary
Contribution Boundary
Visual Density
Typography
Navigation
Settings
Inspector
Responsive Desktop Layout
Accessibility
```

---

# 1. 视觉判断的证据边界

本规范基于当前源码、CSS token、组件结构和现有交互契约做审计。

**没有把“没有实际看过当前运行截图”伪装成视觉实机评审。**

因此可以确认的是：

- 当前信息架构过度集中在 TopBar/WorkspacePanel/ContextPanel；
- 9–11px chrome token 会带来可读性和精致度风险；
- 多层菜单与大量功能入口的层级需要重做；
- 全局 `styles.css` 让设计一致性难以继续扩展。

真正开始 M2 UI 实现时，必须补一组 current-main screenshot baseline，再逐场景对比 UI Next。

---

# 2. 整体布局

## 2.1 宽屏完整布局

```text
┌──────┬────────────────────────┬─────────────────────────────────────┬────────────────────────┐
│      │                        │ Command Bar                         │                        │
│ Rail │ Feature Sidebar        ├─────────────────────────────────────┤ Inspector              │
│      │                        │ Tabs                                │                        │
│      │                        ├─────────────────────────────────────┤                        │
│Files │ 当前 Activity 内容     │                                     │ Outline                │
│Search│                        │ Reader / Editor                     │ Properties             │
│Read* │                        │                                     │ Bookmarks              │
│Know* │                        │                                     │ Annotations            │
│AI*   │                        │                                     │ AI*                    │
│      │                        │                                     │                        │
│      │                        ├─────────────────────────────────────┤                        │
│ ⚙    │                        │ Status                              │                        │
└──────┴────────────────────────┴─────────────────────────────────────┴────────────────────────┘
```

`*`：只有对应 feature 真正启用后才显示。

## 2.2 默认尺寸

```text
Activity Rail       48px fixed
Feature Sidebar     280px default
                    240px min
                    360px max
Inspector           320px default
                    280px min
                    420px max
Command Bar         44px
Tabs                36px
Status Bar          24px
Document Area       min 420px practical target
```

拖拽宽度继续支持本地持久化。

双击 resize handle 恢复默认。

## 2.3 最小窗口

保留当前产品 Windows 最小宽度：

```text
720px
```

但是 720px 下不强求同时看到三栏。

### >= 1240px

```text
Rail + Sidebar + Document + Inspector
```

### 901–1239px

```text
Rail + Sidebar + Document
Inspector 可切换为 overlay/drawer
Command Bar 收纳次要动作
```

### 761–900px

```text
Rail + Document
Sidebar / Inspector 均为 mutually-aware drawer
```

### 720–760px

```text
Rail 仍保留
Document 为绝对优先
Sidebar/Inspector 只能 overlay
Command Bar 只保留核心 IconButton + More
```

不做手机式 bottom nav。

---

# 3. Activity Rail

## 3.1 目标

Activity Rail 是“我现在在做什么”的一级导航，不是快捷按钮仓库。

默认只显示真实存在的 Activity：

```text
Files
Search
```

未来按 feature 开关出现：

```text
Reading       # Reading Inbox 完成后
Knowledge     # 知识库 feature 达到可用形态后
AI            # AiProvider/assistant 真正启用后
```

底部固定：

```text
Settings
```

## 3.2 禁止占位

不要现在放：

```text
AI (Coming soon)
RSS
Plugins
MCP
```

没有可用功能就不要显示入口。

## 3.3 交互

每个 Activity：

- 40×40 或 36×36 的视觉 target；
- Rail 自身宽 48；
- icon 18px；
- tooltip 显示名称 + shortcut（有则显示）；
- `aria-current="page"` 或等价选中语义；
- 支持 `Ctrl+1/2/...` 需等实际 activity 数稳定后再决定，不先冻结；
- Activity 切换不能改变当前文档；
- Activity 只改变左侧 Feature Sidebar 内容。

---

# 4. Feature Sidebar

Feature Sidebar 不再永远等于“文件树”。

不同 activity 提供不同 sidebar：

```text
Files
├─ 当前阅读库
├─ 文件树
├─ Library filters
└─ Recent / Reading history（需重新权衡位置）

Search
├─ query
├─ scope
├─ filters
└─ results

Reading（future）
├─ Today
├─ Inbox
├─ Reading
├─ Finished
└─ All

Knowledge（future）
├─ Tags
├─ Collections
└─ Saved Search

AI（future）
├─ sessions/history（真正实现后）
└─ provider status
```

## 4.1 Files Sidebar

第一层不要继续用：

```text
WORKSPACE
阅读库
```

这种重复 kicker + title。

建议：

```text
[Library name ▼]          [+]
path/status secondary text
────────────────────────────
filter/search affordance
────────────────────────────
Tree
```

将“新建、切换库、添加库”放入 library header 的清楚动作。

批量导出不应长期占 Files Sidebar 一级工具栏；它属于 Export feature/command。

## 4.2 Sidebar header

高度建议：

```text
44px
```

标题：13–14px semibold。

Secondary path/status：12px muted。

---

# 5. Command Bar

## 5.1 职责

Command Bar 只放“当前工作上下文最常用动作”。

不要重新把所有功能塞回去。

### 左区

```text
Back
Forward
Open / Quick Open
```

Back/Forward 只有有历史时 enabled。

### 中区

```text
Document title
Dirty indicator
External modified indicator
```

标题以文档为中心，不再让大块品牌区长期占 top chrome。

### 右区

根据上下文最多：

```text
Read/Edit mode
Save（只有需要时强调）
Find in document
Reading Appearance (Aa)
Layout / Inspector toggle
More
```

`Quick Open` 可按宽度从文字按钮退化为 icon。

## 5.2 品牌

Moyang Reader Logo 应用于：

- 启动/空状态；
- About；
- Settings header（可选）；
- installer/OS icon。

不需要在每秒都显示的大型 TopBar 左边持续占位。

## 5.3 Save

建议：

- 阅读模式无 dirty 时不强占主动作；
- editable + dirty 时显示清楚 Save；
- Ctrl+S 永远存在；
- 保存中/保存失败由 status/notification 反馈。

## 5.4 More

More 放低频当前文档动作：

```text
Copy rich text
Focus mode
Print / Export
Recovery（有数据时）
Open in Explorer
Document details
```

不要把完整 Settings 再塞进 More。

---

# 6. Dedicated Settings Dialog

## 6.1 为什么必须独立

未来设置会出现：

```text
Reading
Editor
Library
Import/Export
Features
Reading Inbox
AI
Provider
Advanced
Privacy
```

继续使用 TopBar 内 nested details 会变成无法维护的信息架构。

## 6.2 Dialog

建议尺寸：

```text
width: 820px default
max-width: min(900px, 92vw)
height: min(720px, 86vh)
```

内部：

```text
┌────────────────────┬───────────────────────────────────┐
│ General            │ Section Title                     │
│ Reading            │                                   │
│ Editor             │ settings rows                     │
│ Library            │                                   │
│ Import & Export    │                                   │
│ Features           │                                   │
│ Advanced           │                                   │
│                    │                                   │
└────────────────────┴───────────────────────────────────┘
```

## 6.3 基础分区

第一阶段：

```text
General
Reading
Editor
Library
Import & Export
Features
Advanced
```

`Features` 里启用可选模块。

只有模块可用后才动态贡献：

```text
Reading Inbox
AI
```

## 6.4 Settings row

每个设置项结构固定：

```text
Label
Description
                 Control
```

Desktop 中不要把一长段 checkbox label 挤成密集移动端表单。

## 6.5 保存

保持当前 local-first 自动保存模型。

Dialog 只显示：

```text
Saving…
Saved locally
Save failed
```

不增加“应用”按钮，除非某设置确实要求 deferred apply。

---

# 7. Reading Appearance (`Aa`)

阅读排版是高频、局部设置，不应该必须进入完整 Settings。

Command Bar `Aa` 打开轻量 popover：

```text
Text size       [-] 100% [+]
Reading width   Narrow | Standard | Wide
Theme           System | Light | Dark
```

可选未来：

```text
Font family
Line height
```

但是第一阶段只迁当前真实设置。

所有控制与 Settings > Reading 是同一 SettingsService 数据源。

---

# 8. Document Area

## 8.1 层级

```text
Command Bar
Tabs
Document Surface
Status
```

Document Surface 自身只有一个主要滚动容器。

## 8.2 Reader page

视觉原则：

- App chrome：中性、低存在感；
- Reader：略暖纸面；
- 减少全屏 gradient；
- 减少无意义 card shadow；
- 文档正文永远是视觉主体。

建议正文宽度：

```text
narrow:   ~620–660px
standard: ~720–780px
wide:     ~900–980px
```

不是硬编码某个单值；最终受现有 reading zoom/width 逻辑和真实排版测试约束。

## 8.3 阅读字号

普通正文目标：

```text
16–18px visual range
中文默认建议约 17px
line-height 1.7–1.8
```

标题层级应通过 size/weight/spacing，而不是大量颜色区分。

## 8.4 Paper surface

Light：

```text
App canvas: neutral cool/light gray
Reading surface: warm near-white
```

Dark：

```text
App canvas: dark charcoal
Reading surface: slightly raised charcoal
```

不使用纯 #000 阅读大面积正文。

---

# 9. Tabs

保持现有能力：

- reorder；
- middle-click close；
- context menu；
- unsaved protection；
- keyboard roving。

视觉收口：

```text
height: 36px
title: 12–13px
close: on hover / active / dirty safety state
```

当前 tab 与 inactive tab 的区分优先使用：

- surface；
- text emphasis；
- 2px indicator 或 border。

不要使用大块高饱和 accent。

---

# 10. Inspector（替代固定 ContextPanel）

## 10.1 目标

Inspector 是“当前文档的附加信息区域”。

内置 tab：

```text
Outline
Properties
Bookmarks
Annotations
Links
```

顺序可基于真实使用调整。

未来 contribution：

```text
Article Metadata
AI
Citation
EPUB Chapter info
```

## 10.2 不再使用固定数组硬编码所有未来 tab

目标接口：

```ts
interface InspectorTabContribution {
  id: string;
  label: () => string;
  icon?: IconName;
  order?: number;
  visible(ctx: InspectorContext): boolean;
  render(ctx: InspectorContext): ReactNode;
}
```

第一阶段只允许 built-in feature 注册。

## 10.3 Tab UI

当 5+ tabs 时，不推荐全部用文字横排硬塞。

方案优先级：

### 方案 A — icon + tooltip tab rail

适合 280–320px inspector。

### 方案 B — top segmented tabs + overflow

如果用户测试证明文字更清楚再采用。

不要因为实现方便继续让 6–8 个文字 tab 平铺。

## 10.4 Reading progress

Reading Rail 不再强制占 Inspector 顶部大块位置。

推荐：

- Command/Status 提供轻量进度；
- Outline 中显示 current heading；
- progress-specific block 可作为 Reader contribution。

避免 Inspector 顶部先出现 Document card + Progress card + Tabs，导致正文附加信息被挤到下面。

---

# 11. Search

当前三种搜索语义必须继续分开：

```text
Ctrl+P          Quick Open / find document
Ctrl+F          Find in current document
Search Activity Workspace content search
```

## Search Activity

Feature Sidebar：

```text
Query input
Scope/filter chips
Result count
Result list
```

不要把 workspace search 和 Files tree filter 做成两个长得一样的输入框放在同一区域。

---

# 12. Command Palette

Command Palette 成为所有 command contribution 的统一入口。

应包含：

```text
command label
shortcut
category
optional state hint
```

后续可支持：

```text
> commands
@ files
# headings
```

但第一轮不做多 provider palette parser，先把 CommandService 打通。

---

# 13. Notification / Status

## Notification

用于：

- error；
- completed action；
- recoverable warning。

不要用于：

- 每次保存成功都弹 toast；
- hover hint；
- 长期状态。

## Status Bar

24px，低对比。

可放：

```text
current path (truncated)
document kind
word count / reading time
save/index state
```

只显示当前上下文，避免复制 TopBar 所有状态。

---

# 14. Typography v2

## 14.1 UI font

优先 Windows 可预测性：

```css
--font-ui:
  "Segoe UI Variable",
  "Segoe UI",
  "Microsoft YaHei UI",
  system-ui,
  sans-serif;
```

不再把 `Avenir Next` 作为第一 UI font，因为 Windows 环境不保证存在，导致开发截图与多数用户实际字体不一致。

## 14.2 UI scale

建议：

```text
--font-xs       12px
--font-sm       13px
--font-md       14px
--font-lg       16px
--font-xl       18px
--font-2xl      20px
```

**常规 chrome 不再使用 9/10/11px。**

若极少数 secondary diagnostic 确需更小，最低 11px 且必须经过 DPI/对比测试；普通 label/caption 最低按 12px 设计。

## 14.3 Kicker

减少：

```text
WORKSPACE
CONTEXT
PROPERTIES
FRONTMATTER
```

这种重复全大写 kicker。

有真实分组需要时用：

```text
12px muted section label
```

而不是 9px uppercase decorative text。

---

# 15. Spacing / Density

建议使用简单 4px 基准：

```text
4
8
12
16
20
24
32
```

不要继续维护大量 3/4/5/6/7/8/9/10/11/12/13 等几乎相邻的 spacing token，除非真实组件证明需要。

## Control height

```text
compact icon/button: 28px
normal control:      32px
prominent control:   36px
```

桌面阅读器需要 compact，但不是 microscopic。

---

# 16. Radius / Shadow

```text
small radius: 6px
medium:       8px
large/dialog: 10–12px
```

Shadow 只给：

- menu；
- popover；
- dialog；
- overlay floating surface。

Sidebar、tabs、普通 section 不靠阴影制造层级。

---

# 17. Color

保留现在已经建立的 teal/greenish accent 方向，但降低“设计靠 accent 色”的比重。

语义：

```text
canvas
surface
surface-raised
surface-hover
surface-selected
text
text-muted
border
accent
accent-hover
accent-soft
danger
warning
success
```

Reader paper 与 App chrome 允许有轻微冷暖区别。

Accent 只用于：

- active/focus；
- primary action；
- link；
- selected indicator。

不要整块侧栏大面积 teal background。

---

# 18. Motion

Desktop micro motion：

```text
120–180ms
```

用途：

- hover/focus surface；
- popover/dialog enter；
- sidebar/inspector drawer；
- tab indicator。

不做：

- Reader 内容大幅位移 transition；
- 每次切文件 crossfade；
- spring-heavy UI；
- decorative loading animation。

`prefers-reduced-motion` 保持即时或接近即时。

---

# 19. UI Primitives

不要一开始造完整组件库。

第一批只提取重复行为最多、最容易出现 accessibility 差异的 primitive：

```text
Button
IconButton
Menu
Popover
Dialog
Tabs
Tooltip
Toast
SegmentedControl
```

之后按真实重复再增加：

```text
Select
Switch
Field
EmptyState
List/Tree helpers
```

## 19.1 Menu

统一：

- placement；
- viewport collision；
- Escape；
- click outside；
- Arrow navigation；
- focus restore；
- disabled state。

最终淘汰多个 feature 各自手写 document-level pointerdown listener 的模式。

## 19.2 Dialog

统一：

- focus trap；
- Escape policy；
- initial focus；
- title/description aria；
- close focus restore；
- dangerous action style。

---

# 20. Accessibility

必须保持或提升现有基线。

## Focus

```text
2px visible ring
2px offset where appropriate
```

不要只靠 border color。

## Keyboard

所有 Activity/Tabs/Menu/Tree/Dialog：

- predictable tab stop；
- Arrow where ARIA pattern requires；
- Escape closes transient surface；
- close restores logical trigger focus。

## High Contrast

Windows high contrast 不依赖 background-image/box-shadow 才能看出 selection/focus。

## Reduced Motion

所有新 motion token 必须有 reduced path。

## Text

12px chrome 不是豁免对比要求。

---

# 21. Optional Feature UI Contract

任何 optional feature：

### disabled

- Activity 不显示；
- Settings 中只有 enable/config entry（视产品需要）；
- Inspector contribution 不显示；
- Command contribution invisible；
- 不加载 heavy UI chunk；
- 不启动 timer/network。

### enabled

由 FeatureRegistry 注册：

```text
ActivityContribution
CommandContribution
SettingsSectionContribution
InspectorTabContribution
```

不要求修改 AppShell JSX。

---

# 22. Reading Inbox 如何进入 UI Next

未来 Reading Inbox：

```text
Activity Rail
  Reading
```

Sidebar：

```text
Today
Inbox
Reading
Finished
All
```

Document Area：

仍然是普通 Markdown Reader。

Inspector：

可贡献：

```text
Article Info
```

Settings：

```text
Features > Reading Inbox
Reading Inbox section
```

这正是 UI Next 必须先解决 contribution boundary 的原因。

---

# 23. AI 如何进入 UI Next

AI 不默认变成永久第四/第五栏。

第一阶段：

```text
Command contribution
Inspector tab contribution
Settings contribution
```

例如：

```text
Explain selection
Translate selection
Ask about section
```

只有后续真实使用证明需要长期 session/activity，才增加 `AI` Activity。

避免一开始复制 Cursor/ChatGPT 式永久聊天侧栏，把阅读器变成 AI Client。

---

# 24. 当前组件迁移映射

## `TopBar.tsx`

拆到：

```text
CommandBar
ReadingAppearancePopover
SettingsDialog（独立）
Export commands/menu
Update settings/status
```

## `WorkspacePanel.tsx`

拆到：

```text
FilesActivity
LibraryHeader
LibrarySidebar
WorkspaceTree
ReadingHistory（重新确定入口）
Workspace search -> Search Activity
Batch export -> Export command
```

## `ContextPanel.tsx`

演变到：

```text
Inspector
built-in Inspector tabs
Reader-specific contributions
```

## `App.tsx`

最终只组合：

```tsx
<AppShell />
<GlobalOverlays />
```

核心状态来自 service/store selector。

---

# 25. Current UI -> UI Next 迁移过程

不要一次换整张 UI。

推荐顺序：

```text
1. token v2
2. primitives
3. SettingsDialog
4. ActivityRail
5. new CommandBar
6. Files Activity migration
7. Search Activity migration
8. Inspector migration
9. Reader chrome migration
10. delete legacy TopBar/WorkspacePanel/ContextPanel styles
```

每个阶段当前 Reader/Editor 仍应可用。

---

# 26. Visual Regression Matrix

只覆盖稳定场景，不制造 100 张脆弱截图。

## Core scenes

```text
empty / first launch
reading Markdown
editing Markdown
quick open
command palette
settings
document search
inspector outline
confirmation dialog
```

## Width

```text
720
900
1240
```

## Theme

至少：

```text
light
dark
```

High contrast 以 semantic/assertion + 少量手动/fixture 为主，不追求截图像素一致。

---

# 27. UI 实现验收模板

每个 UI MOD slice 必须回答：

```md
### User task
用户来这里完成什么？

### Before
当前步骤/问题是什么？

### After
用户现在少了哪一步 / 更清楚什么？

### Interaction
Mouse:
Keyboard:
Focus restore:
720px:
900px:
1240px:

### Accessibility
Role:
Name:
State:
High contrast:
Reduced motion:

### Visual
Tokens used:
No hard-coded theme values:
Screenshot fixture:

### Regression
Reader:
Editor:
Workspace:
```

不能只写“更美观”。

---

# 28. 明确禁止的 UI 反模式

后续 AI 不得：

- 为了现代感把所有区域做成圆角 Card；
- 使用玻璃拟态/blur 作为主 UI；
- 做巨大 Dashboard 首页代替阅读路径；
- 把所有按钮只做 icon 且没有 tooltip/aria；
- 使用 9px / 10px 正常 UI 文本；
- 随意加入渐变、发光、彩色阴影；
- 给每个 feature 新造一套 button/menu/dialog；
- 用 CSS-in-JS 解决 styles.css 过大的问题；
- 引入完整 UI 框架只为了 Button/Dialog；
- 把 Setting 继续塞进 More 二级/三级菜单；
- 在窄屏用横向滚动保存所有 toolbar action；
- 让 feature disabled 时留下灰色占位入口；
- 用“看起来更高级”覆盖可读性/键盘/a11y；
- 为重构删掉 source mode / recovery / external change protection。

---

# 29. 第一阶段 UI 验收目标

M2/M3 初步完成时，即使未来 feature 尚未实现，也应该达到：

1. Settings 已从 TopBar 抽离；
2. Files/Search 有清楚一级导航；
3. 顶部只剩真正高频当前任务动作；
4. 右侧成为 Inspector，而不是未来 tab 数量写死的 ContextPanel；
5. 12px 以下文本从常规 chrome 中基本消失；
6. 菜单/弹层行为来自共享 primitive；
7. 720/900/1240 下不靠隐藏横向滚动；
8. Reader 正文视觉权重高于 App chrome；
9. optional feature 有明确的 UI contribution 入口；
10. 新 UI 没有显著增加 startup entry bundle。

---

# 30. UI Agent 可直接复制的提示词

```text
你负责 Moyang Reader Modernization Track C（UI）。

必须先读：
- AGENTS.md
- docs/MODERNIZATION-CAMPAIGN.md
- docs/UI-NEXT-SPEC.md
- 当前 MOD task / Issue

只做本次 UI slice，不提前实现未来 Reading Inbox/AI。

目标不是“换皮”，而是减少用户步骤、提高信息层级、建立 contribution boundary，并保持 Windows desktop compact-but-readable。

常规 UI 文字不得新建 9/10/11px；优先 12/13/14px。保留 light/dark/high-contrast/reduced-motion。720/900/1240 都必须有明确行为。

使用现有 React/CSS/Vite；优先 CSS Modules/semantic token；不要引入 Tailwind、MUI、Ant、CSS-in-JS 或大型 design system。

任何 Menu/Dialog/Popover 新实现必须处理 keyboard、Escape、outside click、viewport collision 和 focus restore。

UI 改动至少增加/更新一个相关 Playwright 场景和必要的视觉 fixture。

不要删除文件安全、恢复、source editor、外部修改保护等功能来让新版 UI 更简单。
```
