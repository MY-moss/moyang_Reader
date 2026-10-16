import { useEffect, useMemo, useRef, useState } from "react";
import type { ReaderApplication } from "./useReaderApplication";
import type { ExtensionManager } from "../features/extensions/useExtensions";
import type { ExtensionOutput } from "../shared/extension-types";
import { flushLiveEditors } from "../shared/pending-work";
import { runExtension } from "../features/extensions/runtime";

export type ExtensionRun = {
  name: string;
  path: string;
  original: string;
  result?: ExtensionOutput;
  error?: string;
  running: boolean;
};
export function useReaderExtensions(model: ReaderApplication, manager: ExtensionManager) {
  const [run, setRun] = useState<ExtensionRun | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const kind = model.documentState?.kind;
  const canEdit = model.canEdit;
  const commands = useMemo(
    () =>
      manager.state.installed
        .filter((i) => i.enabled && i.package.kind === "reader")
        .flatMap((i) =>
          i.package.commands!.map((c) => ({
            id: `extension:${i.package.id}:${c.id}`,
            label: `${c.name} · ${i.package.name}`,
            disabled:
              !kind ||
              !(i.package.formats ?? ["markdown", "text"]).includes(kind as "markdown" | "text" | "docx") ||
              (c.modifiesDocument && !canEdit),
          })),
        ),
    [manager.state.installed, kind, canEdit],
  );
  const execute = (id: string) => {
    const [, packageId, commandId] = id.split(":");
    const installed = manager.state.installed.find((i) => i.enabled && i.package.id === packageId);
    const command = installed?.package.commands?.find((c) => c.id === commandId);
    if (!installed || !command || !model.documentState || (command.modifiesDocument && !model.canEdit)) return;
    if (commands.find((c) => c.id === id)?.disabled) return;
    flushLiveEditors();
    const doc = model.documentState,
      source =
        doc.kind === "docx"
          ? (new DOMParser().parseFromString(doc.rendered.html, "text/html").body.textContent ?? "")
          : (model.documentSessions.get(doc.path)?.draft ?? doc.source);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const initial = { name: command.name, path: doc.path, original: source, running: true };
    setRun(initial);
    void runExtension(
      installed.package,
      { command: commandId, text: source, path: doc.path, title: doc.name, format: doc.kind },
      abort.signal,
    )
      .then((result) => {
        if (controller.current === abort) setRun({ ...initial, running: false, result });
      })
      .catch((cause) => {
        if (controller.current === abort) setRun({ ...initial, running: false, error: String(cause) });
      });
  };
  const close = () => {
    controller.current?.abort();
    controller.current = null;
    setRun(null);
  };
  const apply = () => {
    if (!run || run.result?.replacement === undefined) return;
    flushLiveEditors();
    const session = model.documentSessions.get(run.path);
    if (!session || session.draft !== run.original) {
      setRun({ ...run, error: "文档在运行后已有新修改或已关闭，未覆盖你的内容。请保留结果，返回文档重新运行。" });
      return;
    }
    model.updateSource(run.result.replacement, run.path);
    close();
  };
  return { commands, execute, run, close, apply };
}
