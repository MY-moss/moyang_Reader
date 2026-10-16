import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveSharedCargoTargetDir } from "./shared-cargo-target.mjs";
const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", "scripts/test-storage-migration.ps1", "-McpExecutable", path.join(resolveSharedCargoTargetDir(process.cwd()), "release/moyang-ai-mcp.exe")], { stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
