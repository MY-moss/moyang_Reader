# Moyang Reader Modernization — 并行执行任务板

> Tracking: #464  
> 详细架构：`MODERNIZATION-CAMPAIGN.md`  
> UI 规范：`UI-NEXT-SPEC.md`  
> 本文件只维护**当前 1–2 个波次的可执行/阻塞状态**，不要复制完整长期路线。

---

## 0. AI 选择规则

普通开发仍看 `docs/AI-TASKS.md`。

只有明确进入 #464 Modernization Campaign 时才看本文件。

### 允许并行

不同 Track 的任务满足以下全部条件即可同时开发：

1. 状态是 `READY`；
2. `Depends on` 已满足；
3. `Write-set` 不重叠；
4. 没有开放 PR 正在做同一任务；
5. shared conflict zone 没有被另一活动任务占用。

### 一个 Agent 怎么选

优先：

```text
同 Track 第一个 READY
```

如果该 Track 已有活动 PR，选择其他 Write-set 不冲突的 Track。

不要为了并行跳过 BLOCKED 依赖。

---

# Wave 0 — 现在就能做

## MOD-00 — 清除 PR 模板旧审批状态机

**状态：DONE — 当前 Modernization planning PR**  
**Track:** D  
**Risk:** Green  
**Write-set:** `.github/pull_request_template.md`

### 完成内容

- 删除 T0/T1/T2/T3；
- 删除 `AWAITING_APPROVAL`；
- 删除 `ai:finish` / `ai:render`；
- 删除批准队列；
- 改为 Track / Risk lane / Write-set / Compatibility / 实际验证。

---

## MOD-01 — CI scope detector（只计算，不改 workflow）

**状态：READY**  
**Track:** D  
**Risk:** Green  
**Depends on:** Modernization planning PR merged  
**Write-set:**

```text
scripts/ci-scope.mjs
scripts/ci-scope.test.mjs
package.json（仅增加 check/test script；如果可以直接 node --test 则尽量不改）
```

### 目标

根据 base/head changed paths 输出机器可读 scope，给 MOD-02 使用。

### 输入

优先支持：

```text
node scripts/ci-scope.mjs --base <sha/ref> --head <sha/ref>
```

测试可以直接调用纯函数：

```js
classifyChangedPaths(paths)
```

### 输出

JSON：

```json
{
  "docs": false,
  "frontend": true,
  "ui": true,
  "rust": false,
  "desktop": false,
  "release": false,
  "full": false,
  "reasons": ["src/app/components/... -> ui"]
}
```

### Classification minimum

#### docs-only

```text
*.md
docs/**
```

但以下 docs/process 文件变化可仍 docs-only：

```text
AGENTS.md
CONTRIBUTING.md
.github/pull_request_template.md
```

#### frontend

```text
src/**/*.ts
src/**/*.tsx
src/**/*.css
```

#### ui

```text
src/**/components/**
src/ui/**
*.css
e2e/**
playwright config
```

#### rust/desktop

```text
src-tauri/**
desktop-e2e/**
bridge/IPC contract shared files
```

#### release

```text
.github/workflows/release*.yml
updater/release scripts
src-tauri/tauri.conf*
version/signing/update manifest files
```

#### force full

至少：

```text
package.json
package-lock.json
vite.config.*
tsconfig*
Cargo.toml
Cargo.lock
.github/workflows/ci.yml
shared test config
scope classifier itself when used by CI
```

具体列表以仓库真实路径补齐。

### Fail-safe

任何未知/无法分类的 infrastructure path：

```text
full = true
```

宁可多跑，不可错误跳过。

### 验收

- [ ] docs fixture -> docs-only
- [ ] component CSS -> frontend+ui
- [ ] pure app logic -> frontend
- [ ] Rust -> rust+desktop
- [ ] release -> release/full as defined
- [ ] package/CI config -> full
- [ ] unknown infra -> full
- [ ] pure classifier unit tests 不依赖 GitHub API

### 不做

- 不修改 `.github/workflows/ci.yml`；
- 不决定具体 job graph；
- 不减少 main full tests。

---

