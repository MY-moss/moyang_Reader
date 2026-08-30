import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import JSZip from "jszip";

const documentPath = process.env.MOYANG_DESKTOP_E2E_DOCUMENT;
const exportRoot = process.env.MOYANG_DESKTOP_E2E_EXPORT_ROOT;
assert.ok(documentPath, "desktop E2E fixture path should be configured");
assert.ok(exportRoot, "desktop E2E export path should be configured");

const workspaceName = path.basename(path.dirname(documentPath));
const htmlExportPath = path.join(exportRoot, `${workspaceName}.html`);
const docxExportPath = path.join(exportRoot, `${workspaceName}.docx`);
const documentName = path.basename(documentPath, path.extname(documentPath));
const pdfExportPath = path.join(exportRoot, `${documentName}.pdf`);

async function clickToolbarAction(name) {
  const menu = await browser.$("details.toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await menu.$("summary.toolbar-overflow-trigger").click();
  }
  await browser.$(`button=${name}`).click();
}

async function ensureWysiwygMode() {
  const editable = await browser.$('.wysiwyg-editor [contenteditable="true"]');
  if (await editable.isExisting()) {
    await editable.waitForDisplayed();
    return editable;
  }

  const sourceEditor = await browser.$('[aria-label="Markdown 源文本"]');
  if (await sourceEditor.isExisting()) {
    await clickToolbarAction("阅读");
  }
  await clickToolbarAction("编辑");
  await editable.waitForDisplayed();
  return editable;
}

async function ensureRenderedMode() {
  const returnToReading = await browser.$('button[aria-label="直接返回阅读模式"]');
  if (await returnToReading.isExisting()) {
    await returnToReading.click();
  }
  await browser.$(".reader-content").waitForDisplayed();
}

async function clickWorkspaceExportAction(name) {
  const menu = await browser.$("details.workspace-export-menu");
  if ((await menu.getAttribute("open")) === null) {
    await menu.$("summary").click();
  }
  const action = await menu.$(`button=${name}`);
  await action.waitForDisplayed();
  await browser.waitUntil(() => action.isEnabled(), {
    timeout: 15_000,
    timeoutMsg: `${name} export action remained disabled`,
  });
  await action.click();
}

async function waitForExport(pathname, description) {
  await browser.waitUntil(
    async () => {
      if (fs.existsSync(pathname)) return true;
      const alert = await browser.$('[role="alert"]');
      if (await alert.isDisplayed()) {
        throw new Error(`${description} failed: ${await alert.getText()}`);
      }
      return false;
    },
    {
      timeout: 30_000,
      timeoutMsg: `${description} did not create an output file`,
    },
  );
}

function listWorkspaceExportArtifacts() {
  if (!fs.existsSync(exportRoot)) return [];
  return fs
    .readdirSync(exportRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(workspaceName) && entry.name.endsWith(".docx"))
    .map((entry) => path.join(exportRoot, entry.name));
}

function listExportTempFiles() {
  if (!fs.existsSync(exportRoot)) return [];
  return fs
    .readdirSync(exportRoot, { withFileTypes: true })
    .filter((entry) => entry.name.includes(".moyang-export-part-") && entry.name.endsWith(".tmp"))
    .map((entry) => path.join(exportRoot, entry.name));
}

function removeExportArtifacts() {
  if (!fs.existsSync(exportRoot)) return;
  for (const entry of fs.readdirSync(exportRoot, { withFileTypes: true })) {
    if (
      (entry.name.startsWith(workspaceName) && entry.name.endsWith(".docx")) ||
      entry.name.includes(".moyang-export-part-")
    ) {
      fs.rmSync(path.join(exportRoot, entry.name), { recursive: true, force: true });
    }
  }
}

async function validateDocxArtifacts(description, minimumCount = 1) {
  const artifacts = listWorkspaceExportArtifacts();
  assert.ok(artifacts.length >= minimumCount, `${description} should commit at least ${minimumCount} DOCX volume(s)`);
  let totalBytes = 0;
  let documentXmlCount = 0;
  for (const artifactPath of artifacts) {
    const bytes = fs.readFileSync(artifactPath);
    totalBytes += bytes.length;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = zip.file("word/document.xml");
    assert.ok(documentXml, `${description} ${path.basename(artifactPath)} should contain word/document.xml`);
    const xml = await documentXml.async("string");
    assert.match(
      xml,
      /<w:document[\s>]/,
      `${description} ${path.basename(artifactPath)} should contain a DOCX document`,
    );
    documentXmlCount += 1;
  }
  return {
    count: artifacts.length,
    totalBytes,
    documentXmlCount,
  };
}

async function waitForWorkspaceItemCountAtLeast(minimum, description) {
  await browser.waitUntil(
    () =>
      browser
        .execute(() => {
          const text = document.querySelector(".workspace-location")?.textContent ?? "";
          return Number(text.match(/(\d+)\s*项/)?.[1] ?? -1);
        })
        .then((count) => count >= minimum),
    {
      timeout: 30_000,
      timeoutMsg: description,
    },
  );
}

async function waitForExportToSettle() {
  await browser.waitUntil(
    async () => {
      const cancelButton = await browser.$("button=取消导出");
      try {
        return !(await cancelButton.isDisplayed());
      } catch {
        return true;
      }
    },
    {
      timeout: 120_000,
      timeoutMsg: "the workspace export did not settle after cancellation or failure",
    },
  );
}

async function waitForSuccessfulExport(description) {
  await browser.waitUntil(
    async () => {
      const note = await browser.$(".workspace-export-note");
      if (await note.isDisplayed()) return /已导出/.test(await note.getText());
      const alert = await browser.$('[role="alert"]');
      if (await alert.isDisplayed()) throw new Error(`${description} failed: ${await alert.getText()}`);
      return false;
    },
    {
      timeout: 120_000,
      timeoutMsg: `${description} did not finish successfully`,
    },
  );
}

async function resetDesktopSession() {
  await browser.execute(() => window.localStorage.clear());
  await browser.refresh();
  const title = await browser.$(".document-title");
  await title.waitForDisplayed();
  await browser.waitUntil(() => title.getText().then((text) => text.includes("desktop-e2e.md")), {
    timeout: 15_000,
    timeoutMsg: "the desktop E2E fixture was not restored after resetting the session",
  });
}

async function waitForWorkspaceRoot(expectedRoot) {
  const comparableWorkspacePath = (value) => {
    const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
    try {
      return fs.realpathSync.native(value).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
    } catch {
      return normalized;
    }
  };
  const expected = comparableWorkspacePath(expectedRoot);
  await browser.waitUntil(
    () =>
      browser
        .$(".workspace-location")
        .getAttribute("title")
        .then((actual) => comparableWorkspacePath(actual ?? "") === expected),
    {
      timeout: 30_000,
      timeoutMsg: `the desktop E2E workspace did not switch to ${expectedRoot}`,
    },
  );
}

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
      const values = samples.map((sampleItem) => sampleItem.bytes);
      const peakWorkingSetBytes = values.reduce((peak, value) => Math.max(peak, value), 0);
      const minimumWorkingSetBytes = values.reduce(
        (minimum, value) => Math.min(minimum, value),
        values[0] ?? Number.POSITIVE_INFINITY,
      );
      const increasingStepCount = values.reduce(
        (count, value, index) => count + (index > 0 && value > values[index - 1] ? 1 : 0),
        0,
      );
      const decreasingStepCount = values.reduce(
        (count, value, index) => count + (index > 0 && value < values[index - 1] ? 1 : 0),
        0,
      );
      return {
        sampleCount: samples.length,
        initialWorkingSetBytes: values[0] ?? null,
        peakWorkingSetBytes: peakWorkingSetBytes || null,
        finalWorkingSetBytes: values.at(-1) ?? null,
        minimumWorkingSetBytes: Number.isFinite(minimumWorkingSetBytes) ? minimumWorkingSetBytes : null,
        increasingStepCount,
        decreasingStepCount,
        isStrictlyIncreasing: values.length > 1 && increasingStepCount === values.length - 1,
      };
    },
  };
}

