import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isSameDocumentPath } from "../../features/recovery/document-transition";
import { readPaneView, savePaneView } from "../../features/reader/pane-view-state";
import type { ReaderApplication } from "../useReaderApplication";
import type { WorkbenchPanes } from "../useWorkbenchPanes";
import { DocumentViewport } from "./DocumentViewport";
import { DocumentActions } from "./DocumentActions";
import { Tabs } from "../../shell/components/Tabs";
import { DocumentPreview } from "../../features/reader/components/DocumentPreview";

export function ReaderPane({
  index,
  model,
  workbench,
  tools,
}: {
  index: 0 | 1;
  model: ReaderApplication;
  workbench: WorkbenchPanes;
  tools?: import("react").ReactNode;
}) {
  const pane = workbench.panes[index];
  const active = workbench.activePane === index;
  const matchesDocument = Boolean(
    pane.activePath && model.documentState && isSameDocumentPath(pane.activePath, model.documentState.path),
  );
  const session = pane.activePath ? model.documentSessions.get(pane.activePath) : undefined;
  const document = session?.document;
  const hasSourceTarget = Boolean(
    active &&
    model.sourceLocation?.path === pane.activePath &&
    (model.sourceLocation.quote || model.sourceLocation.paragraph || model.sourceLocation.offset !== undefined),
  );
  const container = useRef<HTMLDivElement>(null);
  const [pdfPage, setPdfPage] = useState(() => readPaneView(pane.id, pane.activePath ?? "").page);
  const [pdfZoom, setPdfZoom] = useState(() => readPaneView(pane.id, pane.activePath ?? "").zoom);
  const changePdfPage = (page: number) => {
    setPdfPage(page);
    if (pane.activePath) savePaneView(pane.id, pane.activePath, { page });
  };
  const changePdfZoom = (zoom: number) => {
    setPdfZoom(zoom);
    if (pane.activePath) savePaneView(pane.id, pane.activePath, { zoom });
  };
  useEffect(() => {
    const view = readPaneView(pane.id, pane.activePath ?? "");
    setPdfPage(view.page);
    setPdfZoom(view.zoom);
  }, [pane.id, pane.activePath]);
  useEffect(() => {
    if (active && matchesDocument && document?.kind === "pdf" && model.sourceLocation?.path === pane.activePath)
      setPdfPage(model.sourceLocation.page ?? 1);
    if (active && matchesDocument && pane.activePath)
      savePaneView(pane.id, pane.activePath, {
        mode: model.mode,
        ...(model.documentState?.kind === "pdf" && model.sourceLocation?.path === pane.activePath
          ? { page: model.sourceLocation.page ?? 1 }
          : {}),
      });
  }, [
    active,
    matchesDocument,
    pane.id,
    pane.activePath,
    model.documentState?.path,
    model.documentState?.kind,
    document?.kind,
    model.mode,
    model.sourceLocation,
  ]);
  useLayoutEffect(() => {
    const element = container.current?.querySelector<HTMLElement>(".content-area");
    const path = pane.activePath;
    if (!element || !path || model.loading) return;
    const stored = readPaneView(pane.id, path).scroll;
    let lastTop = stored;
    let restoring = true;
    let frame = 0;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const restore = () => {
      if (stored > 0 && element.scrollHeight <= element.clientHeight && attempts++ < 60) {
        frame = requestAnimationFrame(restore);
        return;
      }
      // An explicit search/bookmark target owns the next scroll position.
      if (!hasSourceTarget) element.scrollTop = stored;
      restoring = false;
      lastTop = element.scrollTop;
    };
    frame = requestAnimationFrame(restore);
    const persist = () => savePaneView(pane.id, path, { scroll: lastTop });
    const save = () => {
      if (restoring) return;
      lastTop = element.scrollTop;
      clearTimeout(timer);
      timer = setTimeout(persist, 300);
    };
    element.addEventListener("scroll", save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      if (!restoring) persist();
      element.removeEventListener("scroll", save);
    };
  }, [pane.id, pane.activePath, active, model.loading, hasSourceTarget]);
  const tabs = pane.paths
    .map((path) => model.openTabs.find((tab) => isSameDocumentPath(tab.path, path)))
    .filter((tab) => tab !== undefined);
  return (
    <section
      ref={container}
      className={`reader-pane${active ? " is-active" : ""}`}
      aria-label={index === 0 ? "左侧文档窗格" : "右侧文档窗格"}
    >
      <div className="pane-tabs" onDoubleClick={() => workbench.pin(index)}>
        <Tabs
          tabs={tabs}
          activePath={pane.activePath}
          externallyModified={Boolean(document?.externallyModified)}
          onShowExternalChange={() => {
            workbench.activate(index);
            if (pane.activePath) model.setExternalChangePath(pane.activePath);
          }}
          onSelect={(path) => void workbench.openFile(path, false, index)}
          onClose={(path) => void workbench.close(index, path)}
          onCloseMany={(paths) => {
            void (async () => {
              for (const path of paths) await workbench.close(index, path);
            })();
          }}
          onReorder={(source, target) => workbench.reorder(index, source, target)}
          previewPath={pane.previewPath}
        />
      </div>
      {active && (!pane.activePath || matchesDocument) ? (
        <>
          {model.settingsNotice && (
            <div className="settings-notice" role="status">
              {model.settingsNotice}
            </div>
          )}
          <DocumentActions model={model}>{tools}</DocumentActions>
          <DocumentViewport
            model={model}
            pdfPage={pdfPage}
            onPdfPageChange={changePdfPage}
            pdfZoom={pdfZoom}
            onPdfZoomChange={changePdfZoom}
          />
        </>
      ) : (
        <>
          <div className="inactive-pane-tools">
            <span>{document?.name ?? "选择一份文档"}</span>
            <button onClick={() => workbench.activate(index)}>在此窗格工作</button>
          </div>
          <div className="content-area inactive-pane-content" onDoubleClick={() => workbench.activate(index)}>
            {pane.activePath ? (
              <DocumentPreview
                path={pane.activePath}
                draft={document?.kind === "markdown" || document?.kind === "text" ? session?.draft : undefined}
                html={document?.rendered.html}
                previewUrl={document?.previewUrl}
                allowRemoteResources={model.preferences.allowRemoteResources}
                page={pdfPage}
                zoom={pdfZoom}
                onZoomChange={changePdfZoom}
                onPageChange={changePdfPage}
              />
            ) : (
              <p>切换到此窗格后，从侧栏选择文档。</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
