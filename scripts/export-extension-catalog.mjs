import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The desktop release targets Windows; browser previews choose their own host at runtime.
function loadCatalogModule(file) {
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, navigator: { userAgent: "Windows" }, require: (specifier) => {
    if (!specifier.startsWith("./")) throw new Error(`Unexpected catalog import: ${specifier}`);
    return loadCatalogModule(path.resolve(path.dirname(file), specifier.endsWith(".json") ? specifier : specifier + ".ts"));
  } };
  vm.runInNewContext(compiled, context, { timeout: 1000, filename: file });
  return context.exports;
}
function publish(file, value) {
  const content = JSON.stringify(value, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n") !== content) throw new Error(`Generated catalog is stale: ${file}. Run node scripts/export-extension-catalog.mjs.`);
  } else fs.writeFileSync(file, content);
}
const readers = loadCatalogModule(path.join(root, "src/features/extensions/builtin-readers.ts"));
publish(path.join(root, "src/features/extensions/builtin-reader-packages.json"), [...readers.practicalReaders, ...readers.basicReaders]);
const catalog = loadCatalogModule(path.join(root, "src/features/extensions/catalog.ts"));
const directory = path.join(root, "public/extensions");
fs.mkdirSync(directory, { recursive: true });
publish(
  path.join(directory, "catalog.json"),
  { format: "moyang-extension-catalog", packages: catalog.builtInCatalog },
);
console.log(`Exported ${catalog.builtInCatalog.length} curated packages.`);
