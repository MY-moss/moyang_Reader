import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { connectMcp } from "../scripts/mcp-test-client.mjs";

async function selectSpace(space) {
  await browser.execute((space) => { const select = document.querySelector('select[aria-label="工作空间"]'); select.value = space; select.dispatchEvent(new window.Event("change", { bubbles: true })); }, space);
  await browser.waitUntil(() => browser.execute((space) => document.body.dataset.activeSpace === space, space));
}

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
  if (["编辑", "源文本", "阅读", "保存"].includes(name)) {
    const clicked = await browser.execute((name) => { const button = [...document.querySelectorAll(".reader-pane.is-active .document-actions button")].find((button) => button.textContent.trim() === name && !button.disabled); if (!button) return false; button.click(); return true; }, name);
    if (clicked) return;
  }
  if (name === "源文本") {
    const enterEditing = await browser.$('button[aria-label="直接进入编辑模式"]');
    if (await enterEditing.isExisting()) await ensureWysiwygMode();
  }
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

async function readerText() {
  return browser.execute(() => document.querySelector(".reader-pane.is-active .reader-stage .reader-content")?.textContent ?? "");
}
async function ensureRenderedMode() {
  await browser.execute(() => {
    const button = document.querySelector('.reader-pane.is-active button[aria-label="直接返回阅读模式"]'); button?.click();
  });
  try {
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".reader-pane.is-active .reader-stage .reader-content"))), { timeout:15000, timeoutMsg:"active reader did not enter rendered mode" });
  } catch (error) {
    console.error("Render failure live state", JSON.stringify(await browser.execute(() => ({body:document.body.innerText,panes:window.localStorage.getItem("moyang.workbench.panes.v1"),tabs:window.localStorage.getItem("moyang-reader-open-tabs")}))));
    throw error;
  }
}

async function restoreInitialDocument() {
  const name = path.basename(documentPath);
  try {
    await browser.$('button[aria-label="快速打开"]').click();
    const input = await browser.$(".quick-open-dialog input");
    await input.waitForDisplayed();
    await input.setValue(name);
    await browser.waitUntil(() => browser.execute((name) =>
      [...document.querySelectorAll(".quick-open-item")].some((item) => item.querySelector("strong")?.textContent === name), name),
      { timeoutMsg: `quick open did not offer the cleanup target ${name}` });
    // Cleanup must select the intended UI result. The embedded driver can send
    // WebDriver's Enter token as text, leaving this modal open across tests.
    await browser.execute((name) => {
      [...document.querySelectorAll(".quick-open-item")].find((item) => item.querySelector("strong")?.textContent === name).click();
    }, name);
    await browser.waitUntil(() => browser.execute((name) =>
      !document.querySelector(".quick-open-dialog") && document.querySelector(".document-title")?.textContent.includes(name), name),
      { timeoutMsg: `cleanup did not return to ${name}` });
  } finally {
    // Even a failed restoration must not leave an input modal over the next test.
    await browser.execute(() => {
      document.querySelector(".quick-open-dialog input")?.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
      );
    });
  }
}

async function showDocumentProperties() {
  await browser.execute(() => document.querySelector('button[aria-label="显示上下文"]')?.click());
  const panel = await browser.$('.context-sidebar[aria-label="当前文档上下文"]');
  await panel.waitForDisplayed();
  const tab = await panel.$("button=属性");
  assert.equal(await tab.getAttribute("role"), "tab");
  await tab.click();
  await browser.$("button=编辑文档属性").waitForDisplayed();
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
      timeout: 15_000,
      timeoutMsg: `${description} did not create an output file`,
    },
  );
}

async function workspaceEntryMatches(selector, entry, text) {
  if (!text) return true;
  if (selector === ".workspace-folder") {
    return (await entry.$(".workspace-folder-name").getText()).trim() === text;
  }
  return (await entry.getText()).includes(text);
}

async function workspaceEntryExists(selector, text = "") {
  // The embedded driver retains references to detached elements. Read the live
  // DOM for absence assertions instead of querying its cached element collection.
  return browser.execute(
    (selector, text) =>
      Array.from(document.querySelectorAll(selector)).some((entry) => {
        if (!text) return true;
        const label = selector === ".workspace-folder" ? entry.querySelector(".workspace-folder-name") : entry;
        return selector === ".workspace-folder"
          ? label?.textContent.trim() === text
          : label?.textContent.includes(text);
      }),
    selector,
    text,
  );
}

