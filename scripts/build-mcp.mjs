import { spawnSync } from "node:child_process";
import { createBuildEnvironment } from "./shared-cargo-target.mjs";
const result = spawnSync("cargo", ["build", "-p", "moyang-ai-mcp", ...process.argv.slice(2)], { cwd: process.cwd(), env: createBuildEnvironment(process.cwd()), stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
