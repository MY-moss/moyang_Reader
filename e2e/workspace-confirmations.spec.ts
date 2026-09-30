import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Exercises the shipped App/controller/modal with an isolated IPC fixture.
// Actual Windows filesystem and Recycle Bin behavior is covered by desktop smoke.
async function loadWorkspace(page: Page, locale: "zh-CN" | "en-US", theme: "porcelain" | "ink") {
  await page.addInitScript(
    ({ locale, theme }) => {
      localStorage.setItem("moyang-reader-locale", locale);
      localStorage.setItem("moyang-reader-theme", theme);
      localStorage.setItem("moyang-reader-getting-started-seen", "true");
      const root = `C:/Notes/${"long-library-path-".repeat(6)}Library`;
      const folder = { path: `${root}/Projects`, name: "Projects", relativePath: "Projects" };
      const file = {
        path: `${folder.path}/笔记.txt`,
        name: "笔记.txt",
        relativePath: "Projects/笔记.txt",
        kind: "text",
        size: 8,
      };
      const fixture = {
        calls: [] as string[],
        failSave: false,
        deleted: false,
        source: "Original note",
        nativeConfirmCalls: 0,
      };
      const runtime = window as unknown as Record<string, unknown>;
      runtime.__workspaceConfirmationFixture = fixture;
      window.confirm = () => {
        fixture.nativeConfirmCalls += 1;
        throw new Error("Unexpected native confirmation");
      };
      runtime.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
        transformCallback: () => 1,
        unregisterCallback: () => undefined,
        invoke: async (command: string, args?: { path?: string; contents?: string }) => {
          if (command.startsWith("plugin:event|")) return 1;
          if (command.startsWith("plugin:window|")) return null;
          switch (command) {
            case "plugin:app|version":
              return "0.11.0";
            case "read_app_settings":
              return null;
            case "write_app_settings":
            case "watch_workspace":
            case "unwatch_workspace":
              return;
            case "initial_paths":
              return [{ path: root, kind: "workspace" }];
            case "authorize_stored_path":
              return args?.path;
            case "list_workspace_entries":
              return { files: [file], folders: [folder], truncated: false, scannedTotal: 2 };
            case "index_workspace":
            case "read_annotations":
              return [];
            case "read_text_file":
              return fixture.source;
            case "file_size":
              return 8;
            case "path_exists":
              return true;
            case "file_metadata":
              return { size: 8, modifiedMs: 1 };
            case "read_previous_version":
              return null;
            case "write_text_file":
              fixture.calls.push(command);
              if (fixture.failSave) throw new Error("Fixture save failed");
              fixture.source = args?.contents ?? "";
              return;
            case "delete_workspace_entry":
              fixture.calls.push(command);
              fixture.deleted = true;
              return;
            case "refresh_workspace":
              return {
                scopePaths: [folder.path],
                folderScopePaths: [folder.path],
                files: fixture.deleted ? [] : [file],
                folders: fixture.deleted ? [] : [folder],
                index: [],
                truncated: false,
                scannedTotal: fixture.deleted ? 0 : 2,
              };
            default:
              throw new Error(`Unimplemented fixture command: ${command}`);
          }
        },
      };
      runtime.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => undefined };
    },
    { locale, theme },
  );
  await page.goto("/");
  await expect(page.locator(".workspace-folder").filter({ hasText: "Projects" })).toBeVisible();
}

async function openDeletion(page: Page, kind: "file" | "folder") {
  const row =
    kind === "folder"
      ? page.locator(".workspace-folder").filter({ hasText: "Projects" })
      : page.locator(".workspace-file").filter({ hasText: "笔记.txt" });
  await row.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: kind === "folder" ? "删除文件夹及内容" : "删除文件", exact: true }).click();
  const dialog = page.locator('[role="dialog"][aria-labelledby="workspace-entry-confirm-title"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("workspace-entry-confirm-cancel")).toBeFocused();
  return { row, dialog };
}

