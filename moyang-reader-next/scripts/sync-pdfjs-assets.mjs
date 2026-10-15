import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(path.join(root, "node_modules/pdfjs-dist/package.json"), "utf8")).version;
const target = path.join(root, "public/pdfjs");
mkdirSync(target, { recursive: true });
function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}
for (const name of ["cmaps", "standard_fonts", "wasm"]) copyDirectory(path.join(root, "node_modules/pdfjs-dist", name), path.join(target, name));
copyFileSync(path.join(root, "node_modules/pdfjs-dist/LICENSE"), path.join(target, "LICENSE"));
writeFileSync(path.join(target, "version.json"), JSON.stringify({ version }));
