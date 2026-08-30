import { spawnSync } from "node:child_process";
import { createBuildEnvironment } from "./shared-cargo-target.mjs";

const command = (name) => (process.platform === "win32" ? `${name}.cmd` : name);
const environment = createBuildEnvironment(process.cwd(), { VITE_MOYANG_DESKTOP_E2E: "1" });

function run(name, args) {
  const result = spawnSync(command(name), args, {
    cwd: process.cwd(),
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("tauri", [
  "build",
  "--debug",
  "--no-bundle",
  "--ci",
  "--features",
  "wdio",
  "--config",
  "src-tauri/tauri.wdio.conf.json",
]);
run("wdio", ["run", "desktop-e2e/wdio.conf.mjs"]);

