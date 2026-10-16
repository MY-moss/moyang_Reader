import { useCallback } from "react";
import { imageMimeType, renderDocx, renderSource } from "../features/documents/rendering/document-adapters";
import {
  BATCH_EXPORT_CHUNK_SIZE,
  BATCH_EXPORT_MAX_ESTIMATED_BYTES,
  buildBatchDocxExport,
  buildBatchHtmlExport,
  formatExportCancellationNotice,
  formatExportFailureReport,
  inlineLocalImages,
  pathWithExtension,
  pathWithNameSuffix,
  shouldFlushBatchExport,
  summarizeExportFailures,
} from "../features/export/export";
import {
  chooseSavePath,
  fileSize,
  isTauriRuntime,
  readBinaryFile,
  readTextFile,
  writeBinaryFile,
  writeTextFile,
} from "../platform/bridge";
import type { WorkspaceExportFailure } from "../shared/types";
import { downloadText, fileNameFromPath, resolveRelativePath, safeDecode } from "./support";
import type { useDocumentExport } from "./useDocumentExport";
import type { useReaderCommands } from "./useReaderCommands";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "workspaceExportAbortRef"
  | "pdfBatchExportRef"
  | "workspaceExportFailures"
  | "setWorkspaceExportNotice"
  | "setError"
  | "workspacePath"
  | "setWorkspaceExporting"
  | "setWorkspaceExportProgress"
  | "setWorkspaceExportFailures"
  | "preferences"
> &
  Pick<ReturnType<typeof useDocumentExport>, "finishPdfBatch" | "prepareNextPdfBatch"> &
  Pick<ReturnType<typeof useReaderCommands>, "workspaceExportFiles">;