async function startRendererResponsivenessProbe() {
  await browser.execute(() => {
    const key = "__moyangDesktopE2eResponsivenessProbe";
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
    const key = "__moyangDesktopE2eResponsivenessProbe";
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

function logExportBenchmark(report) {
  console.log(`desktop-export-benchmark ${JSON.stringify(report)}`);
}

async function measureContextToggleWhileExportRunning() {
  return browser.executeAsync((done) => {
    const startedAt = performance.now();
    const schedule = (callback) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(callback);
      } else {
        window.setTimeout(callback, 0);
      }
    };
    const findCancelButton = () =>
      Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "取消导出");
    const findContextToggle = () => document.querySelector('button[aria-keyshortcuts="Control+Shift+R"]');
    const waitFor = (predicate, stage, callback) => {
      const waitStartedAt = performance.now();
      const poll = () => {
        if (predicate()) {
          callback();
          return;
        }
        if (performance.now() - waitStartedAt >= 15_000) {
          done({ status: "timeout", stage });
          return;
        }
        schedule(poll);
      };
      poll();
    };

    const waitForCancelableExport = () => {
      if (!findCancelButton()) {
        if (document.querySelector(".workspace-export-note")?.textContent?.trim()) {
          done({ status: "completed-before-interaction" });
          return;
        }
        if (performance.now() - startedAt >= 15_000) {
          done({ status: "timeout", stage: "cancel-button" });
          return;
        }
        schedule(waitForCancelableExport);
        return;
      }

      const contextToggle = findContextToggle();
      if (!contextToggle || contextToggle.tagName !== "BUTTON") {
        done({ status: "missing-context-toggle" });
        return;
      }
      const contextWasOpen = contextToggle.getAttribute("aria-pressed") === "true";
      const contextStartedAt = performance.now();
      contextToggle.click();
      waitFor(
        () => findContextToggle()?.getAttribute("aria-pressed") === String(!contextWasOpen),
        "context-open",
        () => {
          const contextToggleLatencyMs = performance.now() - contextStartedAt;
          findContextToggle()?.click();
          waitFor(
            () => findContextToggle()?.getAttribute("aria-pressed") === String(contextWasOpen),
            "context-restore",
            () => done({ status: "measured", contextToggleLatencyMs }),
          );
        },
      );
    };

    waitForCancelableExport();
  });
}

async function cancelExportAfterFirstCommittedVolume() {
  return browser.executeAsync((done) => {
    const startedAt = performance.now();
    const targetProgress = 33;
    const schedule = (callback) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(callback);
      } else {
        window.setTimeout(callback, 0);
      }
    };
    const findCancelButton = () =>
      Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "取消导出");
    const readProgress = () => {
      const text = document.querySelector(".workspace-export-progress")?.textContent ?? "";
      return Number(text.match(/正在整理\s+(\d+)\s*\//)?.[1] ?? 0);
    };
    const poll = () => {
      const cancelButton = findCancelButton();
      if (!cancelButton) {
        if (document.querySelector(".workspace-export-note")?.textContent?.trim()) {
          done({ status: "completed-before-cancel" });
          return;
        }
        if (performance.now() - startedAt >= 30_000) {
          done({ status: "timeout", stage: "cancel-button" });
          return;
        }
        schedule(poll);
        return;
      }

      if (readProgress() < targetProgress) {
        if (performance.now() - startedAt >= 30_000) {
          done({ status: "timeout", stage: "first-volume" });
          return;
        }
        schedule(poll);
        return;
      }

      const cancellationStartedAt = performance.now();
      cancelButton.click();
      const waitForSettle = () => {
        if (!findCancelButton()) {
          done({ status: "cancelled", cancellationLatencyMs: performance.now() - cancellationStartedAt });
          return;
        }
        if (performance.now() - cancellationStartedAt >= 15_000) {
          done({ status: "timeout", stage: "cancel-settle" });
          return;
        }
        schedule(waitForSettle);
      };
      waitForSettle();
    };

    poll();
  });
}

async function workspaceEntryExists(selector, text = "") {
  return browser.execute(
    (entrySelector, expectedText) => {
      const entries = Array.from(document.querySelectorAll(entrySelector));
      return entries.some((entry) => {
        if (!expectedText) return true;
        const label = entrySelector === ".workspace-folder" ? entry.querySelector(".workspace-folder-name") : entry;
        const value = (label?.textContent ?? "").trim();
        return entrySelector === ".workspace-folder" ? value === expectedText : value.includes(expectedText);
      });
    },
    selector,
    text,
  );
}

async function workspaceEntryMatches(selector, entry, text) {
  if (!text) return true;
  if (selector === ".workspace-folder") {
    return (await entry.$(".workspace-folder-name").getText()).trim() === text;
  }
  return (await entry.getText()).includes(text);
}

async function waitForWorkspaceEntry(selector, text, expected, description) {
  await browser.waitUntil(() => workspaceEntryExists(selector, text).then((exists) => exists === expected), {
    timeout: 15_000,
    timeoutMsg: description,
  });
}

async function waitForSavedReadingPosition(fileName) {
  await browser.waitUntil(
    () =>
      browser.execute((expectedName) => {
        try {
          const raw = window.localStorage.getItem("moyang-reader-reading-positions");
          const positions = raw ? JSON.parse(raw) : [];
          return (
            Array.isArray(positions) &&
            positions.some(
              (item) =>
                item &&
                typeof item.path === "string" &&
                item.path.split(/[\\/]/).pop() === expectedName &&
                typeof item.top === "number" &&
                item.top > 0,
            )
          );
        } catch {
          return false;
        }
      }, fileName),
    {
      timeout: 5_000,
      timeoutMsg: `${fileName} reading position was not persisted`,
    },
  );
}

async function clickWorkspaceFile(name) {
  const files = await browser.$$(".workspace-file");
  for (const file of files) {
    if ((await file.getText()).includes(name)) {
      await file.click();
      await browser.waitUntil(async () => (await browser.$(".document-title").getText()).includes(name), {
        timeout: 15_000,
        timeoutMsg: `workspace file ${name} did not finish opening`,
      });
      return;
    }
  }
  throw new Error(`workspace file ${name} was not found`);
}

async function findWorkspaceElement(selector, text) {
  const entries = await browser.$$(selector);
  for (const entry of entries) {
    if (await workspaceEntryMatches(selector, entry, text)) return entry;
  }
  return null;
}

async function openWorkspaceContextMenu(selector, text) {
  const entry = await findWorkspaceElement(selector, text);
  assert.ok(entry, `workspace entry ${text} was not found`);
  await browser.execute((element) => {
    element.dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        clientX: 24,
        clientY: 24,
      }),
    );
  }, entry);
  const menu = await browser.$(".moyang-context-menu");
  await menu.waitForDisplayed();
  return menu;
}

async function pressDesktopEscape() {
  await browser.execute(() => {
    window.__desktopE2EEscapeProbe = { count: 0 };
    window.__desktopE2EEscapeListener = () => {
      window.__desktopE2EEscapeProbe.count += 1;
    };
    document.addEventListener("keydown", window.__desktopE2EEscapeListener, true);
  });

  try {
    await browser.keys("Escape");
    const keydownCount = await browser.execute(() => window.__desktopE2EEscapeProbe?.count ?? 0);
    const menuVisible = await browser
      .$(".moyang-context-menu")
      .isDisplayed()
      .catch(() => false);
    if (keydownCount === 0 && menuVisible) {
      // The embedded Tauri driver can accept a WebDriver key action without
      // forwarding it into the WebView. Exercise the same focused DOM path
      // only for that driver limitation; a delivered native key must still
      // close the menu through the product event listener above.
      await browser.execute(() => {
        const target = document.activeElement instanceof HTMLElement ? document.activeElement : document;
        target.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Escape",
            code: "Escape",
          }),
        );
      });
    }
  } finally {
    await browser.execute(() => {
      document.removeEventListener("keydown", window.__desktopE2EEscapeListener, true);
      delete window.__desktopE2EEscapeListener;
      delete window.__desktopE2EEscapeProbe;
    });
  }
}

