import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const measuredCoverageBaseline = {
  // First real all-source measurement on 2026-09-04 (95 files / 378 tests).
  // These values are the floor for this slice; future changes may only raise them.
  statements: 42.69,
  branches: 38.69,
  functions: 51,
  lines: 44.05,
} as const;

const criticalLogicCoverage =
  "src/app/{bookmarks,document-transition,draft-recovery,editor-history,external-change,markdown-path,pane-layout,path-key,portable-settings,preferences,print-preview,quick-open,reader-mode,reading-position,reading-rail,reading-zoom,search-highlighter,source-render-scheduler,tab-order,update-recovery,wiki-link-completion,workspace-entry,workspace-filter,workspace-refresh,workspace-switcher,workspace-tree}.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    define: {
      __MOYANG_DESKTOP_E2E__: env.VITE_MOYANG_DESKTOP_E2E === "1",
    },
    plugins: [react()],
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary", "lcov"],
        // Instrument every shipped TypeScript module so App and UI coverage cannot
        // disappear behind an implicit include list.
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
        thresholds: {
          ...measuredCoverageBaseline,
          [criticalLogicCoverage]: {
            lines: 90,
            branches: 80,
          },
        },
      },
    },
  };
});
