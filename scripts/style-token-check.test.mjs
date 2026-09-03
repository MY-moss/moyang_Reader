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
  "page-background",
  "annotation-border",
  "annotation-surface",
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
const typographyTokens = [
  "type-kicker",
  "type-caption",
  "type-control",
  "type-body",
  "type-emphasis",
  "type-icon",
  "type-brand",
  "type-section",
  "type-heading",
];
const motionTokens = ["motion-file-drop", "motion-quick-open-item"];
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
const governedTypographySelectors = [
  ".brand-name",
  ".brand-subtitle",
  ".document-title",
  ".external-modified-indicator",
  ".toolbar-button",
  ".toolbar-overflow-label",
  ".toolbar-overflow-settings > .export-menu > summary::after",
  ".export-menu-panel button",
  ".settings-menu-title",
  ".settings-option",
  ".settings-option small",
  ".settings-divider",
  ".settings-select-option",
  ".settings-select-option select",
  ".settings-range-option",
  ".settings-range-footer small",
  ".settings-range-footer .quiet-button",
  ".settings-note",
  ".settings-persistence-status",
  ".settings-guide-button",
  ".settings-actions .quiet-button",
  ".findbar input",
  ".find-count",
  ".tab-label",
  ".tab-external-indicator",
  ".tab-close",
  ".workspace-action-trigger::after",
  ".workspace-create-menu-panel button",
  ".workspace-heading h2",
  ".quiet-button",
  ".workspace-location",
  ".workspace-location small",
  ".workspace-switcher-trigger",
  ".workspace-switcher-label",
  ".workspace-switcher-menu button strong",
  ".workspace-switcher-menu button span",
  ".workspace-switcher-remove",
  ".workspace-filter-summary",
  ".workspace-clear-filter",
  ".workspace-export-note",
  ".workspace-help",
  ".workspace-search",
  ".tag-filter",
  ".tag-filter select",
  ".workspace-subheading",
  ".workspace-folder-name",
  ".workspace-folder-icon",
  ".workspace-folder small",
  ".workspace-folder-caret",
  ".workspace-result strong",
  ".workspace-result span",
  ".reading-history-heading h3",
  ".reading-history-range",
  ".reading-history-metric strong",
  ".reading-history-day-value",
  ".reading-history-day-label",
  ".reading-history-empty",
  ".reading-history-clear",
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

function countRawFontSizeLiterals(value) {
  return [...value.matchAll(/font-size\s*:\s*[^;{}]*\b\d+(?:\.\d+)?px\b/g)].length;
}

function countRawTransitionDurationLiterals(value) {
  return [...value.matchAll(/transition\s*:\s*[^;{}]*\b\d+(?:\.\d+)?(?:ms|s)\b/g)].length;
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

test("keeps the page backdrop synchronized with dark theme rules", () => {
  assert.match(styles, /body\s*\{[^}]*background:\s*var\(--page-background\)/s);

  const systemDarkTheme = styles.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/s,
  );
  const explicitDarkTheme = styles.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/s);

  assert.ok(systemDarkTheme, "找不到系统深色主题规则");
  assert.ok(explicitDarkTheme, "找不到显式深色主题规则");
  assert.match(systemDarkTheme[1], /--page-background\s*:/);
  assert.match(explicitDarkTheme[1], /--page-background\s*:/);

  const forcedColorsTheme = styles.match(/@media\s*\(forced-colors:\s*active\)\s*\{\s*:root\s*\{([^}]*)\}/s);
  assert.ok(forcedColorsTheme, "找不到强制高对比度主题规则");
  assert.match(forcedColorsTheme[1], /--page-background\s*:\s*Canvas\s*;/);
});

test("keeps annotation highlights behind semantic theme tokens", () => {
  for (const token of ["annotation-border", "annotation-surface"]) {
    assert.match(styles, new RegExp(`--${token}\\s*:`), `缺少批注主题令牌 --${token}`);
  }

  assert.match(
    styles,
    /\.annotation-quote\s*\{[^}]*border-left:\s*3px solid var\(--annotation-border\)[^}]*background:\s*color-mix\(in srgb, var\(--annotation-surface\) 14%, var\(--surface\)\)/s,
  );
  assert.match(
    styles,
    /\.annotation-item:hover,\s*\.annotation-item\.current\s*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--annotation-border\) 50%, var\(--line\)\)[^}]*background:\s*color-mix\(in srgb, var\(--annotation-surface\) 15%, var\(--surface-strong\)\)/s,
  );
  assert.match(styles, /\.annotation-mark\s*\{[^}]*color:\s*var\(--annotation-border\)/s);
  assert.match(
    styles,
    /\.moyang-annotation-hit\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--annotation-surface\) 42%, transparent\)[^}]*box-shadow:\s*inset 0 -2px 0 color-mix\(in srgb, var\(--annotation-border\) 54%, transparent\)/s,
  );
  assert.match(
    styles,
    /::highlight\(moyang-annotation\)\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--annotation-surface\) 42%, transparent\)[^}]*text-decoration-color:\s*color-mix\(in srgb, var\(--annotation-border\) 60%, transparent\)/s,
  );
});

