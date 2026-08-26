import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

async function workspaceEntryExists(selector, text = "") {
  const entries = await browser.$$(selector);
  for (const entry of entries) {
    if (!text || (await entry.getText()).includes(text)) return true;
  }
  return false;
}

async function waitForWorkspaceEntry(selector, text, expected, description) {
  await browser.waitUntil(() => workspaceEntryExists(selector, text).then((exists) => exists === expected), {
    timeout: 15_000,
    timeoutMsg: description,
  });
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
    const pdfAction = await browser.$("button=保存 PDF");
    await pdfAction.waitForDisplayed();
    await pdfAction.click();
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
      await clickToolbarAction("源文本");
      await clickToolbarAction("阅读");
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
      await clickWorkspaceFile(shortName);
      await clickToolbarAction("源文本");
      await clickToolbarAction("阅读");
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
      await clickToolbarAction("源文本");
      await clickToolbarAction("阅读");
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
