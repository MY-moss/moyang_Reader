import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    define: {
      __MOYANG_VERSION__: JSON.stringify(version),
      __MOYANG_DESKTOP_E2E__: env.VITE_MOYANG_DESKTOP_E2E === "1",
    },
    plugins: [react()],
    worker: { format: "es" },
    resolve: {
      // The package's default/worker decoder also works without a DOM in dev and production workers.
      alias: { "decode-named-character-reference": fileURLToPath(new URL("./node_modules/decode-named-character-reference/index.js", import.meta.url)) },
    },
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
