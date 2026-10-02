import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function loadFixture(page: Page, locale: "zh-CN" | "en-US" = "zh-CN", theme = "porcelain") {
  await page.addInitScript(
    ({ locale, theme }) => {
      localStorage.setItem("moyang-reader-locale", locale);
      localStorage.setItem("moyang-reader-theme", theme);
      localStorage.setItem("moyang-reader-getting-started-seen", "true");
      const root = `C:/Notes/${"long-library-path-".repeat(6)}Library`;
      const folders = [{ path: `${root}/Projects`, name: "Projects", relativePath: "Projects" }];
      const files = [
        {
          path: `${root}/Projects/笔记.txt`,
          name: "笔记.txt",
          relativePath: "Projects/笔记.txt",
          kind: "text",
          size: 20,
        },
      ];
      const callbacks = new Map<number, (event: unknown) => void>();
      const listeners = new Map<number, { event: string; handler: number }>();
      let sequence = 0;
      const fixture = {
        root,
        calls: [] as string[],
        fail: false,
        failSave: false,
        failRefresh: false,
        hold: false,
        release: null as (() => void) | null,
        emit(event: string, payload: unknown) {
          for (const [id, listener] of listeners)
            if (listener.event === event) callbacks.get(listener.handler)?.({ event, id, payload });
        },
      };
      const runtime = window as unknown as Record<string, unknown>;
      runtime.__workspaceNameFixture = fixture;
      window.prompt = () => {
        throw new Error("Unexpected native name prompt");
      };
      runtime.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
        transformCallback: (callback: (event: unknown) => void) => {
          const id = ++sequence;
          callbacks.set(id, callback);
          return id;
        },
        unregisterCallback: (id: number) => callbacks.delete(id),
        invoke: async (
          command: string,
          args?: {
            root?: string;
            path?: string;
            name?: string;
            parentPath?: string;
            entryPath?: string;
            event?: string;
            handler?: number;
            eventId?: number;
          },
        ) => {
          if (command === "plugin:event|listen") {
            const id = ++sequence;
            listeners.set(id, { event: args!.event!, handler: args!.handler! });
            return id;
          }
          if (command === "plugin:event|unlisten") {
            listeners.delete(args!.eventId!);
            return;
          }
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
              return {
                files: args?.root === root ? files : [],
                folders: args?.root === root ? folders : [],
                truncated: false,
                scannedTotal: files.length + folders.length,
              };
            case "index_workspace":
            case "read_annotations":
              return [];
            case "file_size":
              return 20;
            case "path_exists":
              return true;
            case "file_metadata":
              return { size: 20, modifiedMs: 1 };
            case "read_previous_version":
              return null;
            case "read_text_file":
              return "Original note";
            case "write_text_file":
              fixture.calls.push(command);
              if (fixture.failSave) throw new Error("Private save details");
              return;
            case "duplicate_workspace_entry": {
              fixture.calls.push(command);
              if (fixture.hold)
                await new Promise<void>((resolve) => {
                  fixture.release = resolve;
                });
              if (fixture.fail) throw new Error("private backend details");
              const sourceFile = files.find((file) => file.relativePath === args!.entryPath);
              const sourceFolder = folders.find((folder) => folder.relativePath === args!.entryPath);
              const parent = args!.entryPath!.split("/").slice(0, -1).join("/");
              const name = args!.name! + (sourceFile && args!.name!.lastIndexOf(".") <= 0 ? ".txt" : "");
              const relativePath = parent ? `${parent}/${name}` : name;
              if ([...files, ...folders].some((entry) => entry.relativePath === relativePath))
                throw new Error("private existing target details");
              const path = `${root}/${relativePath}`;
              if (sourceFile) files.push({ ...sourceFile, path, name, relativePath });
              else if (sourceFolder) folders.push({ ...sourceFolder, path, name, relativePath });
              else throw new Error("private missing source details");
              return path;
            }
            case "create_workspace_note":
            case "create_workspace_folder":
            case "rename_workspace_entry": {
              fixture.calls.push(command);
              if (fixture.hold)
                await new Promise<void>((resolve) => {
                  fixture.release = resolve;
                });
              if (fixture.fail) throw new Error("private backend details");
              const relativePath = `${args?.parentPath || "Projects"}/${args!.name}${command === "create_workspace_note" && !args!.name!.includes(".") ? ".md" : ""}`;
              const path = `${root}/${relativePath}`;
              if (command === "create_workspace_folder") folders.push({ path, relativePath, name: args!.name! });
              else if (command === "rename_workspace_entry") {
                const file = files.find((item) => item.relativePath === args!.entryPath)!;
                Object.assign(file, { path, relativePath, name: args!.name! });
              } else
                files.push({ path, relativePath, name: relativePath.split("/").at(-1)!, kind: "markdown", size: 0 });
              return path;
            }
            case "refresh_workspace":
              if (fixture.failRefresh) throw new Error("private refresh details");
              return {
                scopePaths: [root],
                folderScopePaths: [root],
                files,
                folders,
                index: [],
                truncated: false,
                scannedTotal: files.length + folders.length,
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

async function openName(page: Page, action: "note" | "folder" | "rename" | "copy-file" | "copy-folder") {
  const file = action === "rename" || action === "copy-file";
  const row = page
    .locator(file ? ".workspace-file" : ".workspace-folder")
    .filter({ hasText: file ? "笔记.txt" : "Projects" });
  if (file) {
    const folder = page.locator(".workspace-folder").filter({ hasText: "Projects" });
    if ((await folder.getAttribute("aria-expanded")) === "false") await folder.click();
  }
  await row.focus();
  await page.keyboard.press("Shift+F10");
  await page
    .getByRole("menuitem", {
      name:
        action === "copy-file"
          ? /^(复制文件|Copy file)$/
          : action === "copy-folder"
            ? /^(复制文件夹|Copy folder)$/
            : action === "note"
              ? "新建笔记"
              : action === "folder"
                ? "新建文件夹"
                : "重命名文件",
      exact: true,
    })
    .click();
  const dialog = page.locator('[role="dialog"][aria-labelledby="workspace-name-title"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("input")).toBeFocused();
  return { row, dialog, input: dialog.locator("input") };
}
async function calls(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __workspaceNameFixture: { calls: string[] } }).__workspaceNameFixture.calls,
  );
}

for (const width of [1240, 900, 720]) {
  test(`copy input preserves focus and long paths at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await loadFixture(page, width === 720 ? "en-US" : "zh-CN", width === 900 ? "ink" : "porcelain");
    if (width === 900) await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const { row, dialog, input } = await openName(page, "copy-file");
    await expect(input).toHaveValue(width === 720 ? "笔记 copy.txt" : "笔记 副本.txt");
    await expect(dialog).toContainText(width === 720 ? "Destination folder" : "目标目录");
    await expect(dialog).toContainText(width === 720 ? "unsaved edits" : "未保存的编辑");
    await input.fill("CON");
    await expect(dialog.getByTestId("workspace-name-submit")).toBeDisabled();
    await input.fill("Safe copy.txt");
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByTestId("workspace-name-submit")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    const metrics = await dialog.evaluate((node) => ({
      box: node.getBoundingClientRect().toJSON(),
      overflow: document.body.scrollWidth > innerWidth,
      small: [...node.querySelectorAll("input,button")].some((item) => item.getBoundingClientRect().height < 32),
    }));
    expect(metrics.box.left).toBeGreaterThanOrEqual(0);
    expect(metrics.box.right).toBeLessThanOrEqual(width);
    expect(metrics.box.top).toBeGreaterThanOrEqual(0);
    expect(metrics.box.bottom).toBeLessThanOrEqual(600);
    expect(metrics.overflow).toBe(false);
    expect(metrics.small).toBe(false);
    const axe = await new AxeBuilder({ page }).include(".workspace-name-dialog").analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await dialog.screenshot({ path: `test-results/workspace-copy-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
    expect(await calls(page)).toEqual([]);
  });
}

for (const width of [1240, 900, 720]) {
  test(`name input is readable, cancellable and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await loadFixture(page, width === 720 ? "en-US" : "zh-CN", width === 900 ? "ink" : "porcelain");
    if (width === 900) await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const { row, dialog, input } = await openName(page, "rename");
    await expect(input).toHaveValue("笔记.txt");
    expect(await input.evaluate((node) => [node.selectionStart, node.selectionEnd])).toEqual([0, 6]);
    await expect(dialog).toContainText("long-library-path-");
    await input.fill("CON");
    await expect(dialog.getByRole("alert")).toContainText(width === 720 ? "reserved" : "保留设备名");
    await expect(dialog.getByTestId("workspace-name-submit")).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(await calls(page)).toEqual([]);
    await input.fill("Renamed.txt");
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByTestId("workspace-name-submit")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    const metrics = await dialog.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        overflow: document.body.scrollWidth > innerWidth,
        small: [...node.querySelectorAll("input,button")].some((item) => item.getBoundingClientRect().height < 32),
      };
    });
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(width);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(600);
    expect(metrics.overflow).toBe(false);
    expect(metrics.small).toBe(false);
    const axe = await new AxeBuilder({ page }).include(".workspace-name-dialog").analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
    await dialog.screenshot({ path: `test-results/workspace-name-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
    expect(await calls(page)).toEqual([]);
  });
}

test("retains a failed creation for correction, suppresses composition Enter and duplicate submissions", async ({
  page,
}) => {
  await loadFixture(page, "en-US");
  const { dialog, input } = await openName(page, "note");
  await input.fill("Taken");
  expect(
    await input.evaluate(
      (node) =>
        !node.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }),
        ),
    ),
  ).toBe(true);
  expect(await calls(page)).toEqual([]);
  await page.evaluate(() => {
    (window as unknown as { __workspaceNameFixture: { fail: boolean } }).__workspaceNameFixture.fail = true;
  });
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("existing name");
  await expect(dialog).not.toContainText("private backend details");
  await expect(input).toHaveValue("Taken");
  await expect(input).toBeFocused();
  await page.evaluate(() => {
    const fixture = (window as unknown as { __workspaceNameFixture: { fail: boolean; hold: boolean } })
      .__workspaceNameFixture;
    fixture.fail = false;
    fixture.hold = true;
  });
  await input.fill("Corrected");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByTestId("workspace-name-cancel")).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  expect(await calls(page)).toEqual(["create_workspace_note", "create_workspace_note"]);
  await page.evaluate(() =>
    (window as unknown as { __workspaceNameFixture: { release: () => void } }).__workspaceNameFixture.release(),
  );
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".workspace-file").filter({ hasText: "Corrected.md" })).toBeVisible();
  await expect(page.locator(".document-title")).toHaveText("Corrected.md");
});

