import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src/features/extensions/catalog.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
// The desktop release targets Windows; browser previews choose their own host at runtime.
const context = { exports: {}, navigator: { userAgent: "Windows" } };
vm.runInNewContext(compiled, context, { timeout: 1000, filename: "catalog.js" });
const directory = path.join(root, "public/extensions");
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(
  path.join(directory, "catalog.json"),
  JSON.stringify({ format: "moyang-extension-catalog", packages: context.exports.builtInCatalog }, null, 2) + "\n",
);
console.log(`Exported ${context.exports.builtInCatalog.length} curated packages.`);
