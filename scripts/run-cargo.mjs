import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuildEnvironment } from "./shared-cargo-target.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.platform === "win32" ? "cargo.exe" : "cargo";
const child = spawn(command, process.argv.slice(2), {
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
  console.error("Unable to start Cargo:", cause);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
