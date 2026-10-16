import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createBuildEnvironment, resolveSharedCargoTargetDir } from "./shared-cargo-target.mjs";
import { assemblePortablePackage } from "./portable-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["scripts/run-tauri.mjs", "build", "--no-bundle"], {
  cwd: root,
  env: createBuildEnvironment(root),
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  JSON.stringify(
    assemblePortablePackage({
      root,
      target: path.join(resolveSharedCargoTargetDir(root), "release"),
      documentationFiles: new Set(execFileSync("git", ["ls-files", "--", "docs"], { cwd: root, encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/)),
    }),
    null,
    2,
  ),
);