async function waitForWorkspaceEntry(selector, text, expected, description) {
  try {
    await browser.waitUntil(() => workspaceEntryExists(selector, text).then((exists) => exists === expected), {
      timeout: 15_000,
      timeoutMsg: description,
    });
  } catch (error) {
    console.error(
      "Current workspace DOM",
      await browser.execute(() => document.querySelector(".workspace-tree")?.textContent),
    );
    console.error(
      "Workspace refresh trace",
      JSON.stringify(
        await browser.execute(
          (name) =>
            (window.__readerTestEvents ?? []).filter((item) => JSON.stringify(item.data).includes(name)).slice(-12),
          text,
        ),
      ),
    );
    throw error;
  }
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
  const file = await browser.$(`.workspace-file[title*="${name}"]`);
  await file.waitForDisplayed();
  await file.click();
  await browser.waitUntil(
    () => browser.execute((name) => document.querySelector(".document-title")?.textContent.includes(name), name),
    {
      timeout: 15_000,
      timeoutMsg: `workspace file ${name} did not finish opening`,
    },
  );
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
    await browser.execute(() => { [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "知道了")?.click(); });
    assert.equal(await browser.$("button=打开列表").isExisting(), false);
    assert.equal(await browser.$("summary=批量导出").isDisplayed(), true);

    await ensureWysiwygMode();

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

  it("keeps all documents reachable in a virtualized large library", async () => {
    const root = path.dirname(documentPath);
    const bulkPath = path.join(root, "large-library");
    fs.mkdirSync(bulkPath);
    for (let index = 0; index < 350; index++) {
      fs.writeFileSync(path.join(bulkPath, `bulk-${String(index).padStart(3, "0")}.md`), `# Bulk ${index}\n`, "utf8");
    }
    try {
      await browser.$(".virtual-rows").waitForDisplayed();
      const count = await browser.execute(() => document.querySelectorAll(".virtual-row").length);
      assert.ok(count < 120, `large library rendered ${count} rows at once`);
      const total = Number(await browser.$(".virtual-rows").getAttribute("data-total-rows"));
      assert.ok(total >= 350, "virtual tree lost documents");
      // The embedded driver sends WebDriver special keys as literal private-use
      // characters. Dispatch the standard DOM key to exercise the real React handler.
      await browser.execute(() => {
        const button = document.querySelector(".virtual-row button");
        button?.focus();
        button?.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "End", code: "End", bubbles: true, cancelable: true }),
        );
      });
      await waitForWorkspaceEntry(".workspace-file", "bulk-349.md", true, "last virtual row was unreachable");
      await clickWorkspaceFile("bulk-349.md");
      await ensureRenderedMode();
      assert.match(await readerText(), /Bulk 349/);
    } finally {
      try {
        await restoreInitialDocument();
      } finally {
        assert.equal(path.dirname(path.resolve(bulkPath)), path.resolve(root));
        fs.rmSync(bulkPath, { recursive: true, force: true });
      }
      await browser.waitUntil(async () => !(await browser.$(".virtual-rows").isExisting()), { timeout: 15000 });
    }
  });

  it("reads cross-document block embeds and saves property form edits without changing the body", async () => {
    const root = path.dirname(documentPath);
    const source = path.join(root, "embed-source.md");
    const note = path.join(root, "properties-roundtrip.md");
    const body = "# Property roundtrip\n\n![[embed-source#^quote]]\n\n正文需要保留。\n";
    fs.writeFileSync(source, "# Source\n\n来自另一个文档的原文。 ^quote\n", "utf8");
    fs.writeFileSync(note, body, "utf8");
    try {
      await waitForWorkspaceEntry(
        ".workspace-file",
        "properties-roundtrip.md",
        true,
        "new property document did not appear",
      );
      await clickWorkspaceFile("properties-roundtrip.md");
      await ensureRenderedMode();
      await browser.waitUntil(() => browser.execute(() => document.querySelector(".reader-pane.is-active .document-embed")?.textContent?.includes("来自另一个文档的原文")), {timeout:15000});
      await showDocumentProperties();
      await browser.$("button=编辑文档属性").click();
      await browser.$('input[placeholder="文档的显示标题"]').setValue("桌面属性测试");
      await browser.$('input[placeholder="阅读, 工作, 灵感"]').setValue("阅读, 测试");
      await browser.$("button=应用到文档").click();
      // Save through the actual shortcut; autosave may already have removed the
      // conditional Save button while the driver was locating the next element.
      await browser.execute(() => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })));
      await browser.waitUntil(() => fs.readFileSync(note, "utf8").includes("title: 桌面属性测试"));
      assert.ok(fs.readFileSync(note, "utf8").endsWith(body), "property form changed the body");
    } finally {
      try {
        await restoreInitialDocument();
      } finally {
        fs.rmSync(source, { force: true });
        fs.rmSync(note, { force: true });
      }
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
      await browser.waitUntil(async () => (await readerText()).includes("Long position note"), {timeout:15000});

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
      await browser.waitUntil(async () => (await readerText()).includes("Short position note"), {timeout:15000});
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
      await browser.waitUntil(async () => (await readerText()).includes("Long position note"), {timeout:15000});
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

  it("preserves an editing session on a file switch and autosaves its background draft", async () => {
    const targetName = "draft-flush-target.md"; const targetPath = path.join(path.dirname(documentPath), targetName);
    fs.writeFileSync(targetPath, "# Other note\n", "utf8");
    await waitForWorkspaceEntry(".workspace-file", targetName, true, "switch target was not indexed");
    await clickWorkspaceFile(path.basename(documentPath)); await clickToolbarAction("源文本");
    const value = "切换后继续自动保存的草稿";
    await browser.execute((text) => {
      const target = document.querySelector('[aria-label="Markdown 源文本"]'); const view = target?.cmTile?.root?.view;
      if (!view) throw new Error("CodeMirror unavailable"); view.dispatch({ changes: { from: view.state.doc.length, insert: "\n" + text } });
    }, value);
    await clickWorkspaceFile(targetName);
    await browser.waitUntil(() => fs.readFileSync(documentPath, "utf8").includes(value), { timeout: 15000 });
    await clickWorkspaceFile(path.basename(documentPath));
    assert.ok((await browser.$('[aria-label="Markdown 源文本"]').getText()).includes(value));
    await ensureRenderedMode(); fs.rmSync(targetPath, { force: true });
  });

  it("shares knowledge, long-term memory and skills with a real MCP process", async () => {
    await ensureRenderedMode();
    const before = await readerText();
    await selectSpace("ai");
    await browser.$(".ai-sidebar").waitForDisplayed();
    const memoryNav = (await browser.$$(".ai-sidebar nav button"))[1];
    await memoryNav.click();
    await browser.$("button=新建记忆").click();
    await browser.$('.ai-title-input').setValue("桌面长期偏好");
    await browser.$("button=源码模式").click();
    await browser.$('.ai-shared-editor .cm-content').waitForDisplayed();
    await browser.execute(()=>{const target=document.querySelector('.ai-shared-editor .cm-content');const view=target?.cmTile?.root?.view;if(!view)throw new Error("AI editor unavailable");view.dispatch({changes:{from:0,to:view.state.doc.length,insert:"偏好清晰简洁的中文说明。"}});});
    await browser.$("button=保存内容").click();
    await browser.waitUntil(async () => (await browser.$(".ai-document h1").getText()) === "桌面长期偏好");
    const info = await browser.execute(() => window.__TAURI_INTERNALS__.invoke("ai_connection_info"));
    assert.equal(info.available, true);
    const client = await connectMcp(info.executable, info.directory);
    try {
      const found = await client.call("search", { query: "中文", kind: "memory" });
      assert.equal(found.total, 1);
      const original = await client.call("get_record", { id: found.items[0].id });
      const revised = await client.call("save_record", {
        ...original,
        expected_revision: original.revision,
        body: "偏好清晰中文，重要结论放在开头。",
        reason: "MCP 实际修订",
      });
      assert.equal(revised.revision, 2);
      await client.call("save_record", {
        kind: "knowledge",
        title: "桌面接入说明",
        body: "多个 Agent 共用本机资料。",
        source: "桌面测试",
      });
      const skill = await client.call("save_record", {
        kind: "skill",
        title: "native-review",
        summary: "审阅资料时使用",
        body: "先核对来源，再检查结论。",
        assets: [{ path: "references/check.md", encoding: "utf8", content: "核对出处" }],
      });
      assert.equal(
        (await client.call("read_skill_resource", { id: skill.id, path: "references/check.md" })).content,
        "核对出处",
      );
      await browser.$('button[aria-label="刷新 AI 内容"]').click();
      await browser.waitUntil(async () => (await browser.$(".ai-prose").getText()).includes("重要结论放在开头"));
      await browser.$("button=查看历史").click();
      assert.equal((await browser.$$(".ai-history details")).length, 2);
      const stats = await client.call("library_status");
      assert.equal(stats.memory, 1);
      assert.equal(stats.knowledge, 1);
      assert.equal(stats.skill, 1);
      const checkpoint=(await client.call("task_checkpoint",{client:"desktop-mcp-test",session:"session",turn:"task-1",agent:"codex",project:""})).checkpoint;
      const current=await client.call("get_record",{id:original.id});
      const task={checkpoint_id:checkpoint.id,reason:"用户明确更正表达习惯",decisions:[{action:"correct",record:{...current,expected_revision:current.revision,body:"先给结论，再给可验证的依据。"},evidence:"用户原话：以后先给结论，再给依据",explicit_correction:true}]};
      const first=await client.call("conclude_task",task);const repeated=await client.call("conclude_task",task);assert.deepEqual(first.record_ids,repeated.record_ids);
      const activity=(await client.call("recent_activity")).activities.find(a=>a.record_id===original.id);assert.ok(activity);
      await client.call("undo_memory_activity",{id:activity.id});assert.equal((await client.call("get_record",{id:original.id})).body,current.body);
      await client.call("undo_memory_activity",{id:activity.id,restore:true});assert.match((await client.call("get_record",{id:original.id})).body,/可验证/);
      const skillCheckpoint=(await client.call("task_checkpoint",{client:"desktop-mcp-test",session:"session",turn:"task-2",agent:"codex",project:""})).checkpoint;
      const previousSkill=await client.call("get_record",{id:skill.id});
      await client.call("conclude_task",{checkpoint_id:skillCheckpoint.id,reason:"审阅任务验证了来源检查顺序",decisions:[{action:"improve_skill",record:{...previousSkill,expected_revision:previousSkill.revision,body:"先核对来源，再检查结论；最后列出未验证项。"},evidence:"任务结果：提前列出未验证项，避免遗漏一个出处",outcome:"success"}]});
      assert.equal((await client.call("read_skill_resource",{id:skill.id,path:"references/check.md"})).content,"核对出处");
      const detail=await client.call("revision_detail",{id:skill.id,revision:2});assert.match(detail.reason,/审阅任务/);assert.ok(!detail.record.assets);
      const backup=await browser.execute(()=>window.__TAURI_INTERNALS__.invoke("ai_request",{operation:"backup",payload:{}}));assert.equal(backup.version,2);assert.equal(backup.checkpoints.length,2);assert.equal(backup.activities.length,2);
      await browser.$("button=近期活动与冲突").click();await browser.$(".ai-activity").waitForDisplayed();assert.match(await browser.$(".ai-activity").getText(),/用户明确更正表达习惯/);
      fs.mkdirSync(path.resolve("artifacts/workbench"),{recursive:true});
      await browser.saveScreenshot(path.resolve("artifacts/workbench/ai-activity-desktop.png"));
      await browser.$("button=接入与备份").click();
      await browser.waitUntil(async()=> (await browser.$$(".ai-client-connection")).length===2);
      assert.match(await browser.$(".ai-client-connections").getText(),/Codex 桌面端/);
      await browser.saveScreenshot(path.resolve("artifacts/workbench/ai-connections-desktop.png"));

    } finally {
      await client.close();
    }
    await selectSpace("reader");
    assert.equal(await readerText(), before);
  });

  it("shows a conflict notice without replacing unsaved local edits", async () => {
    await browser.execute(() => window.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true })));
    const localText = "本地未保存内容。";
    const externalText = "外部冲突内容。";

    await clickToolbarAction("编辑");
    await ensureWysiwygMode();
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
    await browser.execute(() => window.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true })));
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
    fs.appendFileSync(documentPath, "\n关闭时的外部修改\n", "utf8");
    await browser.$(".external-change-notice").waitForDisplayed();
    await browser.execute(() => { const view = document.querySelector('[aria-label="Markdown 源文本"]')?.cmTile?.root?.view; view?.dispatch({ changes: { from: view.state.doc.length, insert: "\n等待处理的关闭草稿" } }); });
    await selectSpace("ai");
    await requestCloseRequest();
    const firstDialog = await waitForCloseConfirmation();
    assert.equal(await browser.execute(() => document.body.dataset.activeSpace), "ai");
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

    await selectSpace("reader");
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
