import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Shipped App/session controller with synthetic IPC. Real disk/watcher paths are in desktop smoke.
async function loadFixture(page: Page, locale: "zh-CN" | "en-US" = "zh-CN", theme = "porcelain") {
  await page.addInitScript(
    ({ locale, theme }) => {
      localStorage.setItem("moyang-reader-locale", locale);
      localStorage.setItem("moyang-reader-theme", theme);
      localStorage.setItem("moyang-reader-getting-started-seen", "true");
      const root = `C:/Notes/${"long-library-path-".repeat(6)}Library`;
      const file = (name: string) => ({ path: `${root}/${name}`, name, relativePath: name, kind: "text", size: 20 });
      const files = [file("笔记.txt"), file("Next.txt"), file("Last.txt")];
      const callbacks = new Map<number, (event: unknown) => void>();
      const listeners = new Map<number, { event: string; handler: number }>();
      let sequence = 0;
      const fixture = {
        root,
        files,
        source: "Original note",
        stamp: 1,
        failDraft: false,
        failRead: false,
        nativeConfirmCalls: 0,
        calls: [] as string[],
        emit(event: string, payload: unknown) {
          for (const [id, listener] of listeners) {
            if (listener.event === event) callbacks.get(listener.handler)?.({ event, id, payload });
          }
        },
      };
      const runtime = window as unknown as Record<string, unknown>;
      runtime.__documentConfirmationFixture = fixture;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (fixture.failDraft && key === "moyang-reader-drafts") throw new Error("Fixture draft storage failed");
        return setItem.call(this, key, value);
      };
      window.confirm = () => {
        fixture.nativeConfirmCalls++;
        throw new Error("Unexpected native confirmation");
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
          args?: { path?: string; root?: string; event?: string; handler?: number; eventId?: number },
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
            case "choose_workspace_path":
              return "C:/Archive";
            case "authorize_stored_path":
              fixture.calls.push(`authorize:${args?.path}`);
              return args?.path;
            case "list_workspace_entries":
              return { files: args?.root === root ? files : [], folders: [], truncated: false, scannedTotal: 3 };
            case "index_workspace":
            case "read_annotations":
              return [];
            case "read_text_file":
              fixture.calls.push(`read:${args?.path}`);
              if (fixture.failRead) throw new Error("Fixture read failed");
              return args?.path === files[0].path ? fixture.source : `Content of ${args?.path}`;
            case "file_size":
              return 20;
            case "path_exists":
              return true;
            case "file_metadata":
              return { size: 20, modifiedMs: fixture.stamp };
            case "read_previous_version":
              return null;
            case "refresh_workspace":
              return {
                scopePaths: [root],
                folderScopePaths: [root],
                files,
                folders: [],
                index: [],
                truncated: false,
                scannedTotal: 3,
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
  await expect(page.locator(".workspace-file").filter({ hasText: "笔记.txt" })).toBeVisible();
  await page.locator(".workspace-file").filter({ hasText: "笔记.txt" }).click();
  const editor = page.locator(".source-editor .cm-content");
  await expect(editor).toContainText("Original note");
  const context = page.locator(".context-toggle");
  if ((await context.getAttribute("aria-pressed")) === "true") await context.click();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" unsaved edit");
  return editor;
}

const dialogFor = (page: Page) => page.locator('[role="dialog"][aria-labelledby="document-transition-confirm-title"]');
type FixtureWindow = typeof window & {
  __documentConfirmationFixture: {
    root: string;
    files: { path: string }[];
    failDraft: boolean;
    failRead: boolean;
    source: string;
    stamp: number;
    emit(event: string, payload: unknown): void;
    calls: string[];
    nativeConfirmCalls: number;
  };
};

for (const width of [1240, 900, 720]) {
  test(`keeps document switching readable and cancellable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    const editor = await loadFixture(page, width === 720 ? "en-US" : "zh-CN", width === 900 ? "ink" : "porcelain");
    if (width === 900) await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const row = page.locator(".workspace-file").filter({ hasText: "Next.txt" });
    await row.click();
    const dialog = dialogFor(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(width === 720 ? "Restore them from Drafts" : "最新修改已自动保留");
    await expect(dialog).toContainText("long-library-path-");
    await expect(dialog.getByTestId("document-transition-confirm-cancel")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByTestId("document-transition-confirm-confirm")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByTestId("document-transition-confirm-cancel")).toBeFocused();
    const metrics = await dialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        x: rect.x,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        overflow: document.body.scrollWidth > innerWidth,
        short: [...node.querySelectorAll("button")].filter((button) => button.getBoundingClientRect().height < 32)
          .length,
      };
    });
    expect(metrics.x).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(width);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(600);
    expect(metrics.overflow).toBe(false);
    expect(metrics.short).toBe(0);
    const axe = await new AxeBuilder({ page }).include(".safety-confirm-dialog").analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
    await dialog.screenshot({ path: `test-results/document-confirm-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
    await expect(editor).toContainText("unsaved edit");
    const drafts = await page.evaluate(
      () => JSON.parse(localStorage.getItem("moyang-reader-drafts") || "[]") as { draft: string }[],
    );
    expect(drafts.some((draft) => draft.draft.includes("unsaved edit"))).toBe(true);
    expect(await page.evaluate(() => (window as FixtureWindow).__documentConfirmationFixture.nativeConfirmCalls)).toBe(
      0,
    );
  });
}

test("cancels Quick Open, single and batch tab close, then closes only after confirmation", async ({ page }) => {
  const editor = await loadFixture(page);
  await page.keyboard.press("Control+p");
  await page.getByRole("searchbox", { name: "快速打开文件", exact: true }).fill("Next");
  await page.getByRole("searchbox", { name: "快速打开文件", exact: true }).press("Enter");
  await expect(dialogFor(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toContainText("unsaved edit");
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await page.locator(".workspace-file").filter({ hasText: "Next.txt" }).click();
  await dialogFor(page).getByTestId("document-transition-confirm-confirm").click();
  await page.locator(".tab-label").filter({ hasText: "笔记.txt" }).click();
  await expect(editor).toContainText("Original note");
  // Recovery remains opt-in. Create another edit instead of silently restoring the earlier draft.
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" new edit");
  const close = page.getByRole("button", { name: "关闭 笔记.txt", exact: true });
  await close.click();
  await expect(dialogFor(page)).toContainText("将关闭 1 个标签");
  await page.keyboard.press("Escape");
  await expect(close).toBeFocused();
  const tab = page.locator(".tab-item.active .tab-label");
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "关闭全部" }).click();
  await expect(dialogFor(page)).toContainText("将关闭 2 个标签");
  await page.keyboard.press("Escape");
  await expect(page.locator(".tab-item")).toHaveCount(2);
  await expect(editor).toContainText("new edit");
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "关闭全部" }).click();
  await dialogFor(page).getByTestId("document-transition-confirm-confirm").click();
  await expect(page.locator(".tab-item")).toHaveCount(0);
});