test("creates a folder and renames a file through the shipped inputs", async ({ page }) => {
  await loadFixture(page);
  let opened = await openName(page, "folder");
  await opened.input.fill("Research");
  await page.keyboard.press("Enter");
  await expect(opened.dialog).toHaveCount(0);
  await expect(page.locator(".workspace-folder").filter({ hasText: "Research" })).toBeVisible();
  opened = await openName(page, "rename");
  await opened.input.fill("Renamed.txt");
  await opened.dialog.getByTestId("workspace-name-submit").click();
  await expect(opened.dialog).toHaveCount(0);
  await expect(page.locator(".workspace-file").filter({ hasText: "Renamed.txt" })).toBeVisible();
  await expect(page.locator(".workspace-tree")).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  const focusAfterResize = await page.evaluate(() => ({
    active: document.activeElement?.outerHTML.slice(0, 400),
    treeConnected: document.querySelector(".workspace-tree")?.isConnected,
  }));
  await expect(page.locator(".workspace-tree"), JSON.stringify(focusAfterResize)).toBeFocused();
  const renamed = page.locator(".workspace-file").filter({ hasText: "Renamed.txt" });
  await renamed.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "删除文件", exact: true }).click();
  const confirmation = page.locator('[aria-labelledby="workspace-entry-confirm-title"]');
  await expect(confirmation.getByTestId("workspace-entry-confirm-cancel")).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await expect(confirmation.getByTestId("workspace-entry-confirm-cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(renamed).toBeFocused();
  expect(await calls(page)).toEqual(["create_workspace_folder", "rename_workspace_entry"]);
});

