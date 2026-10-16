import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveSharedCargoTargetDir } from "./shared-cargo-target.mjs";
// A fresh checkout has no release package. Build the current test companion,
// rather than accidentally validating an old locally cached release binary.
const build = spawnSync(process.execPath, ["scripts/build-mcp.mjs"], { stdio: "inherit", windowsHide: true });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", "scripts/test-storage-migration.ps1", "-McpExecutable", path.join(resolveSharedCargoTargetDir(process.cwd()), "debug/moyang-ai-mcp.exe")], { stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
