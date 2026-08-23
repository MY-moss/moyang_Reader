import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      // Business modules are covered here; App/UI behavior is guarded by the Playwright smoke test.
      include: [
        "src/app/export.ts",
        "src/app/storage.ts",
        "src/app/updater.ts",
        "src/app/workspace-index.ts",
        "src/app/workspace-refresh.ts",
        "src/app/workspace-tree.ts",
        "src/lib/**/*.{ts,tsx}",
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
