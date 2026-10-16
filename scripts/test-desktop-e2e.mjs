import { spawn } from "node:child_process";
import { createBuildEnvironment } from "./shared-cargo-target.mjs";
import { startDesktopApiFixtures } from "./desktop-api-fixtures.mjs";

const command = (name) => (process.platform === "win32" ? `${name}.cmd` : name);
const environment = createBuildEnvironment(process.cwd(), { VITE_MOYANG_DESKTOP_E2E: "1" });

async function run(name, args) {
  const result = spawn(command(name), args, {
    cwd: process.cwd(),
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  await new Promise((resolve, reject) => { result.on("error", reject); result.on("exit", code => code === 0 ? resolve() : reject(new Error(`${name} exited with ${code}`))); });
}

await run("npm", ["run", "build:mcp"]);
await run("tauri", [
  "build",
  "--debug",
  "--no-bundle",
  "--ci",
  "--features",
  "wdio",
  "--config",
  "src-tauri/tauri.wdio.conf.json",
]);
const fixtures = await startDesktopApiFixtures();
try {
  environment.MOYANG_TEST_API_URL = fixtures.base;
  environment.MOYANG_TEST_UPDATE_ENDPOINT = fixtures.base + "/reader-update.json";
  environment.MOYANG_TEST_UPDATE_PUBKEY = fixtures.pubkey;
  await run("wdio", ["run", "desktop-e2e/wdio.conf.mjs"]);
} finally { await fixtures.close(); }