test("a failed save preceding rename retains the name and never renames", async ({ page }) => {
  await loadFixture(page, "en-US");
  const folder = page.locator(".workspace-folder").filter({ hasText: "Projects" });
  if ((await folder.getAttribute("aria-expanded")) === "false") await folder.click();
  await page.locator(".workspace-file").filter({ hasText: "笔记.txt" }).click();
  const editor = page.locator(".source-editor .cm-content");
  await expect(page.locator(".document-title")).toHaveText("笔记.txt");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" unsaved edit");
  const { dialog, input } = await openName(page, "rename");
  await input.fill("Renamed.txt");
  await page.keyboard.press("Enter");
  const confirmation = page.locator('[aria-labelledby="workspace-entry-confirm-title"]');
  await expect(confirmation).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __workspaceNameFixture: { failSave: boolean } }).__workspaceNameFixture.failSave = true;
  });
  await confirmation.getByTestId("workspace-entry-confirm-confirm").click();
  await expect(dialog.getByRole("alert")).toContainText("not been saved");
  await expect(input).toHaveValue("Renamed.txt");
  await expect(input).toBeFocused();
  expect(await calls(page)).toEqual(["write_text_file"]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(editor).toContainText("unsaved edit");
});

test("invalidates a pending input when a native entry opens another library", async ({ page }) => {
  await loadFixture(page);
  const { dialog, input } = await openName(page, "note");
  await input.fill("Stale");
  await page.evaluate(() =>
    (
      window as unknown as { __workspaceNameFixture: { emit(event: string, payload: unknown): void } }
    ).__workspaceNameFixture.emit("open-paths", [{ path: "C:/Archive", kind: "workspace" }]),
  );
  await expect(page.locator(".workspace-location")).toContainText("Archive");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(await calls(page)).toEqual([]);
});