async function discardDraftNotice() {
  const recoveryNotice = await browser.$(".draft-recovery-notice");
  await recoveryNotice.waitForDisplayed();
  await recoveryNotice.$("button=丢弃").click();
  const confirmButton = await browser.$('[data-testid="draft-discard-confirm"]');
  await confirmButton.waitForDisplayed();
  await confirmButton.click();
  await browser.waitUntil(() => recoveryNotice.isDisplayed().then((visible) => !visible), {
    timeout: 5_000,
    timeoutMsg: "the draft recovery notice did not dismiss after confirmation",
  });
}

async function requestCloseRequest() {
  await browser.execute(async () => {
    const tauriEvent = window.__TAURI__?.event;
    if (!tauriEvent?.emit) throw new Error("Tauri event API is unavailable");
    await tauriEvent.emit("close-requested");
  });
}

async function waitForCloseConfirmation() {
  const dialog = await browser.$('[role="dialog"][aria-labelledby="close-confirm-title"]');
  await browser.waitUntil(() => dialog.isDisplayed(), {
    timeout: 15_000,
    timeoutMsg: "the close request did not show the unsaved confirmation",
  });
  return dialog;
}

describe("Moyang Reader desktop runtime", () => {
  it("opens an initial Markdown path, edits it, and writes it back to disk", async () => {
    await browser.execute(() => window.localStorage.clear());
    await browser.refresh();

    const title = await browser.$(".document-title");
    await title.waitForDisplayed();
    await browser.waitUntil(async () => /desktop-e2e\.md/.test(await title.getText()), {
      timeout: 15_000,
      timeoutMsg: "the startup document path was not opened by the Tauri runtime",
    });
    await browser.$("h1=Desktop E2E").waitForDisplayed();
    assert.equal(await browser.$("button=打开列表").isExisting(), false);
    assert.equal(await browser.$("summary=批量导出").isDisplayed(), true);

    await browser.$('.wysiwyg-editor [contenteditable="true"]').waitForDisplayed();

    await clickToolbarAction("源文本");
    const editor = await browser.$('[aria-label="Markdown 源文本"]');
    await editor.waitForDisplayed();
    await browser.execute((text) => {
      const target = document.querySelector('[aria-label="Markdown 源文本"]');
      if (!(target instanceof HTMLElement)) throw new Error("source editor was not found");
      const content = target;
      const view = content.cmTile?.root?.view;
      if (!view) throw new Error("CodeMirror view is unavailable");
      view.dispatch({ changes: { from: view.state.doc.length, insert: `\n${text}` } });
    }, "桌面保存内容。");
    await browser.waitUntil(() => editor.getText().then((value) => value.includes("桌面保存内容。")), {
      timeout: 5_000,
      timeoutMsg: "the CodeMirror source editor did not receive the desktop edit",
    });

    const menu = await browser.$("details.toolbar-overflow");
    if ((await menu.getAttribute("open")) === null) {
      await menu.$("summary.toolbar-overflow-trigger").click();
    }
    const saveButton = await browser.$("button=保存");
    await browser.waitUntil(() => saveButton.isEnabled(), {
      timeout: 5_000,
      timeoutMsg: "the source edit did not mark the document as modified",
    });
    await saveButton.click();
    const alert = await browser.$('[role="alert"]');
    if (await alert.isDisplayed()) {
      throw new Error(`desktop save reported an error: ${await alert.getText()}`);
    }
    await browser.waitUntil(() => fs.readFileSync(documentPath, "utf8").includes("桌面保存内容。"), {
      timeout: 15_000,
      timeoutMsg: "the real Tauri write_text_file command did not update the fixture",
    });

    assert.match(fs.readFileSync(documentPath, "utf8"), /桌面保存内容。/);
  });

  it("shows native drag feedback and opens a dropped Markdown file", async () => {
    await resetDesktopSession();
    const droppedFileName = "desktop-drag-drop.md";
    const droppedFilePath = path.join(path.dirname(documentPath), droppedFileName);
    fs.rmSync(droppedFilePath, { force: true });
    fs.writeFileSync(droppedFilePath, "# Native drag drop\n\n桌面拖放内容。\n", "utf8");

    const emitDragEvent = async (eventName, payload) => {
      await browser.execute(
        async ({ name, detail }) => {
          const tauriEvent = window.__TAURI__?.event;
          if (!tauriEvent?.emit) throw new Error("Tauri event API is unavailable");
          await tauriEvent.emit(name, detail);
        },
        { name: eventName, detail: payload },
      );
    };

    try {
      const position = { x: 24, y: 24 };
      await emitDragEvent("tauri://drag-enter", { paths: [droppedFilePath], position });
      const overlay = await browser.$('[data-testid="file-drop-overlay"]');
      await overlay.waitForDisplayed();
      assert.equal(await overlay.getAttribute("data-drop-source"), "native");
      assert.equal(await overlay.getAttribute("data-drop-support"), "supported");

      await emitDragEvent("tauri://drag-over", { position });
      await emitDragEvent("tauri://drag-drop", { paths: [droppedFilePath], position });

      const title = await browser.$(".document-title");
      await browser.waitUntil(() => title.getText().then((text) => text.includes(droppedFileName)), {
        timeout: 15_000,
        timeoutMsg: "the native dropped Markdown file was not opened",
      });
      await browser.waitUntil(() => overlay.isDisplayed().then((visible) => !visible), {
        timeout: 5_000,
        timeoutMsg: "the native drag overlay did not clear after drop",
      });
    } finally {
      await resetDesktopSession().catch(() => undefined);
      fs.rmSync(droppedFilePath, { force: true });
    }
  });

  it("compares a recovery draft with the current disk version before restoring", async () => {
    await resetDesktopSession();
    const comparisonFileName = "desktop-draft-comparison.md";
    const comparisonFilePath = path.join(path.dirname(documentPath), comparisonFileName);
    fs.rmSync(comparisonFilePath, { force: true });
    fs.writeFileSync(comparisonFilePath, "# Draft comparison\n\n磁盘版本\n", "utf8");

    const snapshot = {
      path: comparisonFilePath,
      draft: "# Draft comparison\n\n草稿版本\n",
      baseSource: "# Draft comparison\n\n草稿保存时的旧版本\n",
      savedAt: Date.now() - 60_000,
    };

    try {
      await browser.execute((draft) => {
        window.localStorage.setItem("moyang-reader-drafts", JSON.stringify([draft]));
      }, snapshot);
      await browser.refresh();
      await browser.$(".document-title").waitForDisplayed();

      await browser.$("button=草稿 1").click();
      const preview = await browser.$(`[aria-label="查看 ${comparisonFileName} 当前文件与草稿的差异"]`);
      await preview.waitForDisplayed();
      await preview.click();

      const dialog = await browser.$('[role="dialog"][aria-labelledby="draft-comparison-title"]');
      await dialog.waitForDisplayed();
      await browser.waitUntil(() => dialog.getText().then((text) => text.includes("当前磁盘版本")), {
        timeout: 10_000,
        timeoutMsg: "the draft comparison did not read the current disk version",
      });
      const dialogText = await dialog.getText();
      assert.match(dialogText, /磁盘版本/);
      assert.match(dialogText, /草稿版本/);
      assert.match(dialogText, /草稿保存后原文件又发生了变化/);
      assert.doesNotMatch(dialogText, /草稿保存时的旧版本/);
    } finally {
      await resetDesktopSession().catch(() => undefined);
      fs.rmSync(comparisonFilePath, { force: true });
    }
  });

  it("manages workspace files and folders from context menus", async () => {
    const workspacePath = path.dirname(documentPath);
    const originalFileName = "context-managed.md";
    const renamedFileName = "context-renamed.md";
    const originalFilePath = path.join(workspacePath, originalFileName);
    const renamedFilePath = path.join(workspacePath, renamedFileName);
    const copiedFileName = "context-managed-copy.md";
    const copiedFilePath = path.join(workspacePath, copiedFileName);
    const folderName = "context-managed-folder";
    const folderPath = path.join(workspacePath, folderName);
    const copiedFolderName = "context-managed-folder-copy";
    const copiedFolderPath = path.join(workspacePath, copiedFolderName);
    fs.rmSync(originalFilePath, { force: true });
    fs.rmSync(renamedFilePath, { force: true });
    fs.rmSync(copiedFilePath, { force: true });
    fs.rmSync(folderPath, { recursive: true, force: true });
    fs.rmSync(copiedFolderPath, { recursive: true, force: true });
    fs.writeFileSync(originalFilePath, "# Context managed\n", "utf8");
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, "nested.md"), "# Nested\n", "utf8");

    try {
      await waitForWorkspaceEntry(
        ".workspace-file",
        originalFileName,
        true,
        "the context-menu file fixture did not appear in the workspace",
      );
      await waitForWorkspaceEntry(
        ".workspace-folder",
        folderName,
        true,
        "the context-menu folder fixture did not appear in the workspace",
      );

      const keyboardFileEntry = await findWorkspaceElement(".workspace-file", originalFileName);
      assert.ok(keyboardFileEntry, `workspace entry ${originalFileName} was not found for keyboard context menu`);
      await browser.execute((element) => {
        element.focus();
        element.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "F10",
            shiftKey: true,
          }),
        );
      }, keyboardFileEntry);
      const keyboardMenu = await browser.$(".moyang-context-menu");
      await keyboardMenu.waitForDisplayed();
      const keyboardFocusState = await browser.execute(() => {
        const menu = document.querySelector('.moyang-context-menu[role="menu"]');
        const firstItem = menu?.querySelector('[role="menuitem"]');
        return {
          active: document.activeElement?.outerHTML?.slice(0, 240) ?? null,
          firstItem: firstItem?.outerHTML?.slice(0, 240) ?? null,
          isFirst: firstItem === document.activeElement,
        };
      });
      assert.equal(
        keyboardFocusState.isFirst,
        true,
        `keyboard context menu should focus its first action: ${JSON.stringify(keyboardFocusState)}`,
      );
      await pressDesktopEscape();
      await browser.waitUntil(() => keyboardMenu.isDisplayed().then((visible) => !visible), {
        timeout: 5_000,
        timeoutMsg: "the keyboard context menu did not close on Escape",
      });
      assert.equal(
        await browser.execute((element) => document.activeElement === element, keyboardFileEntry),
        true,
        "keyboard context menu should restore focus to the workspace entry",
      );

      await browser.execute(() => {
        window.__desktopE2EOriginalPrompt = window.prompt;
        window.prompt = (message) => {
          if (message === "复制文件") return "context-managed-copy";
          if (message === "复制文件夹") return "context-managed-folder-copy";
          return "context-renamed";
        };
      });
      const duplicateFileMenu = await openWorkspaceContextMenu(".workspace-file", originalFileName);
      await duplicateFileMenu.$("button=复制文件").click();
      await waitForWorkspaceEntry(".workspace-file", copiedFileName, true, "the context-menu file was not copied");
      assert.equal(fs.readFileSync(copiedFilePath, "utf8"), "# Context managed\n");

      const duplicateFolderMenu = await openWorkspaceContextMenu(".workspace-folder", folderName);
      await duplicateFolderMenu.$("button=复制文件夹").click();
      await waitForWorkspaceEntry(
        ".workspace-folder",
        copiedFolderName,
        true,
        "the context-menu folder was not copied",
      );
      assert.equal(fs.readFileSync(path.join(copiedFolderPath, "nested.md"), "utf8"), "# Nested\n");

      const renameMenu = await openWorkspaceContextMenu(".workspace-file", originalFileName);
      await renameMenu.$("button=重命名文件").click();
      await waitForWorkspaceEntry(".workspace-file", renamedFileName, true, "the context-menu file was not renamed");
      assert.equal(fs.existsSync(originalFilePath), false);
      assert.equal(fs.existsSync(renamedFilePath), true);

      await browser.execute(() => {
        window.__desktopE2EOriginalConfirm = window.confirm;
        window.confirm = () => true;
      });
      const deleteFileMenu = await openWorkspaceContextMenu(".workspace-file", renamedFileName);
      await deleteFileMenu.$("button=删除文件").click();
      await waitForWorkspaceEntry(".workspace-file", renamedFileName, false, "the context-menu file was not deleted");
      assert.equal(fs.existsSync(renamedFilePath), false);

      const deleteFolderMenu = await openWorkspaceContextMenu(".workspace-folder", folderName);
      await deleteFolderMenu.$("button=删除文件夹及内容").click();
      await waitForWorkspaceEntry(".workspace-folder", folderName, false, "the context-menu folder was not deleted");
      assert.equal(fs.existsSync(folderPath), false);
    } finally {
      await browser
        .execute(() => {
          if (window.__desktopE2EOriginalPrompt) window.prompt = window.__desktopE2EOriginalPrompt;
          if (window.__desktopE2EOriginalConfirm) window.confirm = window.__desktopE2EOriginalConfirm;
          delete window.__desktopE2EOriginalPrompt;
          delete window.__desktopE2EOriginalConfirm;
        })
        .catch(() => undefined);
      fs.rmSync(originalFilePath, { force: true });
      fs.rmSync(renamedFilePath, { force: true });
      fs.rmSync(copiedFilePath, { force: true });
      fs.rmSync(folderPath, { recursive: true, force: true });
      fs.rmSync(copiedFolderPath, { recursive: true, force: true });
    }
  });

  it("keeps wiki-link and slash completion working in the real desktop editor", async () => {
    await waitForWorkspaceEntry(
      ".workspace-file",
      "wiki-target.md",
      true,
      "the desktop wiki-link fixture was not indexed in the workspace",
    );
    const editable = await ensureWysiwygMode();
    await editable.click();
    await browser.execute((text) => {
      const insert = window.__moyangDesktopE2e?.insertWysiwygText;
      if (!insert) throw new Error("desktop WYSIWYG E2E bridge is unavailable");
      insert(text);
    }, "[[wiki");

    const wikiOverlay = await browser.$('[role="listbox"][aria-label="双链补全候选"]');
    try {
      await wikiOverlay.waitForDisplayed();
    } catch (cause) {
      const debug = await browser.execute(() => ({
        editorText: document.querySelector('.wysiwyg-editor [contenteditable="true"]')?.textContent ?? null,
        editorHtml: document.querySelector('.wysiwyg-editor [contenteditable="true"]')?.innerHTML ?? null,
        workspaceFiles: Array.from(document.querySelectorAll(".workspace-file")).map((element) => element.textContent),
      }));
      throw new Error(`${cause.message}; desktop completion debug: ${JSON.stringify(debug)}`, { cause });
    }
    await browser.waitUntil(
      () =>
        wikiOverlay
          .$('[role="option"]')
          .getText()
          .then((text) => text.includes("wiki-target")),
      { timeout: 5_000, timeoutMsg: "the desktop wiki-link completion did not show the fixture note" },
    );
    await wikiOverlay.$('[role="option"]').click();
    await browser.waitUntil(() => wikiOverlay.isDisplayed().then((visible) => !visible), {
      timeout: 5_000,
      timeoutMsg: "the desktop wiki-link completion did not close after acceptance",
    });

    await clickToolbarAction("源文本");
    const editor = await browser.$('[aria-label="Markdown 源文本"]');
    await editor.waitForDisplayed();
    await browser.waitUntil(
      () => editor.getText().then((text) => text.includes("[[wiki-target]]") || text.includes("\\[\\[wiki-target]]")),
      {
        timeout: 5_000,
        timeoutMsg: "the desktop wiki-link completion did not serialize the accepted link",
      },
    );

    await editor.click();
    await browser.execute((text) => {
      const insert = window.__moyangDesktopE2e?.insertSourceText;
      if (!insert) throw new Error("desktop source E2E bridge is unavailable");
      insert(text);
    }, "\n/ul");
    const slashMenu = await browser.$(".cm-tooltip-autocomplete");
    await slashMenu.waitForDisplayed();
    await browser.waitUntil(() => slashMenu.getText().then((text) => text === "无序列表- 列表项"), {
      timeout: 5_000,
      timeoutMsg: "the desktop slash completion did not filter the list command",
    });
    await browser.execute(() => {
      const accept = window.__moyangDesktopE2e?.acceptSourceCompletion;
      if (!accept) throw new Error("desktop source completion accept bridge is unavailable");
      accept();
    });
    try {
      await browser.waitUntil(() => editor.getText().then((text) => text.includes("- ")), {
        timeout: 5_000,
        timeoutMsg: "the desktop slash completion did not insert a list marker",
      });
    } catch (cause) {
      throw new Error(`${cause.message}; source after slash completion: ${JSON.stringify(await editor.getText())}`, {
        cause,
      });
    }

    await clickToolbarAction("保存");
    await browser.waitUntil(() => fs.readFileSync(documentPath, "utf8").includes("wiki-target"), {
      timeout: 15_000,
      timeoutMsg: "the desktop completion scenario did not save its fixture edits",
    });
  });

  it("exports a real PDF and the workspace to HTML and Word", async () => {
    fs.rmSync(pdfExportPath, { force: true });
    await clickToolbarAction("保存 PDF");
    await waitForExport(pdfExportPath, "the real Tauri PDF export");
    const pdfBytes = fs.readFileSync(pdfExportPath);
    assert.ok(pdfBytes.length > 100, "the real Tauri PDF export should not be empty");
    assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(pdfBytes.includes(Buffer.from("%%EOF")), "the real Tauri PDF export should have an EOF marker");

    await clickWorkspaceExportAction("单文件 HTML");
    await waitForExport(htmlExportPath, "the real Tauri HTML export");
    assert.match(fs.readFileSync(htmlExportPath, "utf8"), /Desktop E2E/);

    await clickWorkspaceExportAction("单文件 Word");
    await waitForExport(docxExportPath, "the real Tauri Word export");
    const docxBytes = fs.readFileSync(docxExportPath);
    assert.equal(docxBytes.subarray(0, 2).toString("ascii"), "PK");
  });

  it("measures a 96-document batch Word export matrix across three runs", async function () {
    this.timeout(600_000);
    const matrixRoot = path.dirname(documentPath);
    await resetDesktopSession();
    await waitForWorkspaceRoot(matrixRoot);
    const batchFixtureRoot = path.join(matrixRoot, "desktop-batch-matrix-fixtures");
    const batchFixtureStagingRoot = path.join(
      path.dirname(matrixRoot),
      `.moyang-reader-batch-matrix-staging-${process.pid}-${Date.now()}`,
    );
    const batchFixtureCount = 96;
    const categoryCounts = {
      repeatedImage: 24,
      independentImage: 20,
      longText: 20,
      complexTable: 16,
      nestedHtml: 16,
    };
    const batchFixtureNames = Array.from(
      { length: batchFixtureCount },
      (_, index) => `desktop-batch-matrix-${String(index + 1).padStart(3, "0")}.md`,
    );
    const batchFixturePaths = batchFixtureNames.map((name) => path.join(batchFixtureRoot, name));
    const repeatedImageName = "desktop-batch-matrix-repeated.svg";
    const repeatedImagePath = path.join(batchFixtureRoot, repeatedImageName);
    const independentImageNames = Array.from(
      { length: categoryCounts.independentImage },
      (_, index) => `desktop-batch-matrix-independent-${String(index + 1).padStart(3, "0")}.svg`,
    );
    const independentImagePaths = independentImageNames.map((name) => path.join(batchFixtureRoot, name));
    const firstVolumePath = path.join(exportRoot, `${workspaceName} - 第 1 卷.docx`);

    const createSvg = (seed, rectangleCount, width, height) => {
      const rectangles = Array.from({ length: rectangleCount }, (_, index) => {
        const x = (seed * 31 + index * 37) % (width - 16);
        const y = (seed * 17 + index * 29) % (height - 16);
        const color = `#${((seed * 97 + index * 53) % 0xffffff).toString(16).padStart(6, "0")}`;
        return `<rect x="${x}" y="${y}" width="12" height="12" fill="${color}"/>`;
      }).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#dbeafe"/>${rectangles}</svg>`;
    };

    const repeatedImageContent = createSvg(23, 4_000, 1600, 1000);
    const independentImageContents = independentImageNames.map((_, index) => createSvg(100 + index, 1_500, 1400, 900));
    const longText = "超长文本块需要在真实批量导出中保持原样，同时让序列化和调度路径面对连续的大输入。".repeat(4_000);
    const complexTableRows = Array.from(
      { length: 120 },
      (_, index) =>
        `<tr><th>第 ${index + 1} 行</th><td>复杂表格内容 ${"保留结构 ".repeat(12)}</td><td>列 ${index + 1}</td></tr>`,
    ).join("");
    const nestedHtml = Array.from(
      { length: 20 },
      (_, index) =>
        `<section><article><h3>嵌套区块 ${index + 1}</h3><p>嵌套 HTML 内容 <strong>加粗</strong>、<em>强调</em>。</p><ul><li>一级项目<ul><li>二级项目 ${index + 1}</li></ul></li></ul></article></section>`,
    ).join("");
    const fixtureContents = [];
    let fixtureIndex = 0;
    const addFixture = (category, body) => {
      const name = batchFixtureNames[fixtureIndex++];
      const content = `# ${category} matrix fixture ${fixtureIndex}\n\n${body}\n`;
      fixtureContents.push({ name, category, content });
    };

    for (let index = 0; index < categoryCounts.repeatedImage; index += 1) {
      addFixture(
        "Repeated image",
        `大型重复图片 ${index + 1}。\n\n![[${repeatedImageName}]]\n\n${"重复图片后的段落内容。\n".repeat(80)}`,
      );
    }
    for (let index = 0; index < categoryCounts.independentImage; index += 1) {
      addFixture(
        "Independent image",
        `独立图片 ${index + 1}。\n\n![[${independentImageNames[index]}]]\n\n每篇文档使用不同的 SVG 字节。`,
      );
    }
    for (let index = 0; index < categoryCounts.longText; index += 1) {
      addFixture("Long text", `${longText}\n\n长文本夹具编号 ${index + 1}。`);
    }
    for (let index = 0; index < categoryCounts.complexTable; index += 1) {
      addFixture(
        "Complex table",
        `<table><thead><tr><th>编号</th><th>内容</th><th>校验</th></tr></thead><tbody>${complexTableRows}</tbody></table>`,
      );
    }
    for (let index = 0; index < categoryCounts.nestedHtml; index += 1) {
      addFixture("Nested HTML", `<div data-matrix-fixture="nested-${index + 1}">${nestedHtml}</div>`);
    }
    assert.equal(fixtureContents.length, batchFixtureCount);

    const markdownBytes = fixtureContents.reduce(
      (total, fixture) => total + Buffer.byteLength(fixture.content, "utf8"),
      0,
    );
    const repeatedImageBytes = Buffer.byteLength(repeatedImageContent, "utf8");
    const independentImageBytes = independentImageContents.reduce(
      (total, content) => total + Buffer.byteLength(content, "utf8"),
      0,
    );
    fs.mkdirSync(batchFixtureStagingRoot);
    for (const fixture of fixtureContents)
      fs.writeFileSync(path.join(batchFixtureStagingRoot, fixture.name), fixture.content, "utf8");
    fs.writeFileSync(path.join(batchFixtureStagingRoot, repeatedImageName), repeatedImageContent, "utf8");
    for (const [index, imagePath] of independentImagePaths.entries()) {
      fs.writeFileSync(
        path.join(batchFixtureStagingRoot, path.basename(imagePath)),
        independentImageContents[index],
        "utf8",
      );
    }
    const initialItemCount = await browser.execute(() => {
      const text = document.querySelector(".workspace-location")?.textContent ?? "";
      return Number(text.match(/(\d+)\s*项/)?.[1] ?? 0);
    });
    fs.renameSync(batchFixtureStagingRoot, batchFixtureRoot);
    removeExportArtifacts();

    try {
      await resetDesktopSession();
      await waitForWorkspaceRoot(matrixRoot);
      await waitForWorkspaceItemCountAtLeast(
        initialItemCount + batchFixtureCount,
        "the desktop batch-export matrix did not finish indexing",
      );

      const matrixReports = [];
      const metricFailures = [];
      for (let round = 1; round <= 3; round += 1) {
        removeExportArtifacts();
        const memoryProbe = createApplicationMemoryProbe();
        let rendererProbeActive = false;
        let memoryMetrics = null;
        try {
          await startRendererResponsivenessProbe();
          rendererProbeActive = true;
          await clickWorkspaceExportAction("单文件 Word");
          const contextMetrics = await measureContextToggleWhileExportRunning();
          assert.equal(
            contextMetrics.status,
            "measured",
            `batch export round ${round} did not expose a measurable context action: ${JSON.stringify(contextMetrics)}`,
          );
          await waitForSuccessfulExport(`batch export matrix round ${round}`);
          const rendererMetrics = await stopRendererResponsivenessProbe();
          rendererProbeActive = false;
          memoryMetrics = memoryProbe.stop();
          if (contextMetrics.contextToggleLatencyMs > 150) {
            metricFailures.push(
              `batch export round ${round} context action exceeded 150ms: ${contextMetrics.contextToggleLatencyMs}`,
            );
          }
          if ((rendererMetrics?.maxGapMs ?? Number.POSITIVE_INFINITY) > 250) {
            metricFailures.push(
              `batch export round ${round} renderer gap exceeded 250ms: ${rendererMetrics?.maxGapMs}`,
            );
          }
          if (memoryMetrics.isStrictlyIncreasing) {
            metricFailures.push(
              `batch export round ${round} Working Set grew monotonically: ${JSON.stringify(memoryMetrics)}`,
            );
          }
          assert.deepEqual(listExportTempFiles(), []);
          const artifacts = await validateDocxArtifacts(`batch export matrix round ${round}`, 1);
          const note = await browser.$(".workspace-export-note").getText();
          const exportedCount = Number(note.match(/已导出\s+(\d+)\s+篇/)?.[1] ?? 0);
          assert.ok(
            exportedCount >= batchFixtureCount,
            `batch export round ${round} exported too few documents: ${note}`,
          );
          matrixReports.push({
            round,
            exportedCount,
            artifacts,
            responsiveness: {
              contextToggleLatencyMs: Math.round(contextMetrics.contextToggleLatencyMs),
              rendererSampleCount: rendererMetrics?.sampleCount ?? 0,
              rendererMaxGapMs: Math.round(rendererMetrics?.maxGapMs ?? 0),
            },
            process: {
              measurement: "Windows tasklist Working Set",
              sampleCount: memoryMetrics.sampleCount,
              initialWorkingSetBytes: memoryMetrics.initialWorkingSetBytes,
              peakWorkingSetBytes: memoryMetrics.peakWorkingSetBytes,
              finalWorkingSetBytes: memoryMetrics.finalWorkingSetBytes,
              minimumWorkingSetBytes: memoryMetrics.minimumWorkingSetBytes,
              increasingStepCount: memoryMetrics.increasingStepCount,
              decreasingStepCount: memoryMetrics.decreasingStepCount,
            },
          });
        } finally {
          if (rendererProbeActive) await stopRendererResponsivenessProbe().catch(() => null);
          if (!memoryMetrics) memoryProbe.stop();
        }
      }

      removeExportArtifacts();
      const cancellationMemoryProbe = createApplicationMemoryProbe();
      let cancellationRendererProbeActive = false;
      let cancellationMemoryMetrics = null;
      let cancellationReport = null;
      try {
        await waitForExportToSettle();
        await startRendererResponsivenessProbe();
        cancellationRendererProbeActive = true;
        await clickWorkspaceExportAction("单文件 Word");
        const contextMetrics = await measureContextToggleWhileExportRunning();
        assert.equal(
          contextMetrics.status,
          "measured",
          `batch export cancellation did not expose a measurable context action: ${JSON.stringify(contextMetrics)}`,
        );
        const cancellationMetrics = await cancelExportAfterFirstCommittedVolume();
        assert.equal(
          cancellationMetrics.status,
          "cancelled",
          `batch export cancellation did not reach the post-volume cancellation path: ${JSON.stringify(cancellationMetrics)}`,
        );
        await waitForExportToSettle();
        const cancellationLatencyMs = cancellationMetrics.cancellationLatencyMs;
        const rendererMetrics = await stopRendererResponsivenessProbe();
        cancellationRendererProbeActive = false;
        cancellationMemoryMetrics = cancellationMemoryProbe.stop();
        if (contextMetrics.contextToggleLatencyMs > 150) {
          metricFailures.push(
            `batch export cancellation context action exceeded 150ms: ${contextMetrics.contextToggleLatencyMs}`,
          );
        }
        if (cancellationLatencyMs > 1_000) {
          metricFailures.push(`batch export cancellation exceeded 1s: ${cancellationLatencyMs}`);
        }
        if ((rendererMetrics?.maxGapMs ?? Number.POSITIVE_INFINITY) > 250) {
          metricFailures.push(`batch export cancellation renderer gap exceeded 250ms: ${rendererMetrics?.maxGapMs}`);
        }
        if (cancellationMemoryMetrics.isStrictlyIncreasing) {
          metricFailures.push(
            `batch export cancellation Working Set grew monotonically: ${JSON.stringify(cancellationMemoryMetrics)}`,
          );
        }
        assert.match(await browser.$(".workspace-export-note").getText(), /已取消批量导出/);
        assert.deepEqual(listExportTempFiles(), []);
        const artifacts = await validateDocxArtifacts("cancelled batch export", 1);
        cancellationReport = {
          contextToggleLatencyMs: Math.round(contextMetrics.contextToggleLatencyMs),
          cancellationLatencyMs: Math.round(cancellationLatencyMs),
          rendererMaxGapMs: Math.round(rendererMetrics?.maxGapMs ?? 0),
          artifacts,
          process: {
            measurement: "Windows tasklist Working Set",
            sampleCount: cancellationMemoryMetrics.sampleCount,
            initialWorkingSetBytes: cancellationMemoryMetrics.initialWorkingSetBytes,
            peakWorkingSetBytes: cancellationMemoryMetrics.peakWorkingSetBytes,
            finalWorkingSetBytes: cancellationMemoryMetrics.finalWorkingSetBytes,
            minimumWorkingSetBytes: cancellationMemoryMetrics.minimumWorkingSetBytes,
            increasingStepCount: cancellationMemoryMetrics.increasingStepCount,
            decreasingStepCount: cancellationMemoryMetrics.decreasingStepCount,
          },
        };
      } finally {
        if (cancellationRendererProbeActive) await stopRendererResponsivenessProbe().catch(() => null);
        if (!cancellationMemoryMetrics) cancellationMemoryProbe.stop();
      }

      removeExportArtifacts();
      fs.mkdirSync(firstVolumePath);
      try {
        await clickWorkspaceExportAction("单文件 Word");
        const errorAlert = await browser.$('[role="alert"]');
        await browser.waitUntil(
          async () => (await errorAlert.isDisplayed()) && /导出|保存|失败/.test(await errorAlert.getText()),
          { timeout: 120_000, timeoutMsg: "the batch export failure fixture did not report an error" },
        );
        await waitForExportToSettle();
        assert.equal(fs.statSync(firstVolumePath).isDirectory(), true);
        assert.deepEqual(listExportTempFiles(), []);
      } finally {
        fs.rmSync(firstVolumePath, { recursive: true, force: true });
      }

      logExportBenchmark({
        fixture: {
          documentCount: batchFixtureCount,
          categories: categoryCounts,
          markdownBytes,
          imageCount: 1 + independentImagePaths.length,
          imageBytes: repeatedImageBytes + independentImageBytes,
          repeatedImageBytes,
          independentImageBytes,
        },
        thresholds: {
          rendererMaxGapMs: 250,
          contextToggleLatencyMs: 150,
          cancellationLatencyMs: 1_000,
        },
        rounds: matrixReports,
        cancellation: cancellationReport,
        failureCleanup: { targetRemainsDirectory: true, tempFiles: 0 },
      });
      assert.equal(metricFailures.length, 0, metricFailures.join("; "));
    } finally {
      fs.rmSync(batchFixtureStagingRoot, { recursive: true, force: true });
      fs.rmSync(batchFixtureRoot, { recursive: true, force: true });
      fs.rmSync(firstVolumePath, { recursive: true, force: true });
      removeExportArtifacts();
      fs.rmSync(repeatedImagePath, { force: true });
      for (const imagePath of independentImagePaths) fs.rmSync(imagePath, { force: true });
      for (const fixturePath of batchFixturePaths) fs.rmSync(fixturePath, { force: true });
    }
  });

  it("reloads an unmodified document after an external workspace change", async () => {
    const externalText = "外部程序已经更新内容。";
    await clickToolbarAction("阅读");
    await browser.$(".reader-content").waitForDisplayed();
    // The previous case just saved this file; let the intentional self-write
    // suppression window expire before simulating another process.
    await browser.pause(2_000);
    fs.appendFileSync(documentPath, `\n${externalText}\n`, "utf8");

    await browser.waitUntil(
      async () => {
        const editor = await browser.$(".reader-content");
        return (await editor.getText()).includes(externalText);
      },
      {
        timeout: 15_000,
        timeoutMsg: "the workspace watcher did not reload the unmodified document",
      },
    );

    assert.match(await browser.$(".document-title").getText(), /desktop-e2e\.md/);
  });

  it("refreshes the file tree after external files and directories are added and removed", async () => {
    const directoryName = "watch-added";
    const fileName = "nested-note.md";
    const directoryPath = path.join(path.dirname(documentPath), directoryName);
    const addedFilePath = path.join(directoryPath, fileName);

    fs.mkdirSync(directoryPath);
    fs.writeFileSync(addedFilePath, "# Watch added\n\n来自外部新增。\n", "utf8");

    await waitForWorkspaceEntry(
      ".workspace-folder",
      directoryName,
      true,
      "the workspace watcher did not add the external directory to the file tree",
    );
    await waitForWorkspaceEntry(
      ".workspace-file",
      fileName,
      true,
      "the workspace watcher did not add the external file to the file tree",
    );

    fs.rmSync(directoryPath, { recursive: true, force: true });

    await waitForWorkspaceEntry(
      ".workspace-folder",
      directoryName,
      false,
      "the workspace watcher did not remove the deleted directory from the file tree",
    );
    await waitForWorkspaceEntry(
      ".workspace-file",
      fileName,
      false,
      "the workspace watcher did not remove the deleted file from the file tree",
    );
  });

  it("keeps each real document reading position when switching files", async () => {
    const workspacePath = path.dirname(documentPath);
    const longName = "position-long.md";
    const shortName = "position-short.md";
    const longPath = path.join(workspacePath, longName);
    const shortPath = path.join(workspacePath, shortName);
    const sections = Array.from(
      { length: 36 },
      (_, index) => `## Position section ${index + 1}\n\n用于验证切换文件时阅读位置不会被另一个文档覆盖。\n\n`,
    );

    fs.writeFileSync(longPath, `# Long position note\n\n${sections.join("")}`, "utf8");
    fs.writeFileSync(shortPath, "# Short position note\n\n短文档", "utf8");

    try {
      await waitForWorkspaceEntry(
        ".workspace-file",
        longName,
        true,
        "the long reading-position fixture did not appear",
      );
      await waitForWorkspaceEntry(
        ".workspace-file",
        shortName,
        true,
        "the short reading-position fixture did not appear",
      );

      await clickWorkspaceFile(longName);
      await ensureRenderedMode();
      await browser.$("h1=Long position note").waitForDisplayed();

      await browser.waitUntil(
        () =>
          browser.execute(() => {
            const contentArea = document.querySelector(".content-area");
            return contentArea instanceof HTMLElement && contentArea.scrollHeight > contentArea.clientHeight;
          }),
        { timeout: 15_000, timeoutMsg: "the long reading-position fixture did not become scrollable" },
      );
      await browser.execute(() => {
        const contentArea = document.querySelector(".content-area");
        if (!(contentArea instanceof HTMLElement)) throw new Error("the reader content area was not found");
        contentArea.scrollTop = contentArea.scrollHeight;
        const EventConstructor = document.defaultView?.Event;
        if (!EventConstructor) throw new Error("the browser Event constructor was not found");
        contentArea.dispatchEvent(new EventConstructor("scroll"));
      });
      await browser.waitUntil(
        () =>
          browser.execute(
            () =>
              (document.querySelector(".content-area") instanceof HTMLElement
                ? document.querySelector(".content-area").scrollTop
                : 0) > 0,
          ),
        { timeout: 5_000, timeoutMsg: "the long document did not record a non-zero reading position" },
      );
      await waitForSavedReadingPosition(longName);
      await clickWorkspaceFile(shortName);
      await ensureRenderedMode();
      await browser.$("h1=Short position note").waitForDisplayed();
      await browser.waitUntil(
        () =>
          browser.execute(
            () =>
              (document.querySelector(".content-area") instanceof HTMLElement
                ? document.querySelector(".content-area").scrollTop
                : -1) === 0,
          ),
        { timeout: 5_000, timeoutMsg: "the short document did not reset the reading position" },
      );
      await clickWorkspaceFile(longName);
      await ensureRenderedMode();
      await browser.$("h1=Long position note").waitForDisplayed();
      await browser.waitUntil(
        () =>
          browser.execute(
            () =>
              (document.querySelector(".content-area") instanceof HTMLElement
                ? document.querySelector(".content-area").scrollTop
                : 0) > 0,
          ),
        { timeout: 5_000, timeoutMsg: "the long document did not restore its reading position" },
      );
    } finally {
      try {
        await clickWorkspaceFile(path.basename(documentPath));
        await clickToolbarAction("源文本");
        await clickToolbarAction("阅读");
      } catch {
        // The fixture cleanup must still run if the document-switch assertion failed.
      }
      fs.rmSync(longPath, { force: true });
      fs.rmSync(shortPath, { force: true });
    }
  });

  it("flushes the latest draft before switching documents", async () => {
    const targetName = "draft-flush-target.md";
    const targetPath = path.join(path.dirname(documentPath), targetName);
    const draftText = "切页前最后一段输入。";
    let confirmIntercepted = false;
    let targetOpened = false;
    fs.writeFileSync(targetPath, "# Draft flush target\n\n目标文档。\n", "utf8");

    try {
      await waitForWorkspaceEntry(
        ".workspace-file",
        targetName,
        true,
        "the draft-flush target did not appear in the workspace",
      );
      if (await browser.$("button=阅读").isExisting()) {
        await clickToolbarAction("阅读");
      }
      if (await browser.$("button=编辑").isExisting()) {
        await clickToolbarAction("编辑");
      }
      await browser.$('.wysiwyg-editor [contenteditable="true"]').waitForDisplayed();
      await clickToolbarAction("源文本");
      const editor = await browser.$('[aria-label="Markdown 源文本"]');
      await editor.waitForDisplayed();
      await browser.execute((text) => {
        const target = document.querySelector('[aria-label="Markdown 源文本"]');
        if (!(target instanceof HTMLElement)) throw new Error("source editor was not found");
        const view = target.cmTile?.root?.view;
        if (!view) throw new Error("CodeMirror view is unavailable");
        view.dispatch({ changes: { from: view.state.doc.length, insert: `\n${text}` } });
      }, draftText);
      await browser.waitUntil(() => editor.getText().then((value) => value.includes(draftText)), {
        timeout: 5_000,
        timeoutMsg: "the latest draft edit was not applied before switching",
      });

      await browser.execute(() => {
        window.__desktopE2EOriginalConfirm = window.confirm;
        window.__desktopE2EConfirmMessage = null;
        window.confirm = (message) => {
          window.__desktopE2EConfirmMessage = String(message);
          return true;
        };
      });
      confirmIntercepted = true;
      await clickWorkspaceFile(targetName);
      await browser.waitUntil(() => browser.execute(() => typeof window.__desktopE2EConfirmMessage === "string"), {
        timeout: 5_000,
        timeoutMsg: "switching documents did not show the draft-preservation confirmation",
      });
      const confirmationMessage = await browser.execute(() => window.__desktopE2EConfirmMessage || "");
      assert.match(confirmationMessage, /自动保留为草稿/);
      await browser.$("h1=Draft flush target").waitForDisplayed();
      targetOpened = true;

      const savedDraft = await browser.execute((expectedPath) => {
        const normalize = (value) => value.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
        const expected = normalize(expectedPath);
        const expectedName = expected.slice(expected.lastIndexOf("/") + 1);
        const drafts = JSON.parse(window.localStorage.getItem("moyang-reader-drafts") || "[]");
        return (
          drafts.find((snapshot) => {
            const actual = normalize(snapshot.path);
            return actual === expected || actual.endsWith(`/${expectedName}`);
          }) ?? null
        );
      }, documentPath);
      assert.ok(savedDraft, "the latest edit was not flushed to local draft storage");
      assert.match(savedDraft.draft, new RegExp(draftText));

      await clickWorkspaceFile(path.basename(documentPath));
      await discardDraftNotice();
      targetOpened = false;
      if (!(await browser.$("button=编辑").isExisting())) {
        if (await browser.$("button=源文本").isExisting()) {
          await clickToolbarAction("源文本");
        }
        if (await browser.$("button=阅读").isExisting()) {
          await clickToolbarAction("阅读");
        }
      }
      await browser.$(".reader-content").waitForDisplayed();
    } finally {
      if (targetOpened) {
        try {
          await clickWorkspaceFile(path.basename(documentPath));
          await discardDraftNotice();
        } catch {
          // Preserve the original assertion when desktop cleanup cannot finish.
        }
      }
      if (confirmIntercepted) {
        await browser
          .execute(() => {
            window.confirm = window.__desktopE2EOriginalConfirm;
            delete window.__desktopE2EOriginalConfirm;
            delete window.__desktopE2EConfirmMessage;
          })
          .catch(() => undefined);
      }
      fs.rmSync(targetPath, { force: true });
    }
  });

  it("shows a conflict notice without replacing unsaved local edits", async () => {
    const localText = "本地未保存内容。";
    const externalText = "外部冲突内容。";

    await clickToolbarAction("编辑");
    await browser.$('.wysiwyg-editor [contenteditable="true"]').waitForDisplayed();
    await clickToolbarAction("源文本");
    const editor = await browser.$('[aria-label="Markdown 源文本"]');
    await editor.waitForDisplayed();
    await browser.execute((text) => {
      const target = document.querySelector('[aria-label="Markdown 源文本"]');
      if (!(target instanceof HTMLElement)) throw new Error("source editor was not found");
      const view = target.cmTile?.root?.view;
      if (!view) throw new Error("CodeMirror view is unavailable");
      view.dispatch({ changes: { from: view.state.doc.length, insert: `\n${text}` } });
    }, localText);
    await browser.waitUntil(() => editor.getText().then((value) => value.includes(localText)), {
      timeout: 5_000,
      timeoutMsg: "the local unsaved edit was not applied before the conflict test",
    });

    await browser.pause(2_000);
    fs.appendFileSync(documentPath, `\n${externalText}\n`, "utf8");

    const notice = await browser.$(".external-change-notice");
    await notice.waitForDisplayed();
    assert.match(await notice.getText(), /已被其他程序修改/);
    assert.match(await editor.getText(), new RegExp(localText));
    assert.equal(await browser.$("button=重新载入").isDisplayed(), true);
  });

  it("keeps the external-change marker after dismiss and blocks accidental overwrite", async () => {
    const localText = "本地未保存内容。";
    const notice = await browser.$(".external-change-notice");
    await notice.$("button=稍后处理").click();
    await browser.waitUntil(() => notice.isDisplayed().then((visible) => !visible), {
      timeout: 5_000,
      timeoutMsg: "the external-change notice did not hide",
    });

    assert.equal(await browser.$(".external-modified-indicator").isDisplayed(), true);
    assert.equal(await browser.$(".statusbar-external-change").getText(), "外部修改待处理");

    assert.equal(await browser.$("button=保存").isEnabled(), true);
    await clickToolbarAction("保存");
    await browser.waitUntil(() => browser.$(".external-change-notice").isDisplayed(), {
      timeout: 5_000,
      timeoutMsg: "saving a stale document did not reopen the conflict notice",
    });
    assert.equal(fs.readFileSync(documentPath, "utf8").includes(localText), false);

    await browser.$(".external-change-notice").$("button=覆盖保存").click();
    const overwriteDialog = await browser.$('[role="dialog"][aria-labelledby="external-overwrite-title"]');
    await overwriteDialog.waitForDisplayed();
    await overwriteDialog.$('[data-testid="external-overwrite-confirm"]').click();
    await browser.waitUntil(() => fs.readFileSync(documentPath, "utf8").includes(localText), {
      timeout: 15_000,
      timeoutMsg: "explicit overwrite did not write the local document",
    });

    const editor = await browser.$('[aria-label="Markdown 源文本"]');
    await browser.execute((text) => {
      const target = document.querySelector('[aria-label="Markdown 源文本"]');
      if (!(target instanceof HTMLElement)) throw new Error("source editor was not found");
      const view = target.cmTile?.root?.view;
      if (!view) throw new Error("CodeMirror view is unavailable");
      view.dispatch({ changes: { from: view.state.doc.length, insert: `\n${text}` } });
    }, "关闭前未保存内容。");
    await browser.waitUntil(() => editor.isDisplayed(), {
      timeout: 5_000,
      timeoutMsg: "the source editor disappeared after resolving the conflict",
    });
  });

  it("keeps the window and local edits after cancelling a close request", async () => {
    await requestCloseRequest();
    const firstDialog = await waitForCloseConfirmation();
    assert.match(await firstDialog.getText(), /未保存修改/);
    await firstDialog.$('[data-testid="close-confirm-cancel"]').click();
    await browser.waitUntil(
      async () => {
        try {
          return !(await browser.$('[role="dialog"][aria-labelledby="close-confirm-title"]').isDisplayed());
        } catch {
          return true;
        }
      },
      {
        timeout: 5_000,
        timeoutMsg: "the close confirmation did not dismiss",
      },
    );

    const editor = await browser.$('[aria-label="Markdown 源文本"]');
    await editor.waitForDisplayed();
    assert.match(await editor.getText(), /本地未保存内容/);

    await requestCloseRequest();
    const secondDialog = await waitForCloseConfirmation();
    assert.match(await secondDialog.getText(), /未保存修改/);
    assert.equal(await secondDialog.$('[data-testid="close-confirm-confirm"]').getText(), "退出 Moyang Reader");
    await secondDialog.$('[data-testid="close-confirm-cancel"]').click();
  });
});
