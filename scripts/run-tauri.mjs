import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuildEnvironment } from "./shared-cargo-target.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(projectRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
const args = process.argv.slice(2);
// The usual desktop commands also build the companion, so MCP is ready next to the app.
if (["dev", "build"].includes(args[0])) {
  const profile = args[0] === "build" && !args.includes("--debug") ? ["--release"] : [];
  const companion = spawnSync("cargo", ["build", "-p", "moyang-ai-mcp", ...profile], {
    cwd: projectRoot,
    env: createBuildEnvironment(projectRoot),
    stdio: "inherit",
    windowsHide: true,
  });
  if (companion.error) throw companion.error;
  if (companion.status !== 0) process.exit(companion.status ?? 1);
}
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: createBuildEnvironment(projectRoot),
  stdio: "inherit",
  windowsHide: true,
});

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));

child.once("error", (cause) => {
  console.error("Unable to start the Tauri CLI:", cause);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