## MOD-03 — Build / Bundle baseline reporter

**状态：READY**  
**Track:** D  
**Risk:** Green  
**Depends on:** planning PR merged  
**Write-set:**

```text
scripts/bundle-report.mjs
scripts/bundle-report.test.mjs（如有纯解析逻辑）
docs/performance/ 或临时 fixture 规则（不要提交 dist）
package.json（只有必要时）
```

### 目标

给现代化提供 baseline，避免“看起来更模块化但启动 bundle 大幅变重”。

### 输出 JSON

至少：

```json
{
  "generatedAt": "...",
  "entryJsBytes": 0,
  "entryCssBytes": 0,
  "chunks": [
    {"file":"...","bytes":0,"gzipBytes":0}
  ],
  "largest": []
}
```

### 原则

- 从构建 manifest / dist metadata 读取；
- 不把 `dist/` 提交仓库；
- 第一阶段只记录 baseline，不设任意硬门槛；
- 后续 PR 可比较 before/after。

### 验收

- [ ] `npm run build` 后可生成 report；
- [ ] 结果稳定排序；
- [ ] 不含本机绝对路径；
- [ ] optional lazy chunk 单独可见。

---

## MOD-UI-00 — Current UI screenshot baseline

**状态：READY**  
**Track:** C  
**Risk:** Green  
**Depends on:** planning PR merged  
**Write-set:**

```text
e2e/visual-baseline.spec.ts（或按当前测试命名）
Playwright screenshot config（只有必要时）
相关固定 fixture
```

### 目标

在改 UI 前把 current main 的稳定场景固定下来，后续比较“真的更清楚”而不是凭记忆。

### 场景

最小：

```text
empty
reading Markdown
editing Markdown
quick open
settings
context/inspector current state
```

### 尺寸

```text
720x900
900x900
1240x900
```

至少 light；dark 可先覆盖 reading/settings 两个代表场景。

### 注意

baseline 目标是布局/密度观察，不要建立超大 brittle pixel matrix。

### 验收

- [ ] fixture deterministic；
- [ ] animation/reduced motion 稳定；
- [ ] 不包含用户本机路径/私人文档；
- [ ] screenshot failure 可读。

---

# Wave 1 — 当前 controller 链合并后

当前依赖链：

```text
#449 IPC contract
 -> #458 runtime validation
 -> #459 settings controller
 -> #463 document session controller
```

以下任务不得重新实现这四个 PR 已经做过的东西。

---

## MOD-10 — AppRuntime skeleton

**状态：BLOCKED — 等 #449/#458/#459/#463 落地**  
**Track:** A  
**Risk:** Green  
**Write-set:**

```text
src/core/runtime/**
src/app/bootstrap/**
App.tsx（shared zone，仅本任务获得写权）
相关 tests
```

### 目标

建立真实 composition root，但第一批只装入现有已提取服务：

```text
settings
document session
notifications（若边界可直接复用）
```

### 禁止

- 不一次建立 AI/Plugin/Reading Inbox 空 service；
- 不搬所有 state；
- 不创建万能 Service Locator；
- 不改用户行为。

### 验收

- [ ] runtime 可在 test 中用 fake dependency 创建；
- [ ] App 不再直接构造已迁移 service；
- [ ] 当前启动/设置/文档 lifecycle 行为等价；
- [ ] AppRuntime 不 import Tauri raw invoke。

---

## MOD-11 — Domain state strategy spike

**状态：BLOCKED — 等 MOD-10**  
**Track:** A  
**Risk:** Green  
**Write-set:**

```text
src/core/runtime/state-spike/** 或一个低风险真实 domain
相关 tests
```

### 目标

用一个低风险 domain 比较：

```text
Zustand vanilla store + selector
vs
controller + useSyncExternalStore
```

### 选择标准

不是代码行数，而是：

- component subscription 粒度；
- test simplicity；
- React independence；
- cancellation/async service 边界；
- future feature composition；
- bundle impact。

### 产物

PR 必须记录选型结论：

```text
Adopt Zustand / Do not adopt Zustand
```

如果不值得，不引入依赖。

---

