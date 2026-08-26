import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const devServer = spawn(npmCommand, ["run", "dev"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

const forwardSignal = (signal) => {
  if (!devServer.killed) devServer.kill(signal);
};

process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));

devServer.once("error", (cause) => {
  console.error("Unable to start the Vite development server:", cause);
  process.exitCode = 1;
});

devServer.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
