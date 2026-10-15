import { useCallback } from "react";
import {
  imageMimeType,
  isEditableDocument,
  renderDocx,
  renderSource,
} from "../features/documents/rendering/document-adapters";
import {
  BATCH_EXPORT_CHUNK_SIZE,
  buildBatchHtmlExport,
  buildDocxExport,
  buildHtmlExport,
  copyRichText,
  fileNameWithExtension,
  inlineLocalImages,
  pathWithExtension,
  pathWithNameSuffix,
  printHtmlDocument,
  summarizeExportFailures,
} from "../features/export/export";
import {
  chooseSavePath,
  exportPdfFile,
  fileSize,
  isTauriRuntime,
  readBinaryFile,
  readTextFile,
  writeBinaryFile,
  writeTextFile,
} from "../platform/bridge";
import { downloadBytes, downloadText, fileNameFromPath, resolveRelativePath, safeDecode } from "./support";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "documentState"
  | "preferences"
  | "setSettingsNotice"
  | "setError"
  | "setPrintPreview"
  | "pdfBatchExportRef"
  | "setWorkspaceExportNotice"
  | "workspaceExportAbortRef"
  | "setWorkspaceExporting"
  | "setWorkspaceExportProgress"
  | "preferencesRef"
  | "setWorkspaceExportFailures"
  | "printPreview"
  | "setCopyFeedback"
  | "sourceDraft"