test("copy input retains collisions, rejects composition Enter and prevents duplicate submissions", async ({
  page,
}) => {
  await loadFixture(page, "en-US");
  const { dialog, input } = await openName(page, "copy-file");
  await input.fill("笔记");
  await input.evaluate((node) =>
    node.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }),
    ),
  );
  expect(await calls(page)).toEqual([]);
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("existing name");
  await expect(dialog).not.toContainText("private");
  await expect(input).toHaveValue("笔记");
  await page.evaluate(() => {
    (window as unknown as { __workspaceNameFixture: { hold: boolean } }).__workspaceNameFixture.hold = true;
  });
  await input.fill("Safe copy");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(await calls(page)).toEqual(["duplicate_workspace_entry", "duplicate_workspace_entry"]);
  await page.evaluate(() =>
    (window as unknown as { __workspaceNameFixture: { release: () => void } }).__workspaceNameFixture.release(),
  );
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".workspace-file").filter({ hasText: "Safe copy.txt" })).toBeVisible();
});

test("folder copy closes after IO success even when refreshing its tree fails", async ({ page }) => {
  await loadFixture(page);
  const { dialog, input } = await openName(page, "copy-folder");
  await expect(dialog).toContainText("不会覆盖已有目标");
  await input.fill("Projects copy");
  await page.evaluate(() => {
    (window as unknown as { __workspaceNameFixture: { failRefresh: boolean } }).__workspaceNameFixture.failRefresh =
      true;
  });
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("副本已创建，但文件树未刷新。请刷新阅读库；不要重复复制。", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("private refresh details");
  expect(await calls(page)).toEqual(["duplicate_workspace_entry"]);
});

test("a stale copy request never invokes disk IO in another library", async ({ page }) => {
  await loadFixture(page);
  const { dialog } = await openName(page, "copy-file");
  await page.evaluate(() =>
    (
      window as unknown as { __workspaceNameFixture: { emit(event: string, payload: unknown): void } }
    ).__workspaceNameFixture.emit("open-paths", [{ path: "C:/Archive", kind: "workspace" }]),
  );
  await expect(page.locator(".workspace-location")).toContainText("Archive");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(await calls(page)).toEqual([]);
});

test("copy preserves a dirty source editor without saving or switching documents", async ({ page }) => {
  await loadFixture(page);
  const folder = page.locator(".workspace-folder").filter({ hasText: "Projects" });
  if ((await folder.getAttribute("aria-expanded")) === "false") await folder.click();
  await page.locator(".workspace-file").filter({ hasText: "笔记.txt" }).click();
  await expect(page.locator(".document-title")).toHaveText("笔记.txt");
  const editor = page.locator(".source-editor .cm-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" unsaved edit");
  const { dialog, input } = await openName(page, "copy-file");
  await input.fill("Disk copy");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".document-title")).toHaveText("笔记.txt");
  await expect(editor).toContainText("unsaved edit");
  await expect(page.locator('[aria-labelledby="workspace-entry-confirm-title"]')).toHaveCount(0);
  expect(await calls(page)).toEqual(["duplicate_workspace_entry"]);
});

test("cancels the dirty-document decision under a new-note input without creating", async ({ page }) => {
  await loadFixture(page);
  const folder = page.locator(".workspace-folder").filter({ hasText: "Projects" });
  if ((await folder.getAttribute("aria-expanded")) === "false") await folder.click();
  await page.locator(".workspace-file").filter({ hasText: "笔记.txt" }).click();
  await expect(page.locator(".document-title")).toHaveText("笔记.txt");
  const editor = page.locator(".source-editor .cm-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" unsaved edit");
  const { dialog, input } = await openName(page, "note");
  await input.fill("Cancelled");
  await page.keyboard.press("Enter");
  const confirmation = page.locator('[aria-labelledby="document-transition-confirm-title"]');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByTestId("document-transition-confirm-cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expect(editor).toContainText("unsaved edit");
  expect(await calls(page)).toEqual([]);
});
