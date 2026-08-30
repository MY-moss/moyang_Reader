import { ESLint } from "eslint";

const probes = [
  {
    ruleId: "@typescript-eslint/no-floating-promises",
    code: "async function probe() { Promise.resolve(1); } void probe();",
  },
  {
    ruleId: "@typescript-eslint/await-thenable",
    code: "async function probe() { await 1; } void probe();",
  },
  {
    ruleId: "@typescript-eslint/no-misused-promises",
    code: "[1].forEach(async () => { await Promise.resolve(1); });",
  },
];

const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: "eslint.config.mjs" });
const failures = [];

for (const probe of probes) {
  const [result] = await eslint.lintText(probe.code, { filePath: "src/app/types.ts" });
  const ruleIds = new Set(result.messages.map((message) => message.ruleId));
  if (!ruleIds.has(probe.ruleId)) {
    failures.push(`${probe.ruleId} did not report a typed probe violation`);
  }
}

const [nonTypedResult] = await eslint.lintText(probes[0].code, {
  filePath: "scripts/check-type-aware-eslint.mjs",
});
if (nonTypedResult.messages.some((message) => message.ruleId?.startsWith("@typescript-eslint/"))) {
  failures.push("type-aware rules leaked into the scripts configuration boundary");
}

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}

console.log(`[type-aware-eslint] ${probes.length}/${probes.length} rule probes reported as expected`);
