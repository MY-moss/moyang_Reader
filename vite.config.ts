import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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
      // Generated packages/models are not source. Watching their directories
      // holds Windows handles that prevent atomic portable-package publication.
      watch: {
        ignored: ["**/release/**", "**/.local/**", "**/artifacts/**", "**/target/**", "**/.codex-worktrees/**"],
      },
    },
  };
});
