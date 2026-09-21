import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultExceptionsPath = path.join(scriptsDirectory, "dev-audit-exceptions.json");

export function collectAdvisoryIds(report) {
  const advisoryIds = new Set();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const source of vulnerability.via ?? []) {
      if (typeof source !== "object" || source === null) continue;
      const match = String(source.url ?? "").match(/GHSA-[0-9a-z-]+/i);
      if (match) advisoryIds.add(match[0].toUpperCase());
    }
  }
  return [...advisoryIds].sort();
}

export function validateDevAuditReport(report, exceptions, now = new Date()) {
  const errors = [];
  const activeAdvisories = new Set(collectAdvisoryIds(report));
  const exceptionByAdvisory = new Map(
    Object.entries(exceptions.advisories ?? {}).map(([id, exception]) => [id.toUpperCase(), exception]),
  );
  const acceptedAdvisories = new Set(exceptionByAdvisory.keys());
  const reviewBy = new Date(`${exceptions.reviewBy ?? ""}T23:59:59.999Z`);

  if (exceptions.schemaVersion !== 1) errors.push("Dev dependency exceptions must use schemaVersion 1.");
  if (!exceptions.owner?.trim()) errors.push("Dev dependency exceptions must name an owner.");
  if (!exceptions.trackingIssue?.startsWith("https://github.com/")) {
    errors.push("Dev dependency exceptions must link a GitHub tracking issue.");
  }
  if (Number.isNaN(reviewBy.getTime()) || reviewBy < now) {
    errors.push(`Dev dependency exceptions expired on ${exceptions.reviewBy || "an invalid date"}.`);
  }
  if ((report.metadata?.vulnerabilities?.critical ?? 0) > 0) {
    errors.push("Critical development dependency vulnerabilities cannot be accepted by this exception file.");
  }

  for (const advisoryId of activeAdvisories) {
    const exception = exceptionByAdvisory.get(advisoryId);
    if (!exception) {
      errors.push(`Unreviewed development dependency advisory: ${advisoryId}.`);
      continue;
    }
    if (!exception.dependency?.trim() || !exception.reason?.trim()) {
      errors.push(`${advisoryId} must record the affected dependency and exploitability rationale.`);
    }
  }

  for (const advisoryId of acceptedAdvisories) {
    if (!activeAdvisories.has(advisoryId)) {
      errors.push(`Resolved advisory still has a stale exception: ${advisoryId}.`);
    }
  }

  return errors;
}

function runNpmAudit(arguments_) {
  const npmArguments = ["audit", "--json", "--registry=https://registry.npmjs.org", ...arguments_];
  const npmCli = process.env.npm_execpath;
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, ...npmArguments], {
        cwd: path.resolve(scriptsDirectory, ".."),
        encoding: "utf8",
        shell: false,
      })
    : spawnSync("npm", npmArguments, {
        cwd: path.resolve(scriptsDirectory, ".."),
        encoding: "utf8",
        shell: process.platform === "win32",
      });
  if (!result.stdout?.trim()) {
    throw new Error(
      `npm audit did not return JSON: ${result.error?.message || result.stderr?.trim() || `exit ${result.status}`}`,
    );
  }
  return JSON.parse(result.stdout);
}

export function runDevDependencyAudit() {
  const productionReport = runNpmAudit(["--omit=dev"]);
  const productionTotal = productionReport.metadata?.vulnerabilities?.total ?? 0;
  if (productionTotal > 0) {
    console.error(`Production dependency audit reported ${productionTotal} vulnerabilities.`);
    return 1;
  }

  const report = runNpmAudit([]);
  const exceptions = JSON.parse(fs.readFileSync(defaultExceptionsPath, "utf8"));
  const errors = validateDevAuditReport(report, exceptions);
  if (errors.length > 0) {
    console.error("Development dependency audit failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    return 1;
  }

  const totals = report.metadata?.vulnerabilities ?? {};
  console.log(
    `Production audit: 0 vulnerabilities. Development audit: ${totals.total ?? 0} accepted, non-critical vulnerabilities across ${collectAdvisoryIds(report).length} reviewed advisories; review by ${exceptions.reviewBy}.`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runDevDependencyAudit();
}