test("blocks failed draft preservation and cancels library and multi-file ingress", async ({ page }) => {
  const editor = await loadFixture(page);
  await page.evaluate(() => {
    (window as FixtureWindow).__documentConfirmationFixture.failDraft = true;
  });
  await page.locator(".workspace-file").filter({ hasText: "Next.txt" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "草稿" }).first()).toBeVisible();
  await expect(dialogFor(page)).toHaveCount(0);
  await expect(editor).toContainText("unsaved edit");
  await page.evaluate(() => {
    (window as FixtureWindow).__documentConfirmationFixture.failDraft = false;
  });
  await page.keyboard.press("Control+Shift+o");
  await expect(dialogFor(page)).toContainText("目标阅读库");
  await expect(dialogFor(page)).toContainText("C:/Archive");
  await page.keyboard.press("Escape");
  await expect(editor).toContainText("unsaved edit");
  await page.evaluate(() => {
    const fixture = (window as FixtureWindow).__documentConfirmationFixture;
    fixture.emit(
      "open-paths",
      fixture.files.slice(1).map((file) => ({ path: file.path, kind: "document" })),
    );
  });
  await expect(dialogFor(page)).toContainText("目标数量");
  await expect(dialogFor(page)).toContainText("2");
  await page.keyboard.press("Escape");
  await expect(page.locator(".tab-item")).toHaveCount(1);
  await expect(editor).toContainText("unsaved edit");
});

test("preserves local edits on cancelled and failed reload, then reads the disk without overwriting it", async ({
  page,
}) => {
  const editor = await loadFixture(page);
  await page.evaluate(() => {
    const fixture = (window as FixtureWindow).__documentConfirmationFixture;
    fixture.source = "External disk version";
    fixture.stamp++;
    fixture.emit("workspace-changed", { root: fixture.root, paths: [fixture.files[0].path] });
  });
  const reload = page.locator(".external-change-notice").getByRole("button", { name: "重新载入", exact: true });
  await expect(reload).toBeVisible();
  await reload.click();
  await expect(dialogFor(page)).toContainText("不会覆盖磁盘文件");
  await page.keyboard.press("Escape");
  await expect(reload).toBeFocused();
  await expect(editor).toContainText("unsaved edit");
  await page.evaluate(() => {
    (window as FixtureWindow).__documentConfirmationFixture.failRead = true;
  });
  await reload.click();
  await dialogFor(page).getByTestId("document-transition-confirm-confirm").click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture read failed" })).toBeVisible();
  await expect(editor).toContainText("unsaved edit");
  await expect(reload).toBeVisible();
  await page.evaluate(() => {
    (window as FixtureWindow).__documentConfirmationFixture.failRead = false;
  });
  await reload.click();
  await dialogFor(page).getByTestId("document-transition-confirm-confirm").click();
  await expect(editor).toContainText("External disk version");
  await expect(editor).not.toContainText("unsaved edit");
  expect(await page.evaluate(() => (window as FixtureWindow).__documentConfirmationFixture.source)).toBe(
    "External disk version",
  );
});
