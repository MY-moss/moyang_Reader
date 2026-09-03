import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const stylesPath = path.resolve("src/app/styles.css");
const styles = fs.readFileSync(stylesPath, "utf8");
const semanticTokens = [
  "chrome-topbar-surface",
  "chrome-sidebar-surface",
  "chrome-statusbar-surface",
  "file-card-surface",
  "file-type-surface",
  "code-block-surface",
  "inline-code-surface",
  "table-header-surface",
  "error-border",
  "error-surface",
  "status-positive",
  "status-positive-accent",
  "status-negative",
  "status-negative-accent",
  "warning-surface",
  "workspace-foreground",
  "workspace-hover-surface",
];

function countRawColorLiterals(value) {
  return [...value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)].length;
}

test("keeps the governed palette behind semantic tokens", () => {
  for (const token of semanticTokens) {
    assert.match(styles, new RegExp(`--${token}\\s*:`), `缺少语义令牌 --${token}`);
  }

  assert.match(styles, /\.error-state\s*\{[^}]*border-color:\s*var\(--error-border\)/s);
  assert.match(styles, /\.external-change-notice\s*\{[^}]*background:\s*var\(--warning-surface\)/s);
  assert.match(styles, /\.workspace-file\.active\s*\{[^}]*background:\s*var\(--workspace-active-surface\)/s);
  assert.match(styles, /\.markdown-body code\s*\{[^}]*background:\s*var\(--inline-code-surface\)/s);
});

test("keeps dark theme component overrides token-only", () => {
  const darkComponentSelectors = styles.match(/^\s*:root(?:\[data-theme="dark"\]|:not\(\[data-theme\]\))\s+[^,{]*\./gm);

  assert.deepEqual(darkComponentSelectors, null, "深色主题不应重新添加逐组件硬编码覆盖");
  assert.ok(
    countRawColorLiterals(styles) <= 219,
    `硬编码颜色数量超过本切片预算：${countRawColorLiterals(styles)} > 219`,
  );
});