## MOD-20 — Token v2 foundation

**状态：READY AFTER UI baseline**  
**Track:** C  
**Risk:** Green  
**Depends on:** MOD-UI-00  
**Write-set:**

```text
src/ui/styles/tokens.css
src/ui/styles/themes.css
极少量 bridge import/style entry
```

### 目标

建立新 shell 可消费的 token，不一次迁所有旧 CSS。

### 必须包含

```text
colors
font sizes 12/13/14/16/18/20
spacing 4/8/12/16/20/24/32
control heights 28/32/36
radius 6/8/10+
motion 120–180ms
focus
```

### 禁止

- 不全局 search/replace 旧 token；
- 不借机重做所有 reader CSS；
- 不引入 Tailwind/CSS-in-JS。

---

## MOD-21 — Menu/Dialog/Popover primitive first slice

**状态：BLOCKED — 等 MOD-20**  
**Track:** C  
**Risk:** Green  
**Write-set:**

```text
src/ui/primitives/**
相关 component tests/e2e fixture
```

### 第一 PR 只做

建议从重复 `<details>` 最痛的：

```text
Menu/Popover foundation
```

或 Settings 依赖的：

```text
Dialog foundation
```

一次不要同时造 9 个 primitive。

### 验收

- Escape；
- outside click；
- keyboard nav（适用）；
- collision；
- focus restore；
- high contrast；
- reduced motion。

---

## MOD-40 — Stable AppError first Rust slice

**状态：BLOCKED — 等 #458 contract/runtime validation 可承接**  
**Track:** B  
**Risk:** Yellow  
**Write-set:**

```text
src-tauri/src/app_error.rs
3–5 个选定 read-only command
对应 TS contract/error mapping
相关 Rust/bridge tests
```

### 目标

把跨 IPC 错误从自然语言字符串逐步升级为：

```text
code + message + details
```

### 第一批

优先 read-only，降低迁移风险。

### 禁止

- 不一次迁全部 Rust command；
- 不顺手拆 commands.rs 其他领域；
- 不改正常成功 payload。

---

# Wave 2 — Runtime + UI shell 可并行后

本波次只在前一依赖满足后标 `READY`，不要现在抢跑。

## MOD-12 — CommandService first consumers

**状态：BLOCKED**  
**Track:** A

第一批只迁：

```text
quick open
sidebar toggle
inspector toggle
current-document search
```

TopBar/Command Palette/shortcut 消费同一 command state。

---

## MOD-22 — Activity Rail shell

**状态：BLOCKED**  
**Track:** C

只显示：

```text
Files
Search
Settings
```

不放未来 feature 占位。

---

## MOD-23 — Dedicated SettingsDialog

**状态：BLOCKED**  
**Track:** C/A coordination

依赖 SettingsService boundary + Dialog primitive。

迁当前真实 settings，不加新功能。

---

## MOD-41 — Workspace listing/watcher Rust module

**状态：BLOCKED**  
**Track:** B

行为等价拆 domain；Tauri command facade name 保持。

---

## MOD-50 — FeatureRegistry first real use

**状态：BLOCKED**  
**Track:** E

只有当 Shell/Command/Settings 至少有两个真实 contribution 场景时才开始。

不要现在造空插件框架。

---

# Shared conflict ownership

每个活动 PR 在描述中填：

```text
Shared files claimed:
```

当前默认 shared zone：

```text
src/app/App.tsx
src/app/styles.css
package.json
package-lock.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
vite.config.ts
.github/workflows/ci.yml
```

如果目标 PR 必须改其中一个，其他 Track 不同时碰同一文件。

---

# 状态更新规则

只允许：

```text
READY
IN_PROGRESS — PR #xxx
BLOCKED — reason
DONE — PR #xxx
CANCELLED — reason
```

不增加 approval/status machine。

任务完成：

1. 当前 PR 把任务改 `DONE — PR #...`；
2. 如果下一任务依赖已满足，将它 `BLOCKED` 改 `READY`；
3. 不顺手实现下一任务；
4. 不自动一次把整个 M0–M8 展开成 80 个 TODO。
