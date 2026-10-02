import { useLayoutEffect, useRef, useState } from "react";
import type { Locale } from "../i18n";
import type { WorkspaceNameInputState } from "../use-workspace-name-input";
import { validateWorkspaceNameInput } from "../workspace-name-input";
import { workspaceNameError, workspaceNameText } from "../workspace-name-copy";
import { workspaceEntryAbsolutePath } from "../workspace-entry";
import { useModalBehavior } from "./useModalBehavior";

export function WorkspaceNameInputDialog({
  locale,
  state,
  covered = false,
  onCancel,
  onSubmit,
  onChange,
}: {
  locale: Locale;
  state: WorkspaceNameInputState;
  covered?: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void>;
  onChange: () => void;
}) {
  const { request, busy, error } = state;
  const [name, setName] = useState(request.initialName);
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fallbackFocusTarget] = useState(() => document.querySelector<HTMLElement>(".workspace-tree"));
  const t = (key: Parameters<typeof workspaceNameText>[1]) => workspaceNameText(locale, key);
  const validation = validateWorkspaceNameInput(request, name);
  const feedback =
    touched && validation ? t(validation) : error ? workspaceNameError(locale, error, request.action) : null;
  const rename = request.action === "rename";
  const duplicate = request.action === "duplicate";
  const title = t(
    duplicate
      ? request.kind === "folder"
        ? "duplicateFolder"
        : "duplicateFile"
      : rename
        ? request.kind === "folder"
          ? "renameFolder"
          : "renameFile"
        : request.action === "create-note"
          ? "createNote"
          : "createFolder",
  );
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: inputRef, fallbackFocusTarget, onClose: onCancel });
  useLayoutEffect(() => {
    inputRef.current?.select();
  }, []);
  // Disabled controls relinquish focus. Keep the busy dialog, rather than the
  // page behind it, as the keyboard target while the operation is outstanding.
  useLayoutEffect(() => {
    if (covered) return;
    if (busy) dialogRef.current?.focus();
    else inputRef.current?.focus();
  }, [busy, covered]);
  return (
    <div className="quick-open-backdrop close-confirm-backdrop" role="presentation" aria-hidden={covered || undefined}>
      <form
        ref={dialogRef}
        className="quick-open-dialog close-confirm-dialog safety-confirm-dialog workspace-name-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-name-title"
        aria-describedby="workspace-name-hint"
        aria-busy={busy}
        tabIndex={-1}
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!validation && !busy) void onSubmit(name);
        }}
      >
        <header className="quick-open-header safety-confirm-header">
          <h2 id="workspace-name-title">{title}</h2>
        </header>
        <div className="close-confirm-body safety-confirm-body">
          <dl className="safety-confirm-facts">
            {duplicate && (
              <div>
                <dt>{t("source")}</dt>
                <dd>{request.sourcePath}</dd>
              </div>
            )}
            <div>
              <dt>{t(duplicate ? "destination" : "directory")}</dt>
              <dd>{workspaceEntryAbsolutePath(request.root, request.parentPath)}</dd>
            </div>
            {rename && (
              <div>
                <dt>{t("currentName")}</dt>
                <dd>{request.currentName}</dd>
              </div>
            )}
          </dl>
          <label className="workspace-name-label" htmlFor="workspace-name-input">
            {t(duplicate ? "copyName" : rename ? "newName" : "name")}
          </label>
          <input
            ref={inputRef}
            id="workspace-name-input"
            className="workspace-name-input"
            value={name}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(feedback)}
            aria-describedby={`workspace-name-hint${feedback ? " workspace-name-error" : ""}`}
            onChange={(event) => {
              setName(event.target.value);
              setTouched(true);
              onChange();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
            }}
          />
          <p id="workspace-name-hint" className="safety-confirm-note">
            {t(
              duplicate
                ? request.kind === "folder"
                  ? "copyFolderHint"
                  : "copyFileHint"
                : rename
                  ? "renameHint"
                  : request.action === "create-note"
                    ? "noteHint"
                    : "folderHint",
            )}
          </p>
          {feedback && (
            <p id="workspace-name-error" className="workspace-name-error" role="alert">
              {feedback}
            </p>
          )}
          {busy && <p role="status">{t("busy")}</p>}
        </div>
        <footer className="quick-open-footer close-confirm-actions safety-confirm-actions">
          <button
            type="button"
            className="quiet-button"
            disabled={busy}
            data-testid="workspace-name-cancel"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className="toolbar-button primary"
            disabled={busy || Boolean(validation)}
            data-testid="workspace-name-submit"
          >
            {t(duplicate ? "duplicate" : rename ? "rename" : "create")}
          </button>
        </footer>
      </form>
    </div>
  );
}