>;
export function useDocumentExport({
  documentState,
  preferences,
  setSettingsNotice,
  setError,
  setPrintPreview,
  pdfBatchExportRef,
  setWorkspaceExportNotice,
  workspaceExportAbortRef,
  setWorkspaceExporting,
  setWorkspaceExportProgress,
  preferencesRef,
  setWorkspaceExportFailures,
  printPreview,
  setCopyFeedback,
  sourceDraft,
}: Input) {
  const buildCurrentExportHtml = useCallback(async (): Promise<string | null> => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return null;

    const body = isTauriRuntime()
      ? await inlineLocalImages(
          documentState.rendered.html,
          (source) => {
            const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
            if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
            return resolveRelativePath(documentState.path, safeDecode(target));
          },
          readBinaryFile,
          imageMimeType,
          fileSize,
        )
      : documentState.rendered.html;

    return buildHtmlExport(
      documentState.name,
      body,
      {
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
        template: preferences.exportTemplate,
      },
      documentState.rendered.toc,
    );
  }, [
    documentState,
    preferences.exportTemplate,
    preferences.exportMargin,
    preferences.exportOrientation,
    preferences.exportPaper,
  ]);

  const savePdfDocument = useCallback(
    async (html: string, defaultPath: string): Promise<boolean> => {
      if (!isTauriRuntime()) {
        await printHtmlDocument(html);
        return true;
      }

      const path = await chooseSavePath(defaultPath, "pdf");
      if (!path) return false;
      await exportPdfFile(path, html);
      setSettingsNotice(`已保存 PDF：${fileNameFromPath(path)}。`);
      return true;
    },
    [setSettingsNotice],
  );

  const handleExport = useCallback(async () => {
    if ((documentState?.kind === "pdf" || documentState?.kind === "image") && documentState.previewUrl) {
      const anchor = document.createElement("a");
      anchor.href = documentState.previewUrl;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
      return;
    }
    if (!documentState) return;

    try {
      const html = await buildCurrentExportHtml();
      if (!html) return;
      const saved = await savePdfDocument(html, pathWithExtension(documentState.path, "pdf"));
      if (!saved) return;
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 PDF 失败。");
    }
  }, [buildCurrentExportHtml, documentState, savePdfDocument, setError]);

  const handlePreviewPrint = useCallback(async () => {
    if (!documentState) return;

    try {
      const html = await buildCurrentExportHtml();
      if (!html) return;
      setPrintPreview({
        title: documentState.name,
        html,
        defaultPath: pathWithExtension(documentState.path, "pdf"),
        actionLabel: isTauriRuntime() ? "保存 PDF" : "打印 / 保存 PDF",
        actionHint: isTauriRuntime()
          ? "Windows 桌面版会将 PDF 保存到所选位置 · 预览内容不会修改原文"
          : "预计页数以系统打印对话框为准 · 预览内容不会修改原文",
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
        template: preferences.exportTemplate,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成打印版式预览失败。");
    }
  }, [
    buildCurrentExportHtml,
    documentState,
    preferences.exportTemplate,
    preferences.exportMargin,
    preferences.exportOrientation,
    preferences.exportPaper,
    setError,
    setPrintPreview,
  ]);

  const finishPdfBatch = useCallback(
    (cancelled: boolean) => {
      const batch = pdfBatchExportRef.current;
      if (!batch) return;

      const failureSummary = summarizeExportFailures(
        batch.skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
      );
      const suffix = failureSummary ? `，跳过 ${batch.skippedFiles.length} 个：${failureSummary}` : "";
      setWorkspaceExportNotice(
        cancelled
          ? `已取消批量打印，已整理 ${batch.exported} 篇文档${suffix}。`
          : `已完成批量打印，共 ${batch.exported} 篇文档${suffix}。`,
      );
      pdfBatchExportRef.current = null;
      workspaceExportAbortRef.current = null;
      setWorkspaceExporting(false);
      setWorkspaceExportProgress(null);
      setPrintPreview(null);
    },
    [
      pdfBatchExportRef,
      setPrintPreview,
      setWorkspaceExportNotice,
      setWorkspaceExportProgress,
      setWorkspaceExporting,
      workspaceExportAbortRef,
    ],
  );

  const prepareNextPdfBatch = useCallback(async () => {
    const batch = pdfBatchExportRef.current;
    const controller = workspaceExportAbortRef.current;
    if (!batch || !controller) return;

    const documents: Array<{ title: string; body: string }> = [];
    while (batch.nextIndex < batch.files.length && documents.length < BATCH_EXPORT_CHUNK_SIZE) {
      if (controller.signal.aborted) {
        finishPdfBatch(true);
        return;
      }

      const file = batch.files[batch.nextIndex];
      batch.nextIndex += 1;
      setWorkspaceExportProgress({ current: batch.nextIndex, total: batch.files.length, fileName: file.relativePath });
      try {
        const rendered =
          file.kind === "docx"
            ? await renderDocx(await readBinaryFile(file.path), {
                allowRemoteResources: preferencesRef.current.allowRemoteResources,
              })
            : await renderSource(
                file.kind === "text" ? "workspace-export.txt" : "workspace-export.md",
                await readTextFile(file.path),
                {
                  allowRemoteResources: preferencesRef.current.allowRemoteResources,
                },
              );
        const body = await inlineLocalImages(
          rendered.html,
          (source) => {
            const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
            if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
            return resolveRelativePath(file.path, safeDecode(target));
          },
          readBinaryFile,
          imageMimeType,
          fileSize,
        );
        documents.push({ title: file.relativePath, body });
        batch.exported += 1;
      } catch {
        batch.skippedFiles.push({ fileName: file.relativePath, reason: "读取失败" });
        setWorkspaceExportFailures([...batch.skippedFiles]);
      }
    }

    if (controller.signal.aborted) {
      finishPdfBatch(true);
      return;
    }
    if (documents.length === 0) {
      finishPdfBatch(false);
      if (batch.exported === 0) setError("当前筛选中没有可打印的 Markdown、文本或 Word 文档。");
      return;
    }

    batch.volumeNumber += 1;
    setPrintPreview({
      title: `${batch.title} · 第 ${batch.volumeNumber} 卷`,
      html: buildBatchHtmlExport(`${batch.title} · 第 ${batch.volumeNumber} 卷`, documents, batch.options),
      paper: batch.options.paper,
      orientation: batch.options.orientation,
      margin: batch.options.margin,
    });
    setWorkspaceExportNotice(`第 ${batch.volumeNumber} 卷已准备，打印后自动继续。`);
    setWorkspaceExporting(false);
    setWorkspaceExportProgress(null);
  }, [
    finishPdfBatch,
    pdfBatchExportRef,
    preferencesRef,
    setError,
    setPrintPreview,
    setWorkspaceExportFailures,
    setWorkspaceExportNotice,
    setWorkspaceExportProgress,
    setWorkspaceExporting,
    workspaceExportAbortRef,
  ]);

  const handlePrintPreview = useCallback(async () => {
    if (!printPreview) return;

    try {
      const batch = pdfBatchExportRef.current;
      if (batch) {
        await printHtmlDocument(printPreview.html);
        if (batch.nextIndex < batch.files.length) {
          await prepareNextPdfBatch();
        } else {
          finishPdfBatch(false);
        }
      } else {
        if (!documentState) return;
        const saved = await savePdfDocument(
          printPreview.html,
          printPreview.defaultPath ?? pathWithExtension(documentState.path, "pdf"),
        );
        if (!saved) return;
        setPrintPreview(null);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 PDF 失败。");
    }
  }, [
    documentState,
    finishPdfBatch,
    pdfBatchExportRef,
    prepareNextPdfBatch,
    printPreview,
    savePdfDocument,
    setError,
    setPrintPreview,
  ]);

  const handleClosePrintPreview = useCallback(() => {
    if (pdfBatchExportRef.current) finishPdfBatch(true);
    else setPrintPreview(null);
  }, [finishPdfBatch, pdfBatchExportRef, setPrintPreview]);

  const handleCopy = useCallback(async () => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return;

    try {
      await copyRichText(documentState.rendered.html);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1_600);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "复制文档失败。");
    }
  }, [documentState, setCopyFeedback, setError]);

  const handleExportMarkdown = useCallback(async () => {
    if (!documentState || !isEditableDocument(documentState.kind)) return;

    const extension = documentState.kind === "text" ? "txt" : "md";
    const contents = sourceDraft;
    try {
      if (isTauriRuntime()) {
        const path = await chooseSavePath(pathWithExtension(documentState.path, extension), "markdown");
        if (!path) return;
        await writeTextFile(path, contents);
      } else {
        downloadText(fileNameWithExtension(documentState.name, extension), contents);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出 Markdown 失败。");
    }
  }, [documentState, setError, sourceDraft]);

  const handleExportHtml = useCallback(async () => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return;

    const body = isTauriRuntime()
      ? await inlineLocalImages(
          documentState.rendered.html,
          (source) => {
            const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
            if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
            return resolveRelativePath(documentState.path, safeDecode(target));
          },
          readBinaryFile,
          imageMimeType,
          fileSize,
        )
      : documentState.rendered.html;
    const contents = buildHtmlExport(
      documentState.name,
      body,
      {
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
        template: preferences.exportTemplate,
      },
      documentState.rendered.toc,
    );
    try {
      if (isTauriRuntime()) {
        const path = await chooseSavePath(pathWithExtension(documentState.path, "html"), "html");
        if (!path) return;
        await writeTextFile(path, contents);
      } else {
        downloadText(fileNameWithExtension(documentState.name, "html"), contents, "text/html");
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出 HTML 失败。");
    }
  }, [
    documentState,
    preferences.exportTemplate,
    preferences.exportMargin,
    preferences.exportOrientation,
    preferences.exportPaper,
    setError,
  ]);

  const handleExportDocx = useCallback(async () => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return;

    try {
      const body = isTauriRuntime()
        ? await inlineLocalImages(
            documentState.rendered.html,
            (source) => {
              const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
              if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
              return resolveRelativePath(documentState.path, safeDecode(target));
            },
            readBinaryFile,
            imageMimeType,
            fileSize,
          )
        : documentState.rendered.html;
      const contents = await buildDocxExport(documentState.name, body, {
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
        template: preferences.exportTemplate,
      });

      if (isTauriRuntime()) {
        const defaultPath =
          documentState.kind === "docx"
            ? pathWithNameSuffix(documentState.path, " - 导出", "docx")
            : pathWithExtension(documentState.path, "docx");
        const path = await chooseSavePath(defaultPath, "docx");
        if (!path) return;
        await writeBinaryFile(path, contents);
      } else {
        downloadBytes(
          fileNameWithExtension(documentState.name, "docx"),
          contents,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出 Word 失败。");
    }
  }, [
    documentState,
    preferences.exportTemplate,
    preferences.exportMargin,
    preferences.exportOrientation,
    preferences.exportPaper,
    setError,
  ]);
  return {
    handleExport,
    handlePreviewPrint,
    finishPdfBatch,
    prepareNextPdfBatch,
    handlePrintPreview,
    handleClosePrintPreview,
    handleCopy,
    handleExportMarkdown,
    handleExportHtml,
    handleExportDocx,
  };
}
