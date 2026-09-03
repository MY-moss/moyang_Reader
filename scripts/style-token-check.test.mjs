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
const spacingTokens = [
  "space-1",
  "space-2",
  "space-3",
  "space-4",
  "space-5",
  "space-6",
  "space-7",
  "space-8",
  "space-9",
  "space-10",
  "space-11",
  "space-12",
  "space-13",
  "space-14",
  "space-15",
  "space-16",
];
const governedSpacingSelectors = [
  ".topbar",
  ".brand-block",
  ".toolbar",
  ".toolbar-button",
  ".toolbar-overflow-panel",
  ".toolbar-overflow-group",
  ".toolbar-overflow-actions",
  ".findbar",
  ".sidebar",
  ".workspace-panel",
  ".workspace-heading",
  ".workspace-actions",
  ".workspace-create-menu-panel",
  ".workspace-file, .workspace-result",
  ".workspace-folder",
  ".statusbar",
];

function countRawColorLiterals(value) {
  return [...value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)].length;
}

function ruleBodies(selector) {
  const selectorPattern = selector
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? "\\s*" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return [...styles.matchAll(new RegExp(`^${selectorPattern}\\s*\\{([^}]*)\\}`, "gm"))].map((match) => match[1]);
}

function countRawSpacingLiterals(value) {
  return [
    ...value.matchAll(
      /(?:gap|margin(?:-(?:top|right|bottom|left|block|inline))?|padding(?:-(?:top|right|bottom|left|block|inline))?)\s*:\s*[^;{}]*\b\d+(?:\.\d+)?px\b/g,
    ),
  ].length;
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

test("keeps app chrome and workspace density behind spacing tokens", () => {
  for (const token of spacingTokens) {
    assert.match(styles, new RegExp(`--${token}\\s*:`), `缺少间距令牌 --${token}`);
  }

  const blocks = governedSpacingSelectors.flatMap((selector) => {
    const matches = ruleBodies(selector);
    assert.notEqual(matches.length, 0, `找不到受治理的样式规则：${selector}`);
    return matches.map((body) => ({ selector, body }));
  });

  for (const { selector, body } of blocks) {
    assert.equal(countRawSpacingLiterals(body), 0, `${selector} 仍直接写入间距像素值，应使用 --space-* 令牌`);
  }

  assert.ok(
    countRawSpacingLiterals(styles) <= 445,
    `原始间距声明超过本批预算：${countRawSpacingLiterals(styles)} > 445`,
  );
});
