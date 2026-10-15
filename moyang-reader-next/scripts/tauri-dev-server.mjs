import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "./sync-pdfjs-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules/vite/bin/vite.js");
// Run the CLI in this Node process: Windows cannot spawn npm.cmd without a
// shell, and an extra launcher process can leave Vite running after Tauri exits.
process.chdir(root);
process.argv.splice(1, 1, cli, "--host", "127.0.0.1");
await import(pathToFileURL(cli).href);
