import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    maxWorkers: 4,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      // Business modules are covered here; App/UI behavior is guarded by the Playwright smoke test.
      include: [
        "src/features/export/export.ts",
        "src/platform/storage.ts",
        "src/platform/updater.ts",
        "src/features/workspace/workspace-index.ts",
        "src/features/workspace/workspace-refresh.ts",
        "src/features/workspace/workspace-tree.ts",
        "src/features/documents/rendering/**/*.{ts,tsx}",
      ],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
      thresholds: {
        statements: 70,
        branches: 50,
        functions: 70,
        lines: 75,
      },
    },
  },
});
