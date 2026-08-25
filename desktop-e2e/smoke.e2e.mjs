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

async function clickToolbarAction(name) {
  const menu = await browser.$("details.toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await menu.$("summary.toolbar-overflow-trigger").click();
  }
  await browser.$(`button=${name}`).click();
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

  it("exports the workspace to HTML and Word through the real Tauri write path", async () => {
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
});
