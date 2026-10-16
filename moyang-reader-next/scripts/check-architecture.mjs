import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const issues = [];
const files = walk(source).filter((file) => /\.tsx?$/.test(file));
let imports = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const relative = path.relative(source, file).replaceAll("\\", "/");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function inspect(node) {
    const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (literal && ts.isStringLiteral(literal) && literal.text.startsWith(".")) {
      imports++;
      const resolved = path.resolve(path.dirname(file), literal.text);
      const destination = path.relative(source, resolved).replaceAll("\\", "/");
      if (destination.startsWith("..")) issues.push(`${relative}: import escapes src: ${literal.text}`);
      if (!([resolved, `${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, "index.ts")].some(fs.existsSync)))
        issues.push(`${relative}: unresolved import: ${literal.text}`);
      if (relative.startsWith("features/") && /^(application|shell)\//.test(destination))
        issues.push(`${relative}: feature imports application UI: ${destination}`);
      if (relative.startsWith("platform/") && destination.startsWith("application/"))
        issues.push(`${relative}: platform imports application orchestration`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(ast);
}
const appLines = fs.readFileSync(path.join(source, "application/App.tsx"), "utf8").split("\n").length;
if (appLines > 220) issues.push(`App.tsx has ${appLines} lines; keep layout composition below 220.`);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
if (packageJson.name !== lock.packages[""].name) issues.push("Package identity differs from lockfile.");
if (issues.length) { console.error(issues.join("\n")); process.exitCode = 1; }
else console.log(`Architecture passed: ${files.length} source/test files, ${imports} local imports; App.tsx ${appLines} lines.`);