test("keeps document preview canvases behind semantic theme tokens", () => {
  for (const token of ["preview-surface", "preview-checker-light", "preview-checker-dark"]) {
    assert.match(styles, new RegExp(`--${token}\\s*:`), `缺少文档预览主题令牌 --${token}`);
  }

  assert.match(styles, /\.pdf-preview\s*\{[^}]*background:\s*var\(--preview-surface\)/s);
  assert.match(styles, /\.image-preview\s*\{[^}]*background:\s*var\(--preview-surface\)/s);
  assert.match(
    styles,
    /\.image-canvas\s*\{[^}]*background:\s*repeating-conic-gradient\(\s*var\(--preview-checker-light\)\s+0 25%,\s*var\(--preview-checker-dark\)\s+0 50%\s*\)/s,
  );

  const darkThemes = [
    styles.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/s),
    styles.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/s),
  ];
  for (const darkTheme of darkThemes) {
    assert.ok(darkTheme, "找不到深色主题令牌规则");
    assert.match(darkTheme[1], /--preview-surface\s*:\s*var\(--surface\)\s*;/);
    assert.match(darkTheme[1], /--preview-checker-light\s*:\s*var\(--inline-code-surface\)\s*;/);
    assert.match(darkTheme[1], /--preview-checker-dark\s*:\s*var\(--file-card-surface\)\s*;/);
  }

  const forcedColorsTheme = styles.match(/@media\s*\(forced-colors:\s*active\)\s*\{\s*:root\s*\{([^}]*)\}/s);
  assert.ok(forcedColorsTheme, "找不到强制高对比度主题规则");
  assert.match(forcedColorsTheme[1], /--preview-surface\s*:\s*Canvas\s*;/);
  assert.match(forcedColorsTheme[1], /--preview-checker-light\s*:\s*Canvas\s*;/);
  assert.match(forcedColorsTheme[1], /--preview-checker-dark\s*:\s*Canvas\s*;/);
  assert.match(styles, /\.pdf-preview,\s*\.image-preview,\s*\.image-canvas\s*\{[^}]*background:\s*Canvas\s*;/s);
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

test("keeps app chrome and workspace typography behind size tokens", () => {
  for (const token of typographyTokens) {
    assert.match(styles, new RegExp(`--${token}\\s*:`), `缺少字号令牌 --${token}`);
  }

  const blocks = governedTypographySelectors.flatMap((selector) => {
    const matches = ruleBodies(selector);
    assert.notEqual(matches.length, 0, `找不到受治理的字号规则：${selector}`);
    return matches.map((body) => ({ selector, body }));
  });

  for (const { selector, body } of blocks) {
    assert.equal(countRawFontSizeLiterals(body), 0, `${selector} 仍直接写入字号像素值，应使用 --type-* 令牌`);
  }

  assert.ok(
    countRawFontSizeLiterals(styles) <= 214,
    `原始字号声明超过本批预算：${countRawFontSizeLiterals(styles)} > 214`,
  );
});

test("keeps residual chrome transition durations behind motion tokens", () => {
  for (const token of motionTokens) {
    assert.match(styles, new RegExp(`--${token}\\s*:`), `缺少动效令牌 --${token}`);
  }

  const governedMotionSelectors = [
    [".file-drop-card", "motion-file-drop"],
    [".quick-open-item", "motion-quick-open-item"],
  ];

  for (const [selector, token] of governedMotionSelectors) {
    const matches = ruleBodies(selector);
    assert.notEqual(matches.length, 0, `找不到受治理的动效规则：${selector}`);
    for (const body of matches) {
      assert.match(body, new RegExp(`transition\\s*:[^;{}]*var\\(--${token}\\)`, "s"));
      assert.equal(
        countRawTransitionDurationLiterals(body),
        0,
        `${selector} 仍直接写入 transition 时长，应使用 --${token}`,
      );
    }
  }

  assert.equal(countRawTransitionDurationLiterals(styles), 0, "样式表仍包含未令牌化的 transition 时长");
});