for (const width of [1240, 900, 720]) {
  test(`keeps workspace deletion cancellable and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await loadWorkspace(page, width === 720 ? "en-US" : "zh-CN", width === 900 ? "ink" : "porcelain");
    if (width === 900) await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const { row, dialog } = await openDeletion(page, "folder");
    await expect(dialog).toContainText(width === 720 ? "everything inside it" : "全部内容");
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByTestId("workspace-entry-confirm-confirm")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByTestId("workspace-entry-confirm-cancel")).toBeFocused();
    const metrics = await dialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        overflow: document.body.scrollWidth > window.innerWidth,
        shortButtons: [...node.querySelectorAll("button")].filter(
          (button) => button.getBoundingClientRect().height < 32,
        ).length,
      };
    });
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(width);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(600);
    expect(metrics.overflow).toBe(false);
    expect(metrics.shortButtons).toBe(0);
    const axe = await new AxeBuilder({ page }).include(".safety-confirm-dialog").analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
    await dialog.screenshot({ path: `test-results/workspace-confirm-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __workspaceConfirmationFixture: { calls: string[] } }).__workspaceConfirmationFixture
            .calls,
      ),
    ).toEqual([]);
  });
}

test("keeps a dirty file when the save preceding deletion fails, then allows save and delete", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 600 });
  await loadWorkspace(page, "en-US", "porcelain");
  const folder = page.locator(".workspace-folder").filter({ hasText: "Projects" });
  if ((await folder.getAttribute("aria-expanded")) === "false") await folder.click();
  const file = page.locator(".workspace-file").filter({ hasText: "笔记.txt" });
  await file.click();
  const editor = page.locator(".source-editor .cm-content");
  await expect(editor).toBeVisible();
  const contextToggle = page.locator(".context-toggle");
  if ((await contextToggle.getAttribute("aria-pressed")) === "true") await contextToggle.click();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" unsaved edit");
  const { dialog } = await openDeletion(page, "file");
  await dialog.getByTestId("workspace-entry-confirm-confirm").click();
  await expect(dialog).toContainText("Save before you delete?");
  await expect(dialog.getByTestId("workspace-entry-confirm-cancel")).toBeFocused();
  await dialog.getByTestId("workspace-entry-confirm-cancel").click();
  await expect(dialog).toHaveCount(0);
  await expect(editor).toContainText("unsaved edit");
  await page.evaluate(() => {
    (
      window as unknown as { __workspaceConfirmationFixture: { failSave: boolean } }
    ).__workspaceConfirmationFixture.failSave = true;
  });
  await openDeletion(page, "file");
  await dialog.getByTestId("workspace-entry-confirm-confirm").click();
  await expect(dialog).toContainText("Save before you delete?");
  await dialog.getByTestId("workspace-entry-confirm-confirm").click();
  await expect(dialog).toHaveCount(0);
  await expect(file).toBeVisible();
  await expect(editor).toContainText("unsaved edit");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __workspaceConfirmationFixture: { calls: string[] } }).__workspaceConfirmationFixture
          .calls,
    ),
  ).toEqual(["write_text_file"]);
  await page.evaluate(() => {
    (
      window as unknown as { __workspaceConfirmationFixture: { failSave: boolean } }
    ).__workspaceConfirmationFixture.failSave = false;
  });
  await openDeletion(page, "file");
  await dialog.getByTestId("workspace-entry-confirm-confirm").click();
  await expect(dialog).toContainText("Save before you delete?");
  await dialog.getByTestId("workspace-entry-confirm-confirm").click();
  await expect(file).toHaveCount(0);
  const fixture = await page.evaluate(
    () =>
      (
        window as unknown as {
          __workspaceConfirmationFixture: { calls: string[]; source: string; nativeConfirmCalls: number };
        }
      ).__workspaceConfirmationFixture,
  );
  expect(fixture.calls).toEqual(["write_text_file", "write_text_file", "delete_workspace_entry"]);
  expect(fixture.source).toContain("unsaved edit");
  expect(fixture.nativeConfirmCalls).toBe(0);
});
