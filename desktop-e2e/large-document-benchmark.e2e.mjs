import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { LARGE_DOCUMENT_CASES, createLargeMarkdown } from "./large-document-fixture.mjs";

const documentPath = process.env.MOYANG_DESKTOP_E2E_DOCUMENT;
const reportPath = process.env.MOYANG_DESKTOP_E2E_BENCHMARK_REPORT;
assert.ok(documentPath, "desktop large-document benchmark fixture path should be configured");
assert.ok(reportPath, "desktop large-document benchmark report path should be configured");

const fixtureRoot = path.dirname(documentPath);
const initialDocumentName = path.basename(documentPath);
const operationTimeoutMs = 120_000;
const sourceModeThresholdBytes = 512 * 1024;

function readApplicationWorkingSetBytes() {
  if (process.platform !== "win32") return null;

  try {
    const output = execFileSync("tasklist.exe", ["/FI", "IMAGENAME eq moyang-reader.exe", "/FO", "CSV", "/NH"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const values = output
      .split(/\r?\n/)
      .filter((line) => /^"moyang-reader\.exe"/i.test(line))
      .flatMap((line) => line.match(/"[^"]*"/g) ?? [])
      .map((value) => value.slice(1, -1));
    const memoryValues = values
      .filter((_, index) => index % 5 === 4)
      .map((value) => Number(value.replace(/[^0-9]/g, "")) * 1024)
      .filter((value) => Number.isFinite(value) && value > 0);
    return memoryValues.length > 0 ? Math.max(...memoryValues) : null;
  } catch {
    return null;
  }
}

function createApplicationMemoryProbe() {
  const samples = [];
  const sample = () => {
    const bytes = readApplicationWorkingSetBytes();
    if (bytes !== null) samples.push({ at: performance.now(), bytes });
  };
  sample();
  const timer = globalThis.setInterval(sample, 250);
  return {
    stop() {
      globalThis.clearInterval(timer);
      sample();
      const values = samples.map((item) => item.bytes);
      const peakWorkingSetBytes = values.reduce((peak, value) => Math.max(peak, value), 0);
      const minimumWorkingSetBytes = values.reduce(
        (minimum, value) => Math.min(minimum, value),
        values[0] ?? Number.POSITIVE_INFINITY,
      );
      return {
        measurement: "Windows tasklist Working Set",
        sampleCount: samples.length,
        initialWorkingSetBytes: values[0] ?? null,
        peakWorkingSetBytes: peakWorkingSetBytes || null,
        finalWorkingSetBytes: values.at(-1) ?? null,
        minimumWorkingSetBytes: Number.isFinite(minimumWorkingSetBytes) ? minimumWorkingSetBytes : null,
        peakDeltaBytes: values.length > 0 && peakWorkingSetBytes > 0 ? peakWorkingSetBytes - values[0] : null,
      };
    },
  };
}

async function startRendererResponsivenessProbe() {
  await browser.execute(() => {
    const key = "__moyangDesktopE2eLargeDocumentResponsivenessProbe";
    const previous = window[key];
    if (previous) window.clearInterval(previous.timer);
    const startedAt = window.performance.now();
    const state = { startedAt, sampleCount: 0, maxGapMs: 0, lastTickAt: startedAt };
    const timer = window.setInterval(() => {
      const now = window.performance.now();
      state.sampleCount += 1;
      state.maxGapMs = Math.max(state.maxGapMs, now - state.lastTickAt);
      state.lastTickAt = now;
    }, 50);
    window[key] = { state, timer };
  });
}

async function stopRendererResponsivenessProbe() {
  return browser.execute(() => {
    const key = "__moyangDesktopE2eLargeDocumentResponsivenessProbe";
    const probe = window[key];
    if (!probe) return null;
    window.clearInterval(probe.timer);
    const durationMs = window.performance.now() - probe.state.startedAt;
    delete window[key];
    return {
      durationMs,
      sampleCount: probe.state.sampleCount,
      maxGapMs: probe.state.maxGapMs,
    };
  });
}

async function clickToolbarAction(name) {
  const menu = await browser.$("details.toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) await menu.$("summary.toolbar-overflow-trigger").click();
  await browser.$(`button=${name}`).click();
}

async function readMode() {
  return browser.execute(() => {
    if (document.querySelector(".reader-content")) return "rendered";
    if (document.querySelector('.wysiwyg-editor [contenteditable="true"]')) return "wysiwyg";
    if (document.querySelector('[aria-label="Markdown 源文本"]')) return "source";
    return "unknown";
  });
}

async function waitForDocumentSurface() {
  await browser.waitUntil(
    () =>
      browser.execute(() =>
        Boolean(
          document.querySelector(
            '.reader-content, .wysiwyg-editor [contenteditable="true"], [aria-label="Markdown 源文本"]',
          ),
        ),
      ),
    { timeout: operationTimeoutMs, timeoutMsg: "large document did not expose a readable editor or reader surface" },
  );
}

async function clickWorkspaceFile(name) {
  await browser.waitUntil(
    () =>
      browser.execute(
        (expectedName) =>
          Array.from(document.querySelectorAll(".workspace-file")).some((entry) =>
            (entry.textContent ?? "").includes(expectedName),
          ),
        name,
      ),
    { timeout: 30_000, timeoutMsg: `large document ${name} did not appear in the workspace tree` },
  );
  const entries = await browser.$$(".workspace-file");
  for (const entry of entries) {
    if ((await entry.getText()).includes(name)) {
      await entry.click();
      await browser.waitUntil(
        () =>
          browser
            .$(".document-title")
            .getText()
            .then((text) => text.includes(name)),
        { timeout: operationTimeoutMs, timeoutMsg: `large document ${name} did not finish opening` },
      );
      await waitForDocumentSurface();
      return;
    }
  }
  throw new Error(`large document ${name} was not found in the workspace tree`);
}

async function resetDesktopSession() {
  await browser.execute(() => window.localStorage.clear());
  await browser.refresh();
  await browser.waitUntil(
    () =>
      browser
        .$(".document-title")
        .getText()
        .then((text) => text.includes(initialDocumentName)),
    { timeout: 30_000, timeoutMsg: "large-document benchmark did not restore the initial fixture" },
  );
}

async function measureSourceSearch(needle) {
  const mode = await readMode();
  assert.equal(mode, "source", "large documents should open in source mode before source search");
  const editor = await browser.$('[aria-label="Markdown 源文本"]');
  await editor.click();
  await browser.keys(["Control", "f"]);
  const input = await browser.$('input[aria-label="Find"]');
  await input.waitForDisplayed({ timeout: 15_000 });
  const startedAt = performance.now();
  await input.setValue(needle);
  await browser.keys("Enter");
  await browser.waitUntil(() => browser.execute(() => document.querySelectorAll(".cm-searchMatch").length > 0), {
    timeout: operationTimeoutMs,
    timeoutMsg: "large document source search did not produce a match",
  });
  const result = {
    latencyMs: performance.now() - startedAt,
    matchCount: await browser.execute(() => document.querySelectorAll(".cm-searchMatch").length),
  };
  await browser.keys("Escape");
  return result;
}

async function measureRichModeRejection() {
  const startedAt = performance.now();
  await clickToolbarAction("阅读");
  const latencyMs = performance.now() - startedAt;
  const mode = await readMode();
  assert.equal(mode, "source", "large document rich-mode request should keep source mode");
  await browser.waitUntil(
    () =>
      browser.execute(() =>
        Array.from(document.querySelectorAll(".app-notification-message")).some((element) =>
          (element.textContent ?? "").includes("暂不切换到阅读或所见即所得模式"),
        ),
      ),
    { timeout: 5_000, timeoutMsg: "large document rich-mode rejection notice was not shown" },
  );
  return { latencyMs, mode, blocked: true };
}

async function measureSave(caseInfo) {
  const marker = `B02_SAVE_COMMIT_${caseInfo.id}`;
  await browser.execute((value) => {
    const insert = window.__moyangDesktopE2e?.insertSourceText;
    if (!insert) throw new Error("large document source editor E2E bridge is unavailable");
    insert(`\n${value}\n`);
  }, marker);
  const startedAt = performance.now();
  await clickToolbarAction("保存");
  await browser.waitUntil(() => fs.readFileSync(caseInfo.path, "utf8").includes(marker), {
    timeout: operationTimeoutMs,
    timeoutMsg: `large document ${caseInfo.id} did not save the source edit`,
  });
  return { latencyMs: performance.now() - startedAt, marker };
}

function roundMetric(value) {
  return value === null ? null : Math.round(value * 100) / 100;
}

describe("B02 large document benchmark", () => {
  it("measures 1MB and 10MB Markdown reading, editing, search, save, memory, and responsiveness", async function () {
    this.timeout(1_800_000);
    const cases = [];
    await resetDesktopSession();

    for (const definition of LARGE_DOCUMENT_CASES) {
      const documentFilePath = path.join(fixtureRoot, definition.fileName);
      const original = createLargeMarkdown(definition.targetBytes, definition.id);
      const caseInfo = { ...definition, path: documentFilePath };
      assert.equal(Buffer.byteLength(original, "utf8"), definition.targetBytes);
      fs.writeFileSync(documentFilePath, original, "utf8");
      const initialBytes = fs.statSync(documentFilePath).size;

      const memoryProbe = createApplicationMemoryProbe();
      let rendererProbeActive = false;
      try {
        await startRendererResponsivenessProbe();
        rendererProbeActive = true;

        const openStartedAt = performance.now();
        await clickWorkspaceFile(definition.fileName);
        const openLatencyMs = performance.now() - openStartedAt;
        const firstReadableMode = await readMode();
        assert.equal(firstReadableMode, "source");

        const richMode = await measureRichModeRejection();
        const sourceSearch = await measureSourceSearch(`B02_SEARCH_MARKER_${definition.id}`);
        const save = await measureSave(caseInfo);

        const rendererMetrics = await stopRendererResponsivenessProbe();
        rendererProbeActive = false;
        const memoryMetrics = memoryProbe.stop();

        cases.push({
          id: definition.id,
          fileName: definition.fileName,
          targetBytes: definition.targetBytes,
          initialBytes,
          savedBytes: fs.statSync(documentFilePath).size,
          firstReadable: { mode: firstReadableMode, latencyMs: roundMetric(openLatencyMs) },
          editing: { richMode, finalMode: await readMode() },
          search: { source: { ...sourceSearch, latencyMs: roundMetric(sourceSearch.latencyMs) } },
          save: { ...save, latencyMs: roundMetric(save.latencyMs) },
          responsiveness: rendererMetrics
            ? {
                ...rendererMetrics,
                durationMs: roundMetric(rendererMetrics.durationMs),
                maxGapMs: roundMetric(rendererMetrics.maxGapMs),
              }
            : null,
          memory: memoryMetrics,
        });
      } finally {
        if (rendererProbeActive) await stopRendererResponsivenessProbe().catch(() => null);
        memoryProbe.stop();
        fs.writeFileSync(documentFilePath, original, "utf8");
        await resetDesktopSession().catch(() => undefined);
      }
    }

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      measurement: {
        operationTimeoutMs,
        fixture: "deterministic Markdown paragraphs with one search marker",
        sourceModeThresholdBytes,
        thresholdRationale: "The unguarded 1MB rich-mode baseline exceeded the 10-minute desktop runner timeout.",
      },
      cases,
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`large-document-benchmark ${JSON.stringify(report)}`);
  });
});