export function useWorkspaceExport({
  workspaceExportAbortRef,
  pdfBatchExportRef,
  finishPdfBatch,
  workspaceExportFailures,
  setWorkspaceExportNotice,
  setError,
  workspacePath,
  workspaceExportFiles,
  setWorkspaceExporting,
  setWorkspaceExportProgress,
  setWorkspaceExportFailures,
  preferences,
  prepareNextPdfBatch,
}: Input) {
  const handleCancelWorkspaceExport = useCallback(() => {
    workspaceExportAbortRef.current?.abort();
    if (pdfBatchExportRef.current) finishPdfBatch(true);
  }, [finishPdfBatch, pdfBatchExportRef, workspaceExportAbortRef]);

  const copyWorkspaceExportFailures = useCallback(async () => {
    if (workspaceExportFailures.length === 0) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("当前环境不支持复制到剪贴板。");
      await navigator.clipboard.writeText(formatExportFailureReport(workspaceExportFailures));
      setWorkspaceExportNotice(`已复制 ${workspaceExportFailures.length} 个失败项清单。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "复制导出失败清单失败。");
    }
  }, [setError, setWorkspaceExportNotice, workspaceExportFailures]);

  const saveWorkspaceExportFailures = useCallback(async () => {
    if (workspaceExportFailures.length === 0) return;

    const report = formatExportFailureReport(workspaceExportFailures);
    try {
      if (isTauriRuntime()) {
        const workspaceName = fileNameFromPath(workspacePath?.replace(/[\\/]+$/, "") ?? "") || "阅读库";
        const defaultPath = pathWithExtension(`${workspacePath ?? ""}\\${workspaceName} - 导出失败清单.md`, "md");
        const path = await chooseSavePath(defaultPath, "markdown");
        if (!path) return;
        await writeTextFile(path, report);
      } else {
        downloadText("moyang-reader-export-failures.md", report);
      }
      setWorkspaceExportNotice(`已保存 ${workspaceExportFailures.length} 个失败项清单。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存导出失败清单失败。");
    }
  }, [setError, setWorkspaceExportNotice, workspaceExportFailures, workspacePath]);

  const handleExportWorkspace = useCallback(
    async (format: "html" | "docx" | "pdf") => {
      if (!workspacePath || workspaceExportFiles.length === 0 || !isTauriRuntime()) return;

      const workspaceName = fileNameFromPath(workspacePath.replace(/[\\/]+$/, "")) || "阅读库";
      let savePath: string | null = null;
      try {
        if (format !== "pdf") {
          savePath = await chooseSavePath(pathWithExtension(`${workspacePath}\\${workspaceName}`, format), format);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "打开导出保存位置失败。");
        return;
      }
      if (format !== "pdf" && !savePath) return;

      const controller = new AbortController();
      workspaceExportAbortRef.current = controller;
      setWorkspaceExporting(true);
      setWorkspaceExportProgress({ current: 0, total: workspaceExportFiles.length, fileName: "准备导出…" });
      setWorkspaceExportFailures([]);
      setWorkspaceExportNotice(null);
      setError(null);

      if (format === "pdf") {
        const files = workspaceExportFiles.filter(
          (file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text",
        );
        if (files.length === 0) {
          workspaceExportAbortRef.current = null;
          setWorkspaceExporting(false);
          setWorkspaceExportProgress(null);
          setWorkspaceExportNotice("当前筛选中没有可打印的 Markdown、文本或 Word 文档。");
          return;
        }

        pdfBatchExportRef.current = {
          files,
          nextIndex: 0,
          volumeNumber: 0,
          exported: 0,
          skippedFiles: [],
          title: `${workspaceName} 阅读库`,
          options: {
            paper: preferences.exportPaper,
            orientation: preferences.exportOrientation,
            margin: preferences.exportMargin,
            template: preferences.exportTemplate,
          },
        };
        try {
          await prepareNextPdfBatch();
        } catch (cause) {
          finishPdfBatch(true);
          setError(cause instanceof Error ? cause.message : "批量打印准备失败。");
        }
        return;
      }

      let exported = 0;
      let writtenVolumes = 0;
      const skippedFiles: WorkspaceExportFailure[] = [];
      const recordSkippedFile = (fileName: string, reason: string) => {
        skippedFiles.push({ fileName, reason });
        setWorkspaceExportFailures([...skippedFiles]);
      };
      try {
        const exportTitle = `${workspaceName} 阅读库`;
        const exportOptions = {
          paper: preferences.exportPaper,
          orientation: preferences.exportOrientation,
          margin: preferences.exportMargin,
          template: preferences.exportTemplate,
        };
        const exportableFileCount = workspaceExportFiles.filter(
          (file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text",
        ).length;
        const estimatedExportBytes = workspaceExportFiles
          .filter((file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text")
          .reduce((total, file) => total + file.size, 0);
        const expectedVolumeCount = Math.max(
          1,
          Math.ceil(exportableFileCount / BATCH_EXPORT_CHUNK_SIZE),
          Math.ceil(estimatedExportBytes / BATCH_EXPORT_MAX_ESTIMATED_BYTES),
        );
        let documents: { title: string; body: string }[] = [];
        let estimatedDocumentBytes = 0;
        const flushDocuments = async () => {
          if (documents.length === 0) return;
          if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");

          const batch = documents;
          documents = [];
          estimatedDocumentBytes = 0;
          const volumeNumber = writtenVolumes + 1;
          const volumeTitle = expectedVolumeCount > 1 ? `${exportTitle} · 第 ${volumeNumber} 卷` : exportTitle;
          if (format === "html") {
            if (!savePath) throw new Error("没有选择 HTML 保存位置。");
            const targetPath =
              expectedVolumeCount > 1 ? pathWithNameSuffix(savePath, ` - 第 ${volumeNumber} 卷`, "html") : savePath;
            await writeTextFile(targetPath, buildBatchHtmlExport(volumeTitle, batch, exportOptions));
          } else {
            if (!savePath) throw new Error("没有选择 Word 保存位置。");
            const targetPath =
              expectedVolumeCount > 1 ? pathWithNameSuffix(savePath, ` - 第 ${volumeNumber} 卷`, "docx") : savePath;
            await writeBinaryFile(
              targetPath,
              await buildBatchDocxExport(volumeTitle, batch, exportOptions, controller.signal),
            );
          }
          writtenVolumes = volumeNumber;
          if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");
        };

        for (const [index, file] of workspaceExportFiles.entries()) {
          if (controller.signal.aborted) {
            setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
            return;
          }
          setWorkspaceExportProgress({
            current: index + 1,
            total: workspaceExportFiles.length,
            fileName: file.relativePath,
          });
          try {
            let rendered;
            if (file.kind === "docx") {
              rendered = await renderDocx(await readBinaryFile(file.path), {
                allowRemoteResources: preferences.allowRemoteResources,
              });
            } else if (file.kind === "markdown" || file.kind === "text") {
              rendered = await renderSource(
                file.kind === "text" ? "workspace-export.txt" : "workspace-export.md",
                await readTextFile(file.path),
                {
                  allowRemoteResources: preferences.allowRemoteResources,
                },
              );
            } else {
              recordSkippedFile(file.relativePath, "类型不支持");
              continue;
            }

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
            estimatedDocumentBytes += (body.length + file.relativePath.length) * 2;
            exported += 1;
            if (shouldFlushBatchExport(documents.length, estimatedDocumentBytes)) await flushDocuments();
          } catch (cause) {
            recordSkippedFile(file.relativePath, cause instanceof Error ? cause.message : "读取失败");
          }
        }

        if (controller.signal.aborted) {
          setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
          return;
        }

        if (exported === 0) {
          const failureSummary = summarizeExportFailures(
            skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
          );
          throw new Error(
            failureSummary
              ? `当前筛选中没有可导出的文档。跳过 ${skippedFiles.length} 个：${failureSummary}`
              : "当前筛选中没有可导出的 Markdown、文本或 Word 文档。",
          );
        }
        await flushDocuments();
        const formatLabel = format === "html" ? "HTML" : "Word";
        const failureSummary = summarizeExportFailures(
          skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
        );
        const volumeNotice = writtenVolumes > 1 ? `，已分卷为 ${writtenVolumes} 个文件` : "";
        const destinationNotice = savePath ? `（${fileNameFromPath(savePath)}）` : "";
        setWorkspaceExportNotice(
          `已导出 ${exported} 篇文档为 ${formatLabel}${destinationNotice}${volumeNotice}${
            failureSummary ? `，跳过 ${skippedFiles.length} 个：${failureSummary}` : ""
          }。`,
        );
      } catch (cause) {
        if (controller.signal.aborted) {
          setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
        } else {
          setError(cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "批量导出失败。");
        }
      } finally {
        if (workspaceExportAbortRef.current === controller) workspaceExportAbortRef.current = null;
        setWorkspaceExporting(false);
        setWorkspaceExportProgress(null);
      }
    },
    [
      workspacePath,
      workspaceExportFiles,
      workspaceExportAbortRef,
      setWorkspaceExporting,
      setWorkspaceExportProgress,
      setWorkspaceExportFailures,
      setWorkspaceExportNotice,
      setError,
      pdfBatchExportRef,
      preferences.exportPaper,
      preferences.exportOrientation,
      preferences.exportTemplate,
      preferences.exportMargin,
      preferences.allowRemoteResources,
      prepareNextPdfBatch,
      finishPdfBatch,
    ],
  );
  return {
    handleCancelWorkspaceExport,
    copyWorkspaceExportFailures,
    saveWorkspaceExportFailures,
    handleExportWorkspace,
  };
}
