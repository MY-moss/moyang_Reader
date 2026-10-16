import { lazy, Suspense } from "react";
const SourceEditor = lazy(() =>
  import("../../features/editor/components/SourceEditor").then((module) => ({ default: module.SourceEditor })),
);
import { ImagePreview } from "../../features/reader/components/ImagePreview";
import { PdfPreview } from "../../features/reader/components/PdfPreview";
import { ProgressiveReaderContent } from "../../features/reader/components/ProgressiveReaderContent";
import { ReaderContextMenu } from "../../features/reader/components/ReaderContextMenu";
import { DraftRecoveryNotice } from "../../features/recovery/components/DraftRecoveryNotice";
import { ExternalChangeNotice } from "../../features/recovery/components/ExternalChangeNotice";
import { isSameDocumentPath } from "../../features/recovery/document-transition";
import { EmptyState } from "../../shell/components/EmptyState";
import { fileTypeLabel, LazyMarkdownWysiwygEditor, startsWithHeading } from "../support";
import type { ReaderApplication } from "../useReaderApplication";
export function DocumentViewport({
  model,
  pdfZoom,
  pdfPage,
  onPdfPageChange,
  onPdfZoomChange,
}: {
  pdfZoom?: number;
  pdfPage?: number;
  onPdfPageChange?: (page: number) => void;
  onPdfZoomChange?: (zoom: number) => void;
  model: Pick<
    ReaderApplication,
    | "setConflictPath"
    | "sourceLocation"
    | "setSourceLocation"
    | "focusMode"
    | "sidebarCollapsed"
    | "documentState"
    | "mode"
    | "canEdit"
    | "setExternalChangePath"
    | "setGuideOpen"
    | "openSelectedFile"
    | "handleChooseWorkspace"
    | "workspacePath"
    | "setSidebarCollapsed"
    | "setFocusMode"
    | "toggleReadingEditing"
    | "canUndo"
    | "canRedo"
    | "undoEditor"
    | "redoEditor"
    | "handleExportMarkdown"
    | "contentAreaRef"
    | "handleReaderWheel"
    | "readingZoomNotice"
    | "loading"
    | "externalChangePath"
    | "reloadExternalChange"
    | "overwriteExternalChange"
    | "draftRecovery"
    | "recoverDraft"
    | "deferDraftRecovery"
    | "discardDraft"
    | "error"
    | "articleRef"
    | "handleReaderClick"
    | "handleReaderContextMenu"
    | "sourceDraft"
    | "updateSource"
    | "handleInsertLink"
    | "handleFindEditorText"
    | "setSettingsNotice"
    | "wikiLinkCandidates"
    | "handleSourcePaste"
    | "readerContextMenu"
    | "handleCopyReaderText"
    | "handleCopyReaderLink"
    | "handleOpenReaderLink"
    | "handleCopyReaderDocumentPath"
    | "setReaderContextMenu"
  >;
}) {
  const {
    focusMode,
    sidebarCollapsed,
    documentState,
    mode,
    canEdit,
    setExternalChangePath,
    setGuideOpen,
    openSelectedFile,
    handleChooseWorkspace,
    workspacePath,
    setSidebarCollapsed,
    setFocusMode,
    toggleReadingEditing,
    canUndo,
    canRedo,
    undoEditor,
    redoEditor,
    handleExportMarkdown,
    contentAreaRef,
    handleReaderWheel,
    readingZoomNotice,
    loading,
    externalChangePath,
    reloadExternalChange,
    overwriteExternalChange,
    draftRecovery,
    recoverDraft,
    deferDraftRecovery,
    discardDraft,
    error,
    articleRef,
    handleReaderClick,
    handleReaderContextMenu,
    sourceDraft,
    updateSource,
    handleInsertLink,
    handleFindEditorText,
    setSettingsNotice,
    wikiLinkCandidates,
    handleSourcePaste,
    readerContextMenu,
    handleCopyReaderText,
    handleCopyReaderLink,
    handleOpenReaderLink,
    handleCopyReaderDocumentPath,
    setReaderContextMenu,
  } = model;
  return (
    <>
      <main ref={contentAreaRef} className="content-area" aria-live="polite" onWheel={handleReaderWheel}>
        {readingZoomNotice !== null && (
          <div className="reading-zoom-hud" role="status" aria-live="polite">
            阅读缩放 {readingZoomNotice}%
          </div>
        )}
        {sidebarCollapsed && !focusMode && (
          <button
            type="button"
            className="sidebar-restore"
            onClick={() => setSidebarCollapsed(false)}
            title="显示侧栏 (Ctrl+Shift+B)"
          >
            显示侧栏 <span>Ctrl+Shift+B</span>
          </button>
        )}
        {focusMode && (
          <button type="button" className="focus-exit" onClick={() => setFocusMode(false)}>
            退出专注 <span>Esc</span>
          </button>
        )}
        {loading && (
          <div className="reading-skeleton" role="status" aria-live="polite">
            <span>正在打开文档…</span>
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        {externalChangePath && documentState?.path === externalChangePath && (
          <ExternalChangeNotice
            onCompare={() => model.setConflictPath(documentState.path)}
            fileName={documentState.name}
            onReload={() => void reloadExternalChange()}
            onOverwrite={overwriteExternalChange}
            onSaveAs={() => void handleExportMarkdown()}
            onDismiss={() => setExternalChangePath(null)}
          />
        )}
        {draftRecovery && isSameDocumentPath(documentState?.path ?? "", draftRecovery.path) && (
          <DraftRecoveryNotice
            snapshot={draftRecovery}
            onRecover={recoverDraft}
            onLater={deferDraftRecovery}
            onDiscard={discardDraft}
          />
        )}
        {error && (
          <div className="error-state" role="alert">
            {error}
          </div>
        )}
        {!loading && !documentState && (
          <EmptyState
            onOpen={() => void openSelectedFile()}
            onChooseWorkspace={() => void handleChooseWorkspace()}
            onOpenGuide={() => setGuideOpen(true)}
            hasWorkspace={Boolean(workspacePath)}
            showWorkspaceAction={!workspacePath && !sidebarCollapsed}
          />
        )}
        {!loading && documentState && documentState.kind === "pdf" && mode === "rendered" && (
          <PdfPreview
            name={documentState.name}
            src={documentState.previewUrl}
            page={pdfPage ?? (model.sourceLocation?.path === documentState.path ? model.sourceLocation.page : 1)}
            onPageChange={(page) => {
              onPdfPageChange?.(page);
              model.setSourceLocation({ path: documentState.path, page });
            }}
            zoom={pdfZoom}
            onZoomChange={onPdfZoomChange}
          />
        )}
        {!loading && documentState && documentState.kind === "image" && mode === "rendered" && (
          <ImagePreview name={documentState.name} src={documentState.previewUrl} />
        )}
        {!loading &&
          documentState &&
          documentState.kind !== "pdf" &&
          documentState.kind !== "image" &&
          mode === "rendered" && (
            <div className="reader-stage">
              <article
                ref={articleRef}
                className="reader-content markdown-body"
                onClick={handleReaderClick}
                onContextMenu={handleReaderContextMenu}
              >
                <div className="reader-meta" aria-label="文档信息">
                  <span className="reader-meta-kicker">DOCUMENT</span>
                  <span>
                    {fileTypeLabel(documentState.kind)} · {documentState.rendered.wordCount.toLocaleString("zh-CN")} 字
                    · {documentState.rendered.readingMinutes} 分钟阅读
                  </span>
                  {documentState.externallyModified && (
                    <button
                      type="button"
                      className="reader-external-change"
                      onClick={() => setExternalChangePath(documentState.path)}
                    >
                      文件已被外部修改 · 处理
                    </button>
                  )}
                </div>
                {!startsWithHeading(documentState.rendered.html) && (
                  <header className="print-document-header" aria-hidden="true">
                    <span className="print-document-kicker">MOYANG READER · DOCUMENT</span>
                    <div className="print-document-title">{documentState.name}</div>
                  </header>
                )}
                <ProgressiveReaderContent html={documentState.rendered.html} />
              </article>
            </div>
          )}
        {!loading && documentState && documentState.kind === "markdown" && mode === "wysiwyg" && (
          <Suspense fallback={<div className="wysiwyg-loading-state">正在准备所见即所得编辑器…</div>}>
            <LazyMarkdownWysiwygEditor
              source={sourceDraft}
              documentKey={documentState.path}
              ariaLabel="Markdown 所见即所得编辑器"
              onChange={(value) => void updateSource(value, documentState.path)}
              onInsertLink={() => handleInsertLink()}
              onFindText={handleFindEditorText}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={(target) => undoEditor(target)}
              onRedo={(target) => redoEditor(target)}
              onStatusMessage={(message) => setSettingsNotice(message)}
              wikiCandidates={wikiLinkCandidates}
            />
          </Suspense>
        )}
        {!loading && documentState && canEdit && mode === "source" && (
          <Suspense fallback={<div className="loading-state">正在准备源文本编辑器…</div>}>
            <SourceEditor
              value={sourceDraft}
              ariaLabel={documentState.kind === "text" ? "文本源内容" : "Markdown 源文本"}
              onChange={(value) => void updateSource(value, documentState.path)}
              onPaste={handleSourcePaste}
              onInsertLink={handleInsertLink}
              onFindText={handleFindEditorText}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={(target) => undoEditor(target)}
              onRedo={(target) => redoEditor(target)}
              onStatusMessage={(message) => setSettingsNotice(message)}
              wikiCompletions={wikiLinkCandidates}
            />
          </Suspense>
        )}
        {readerContextMenu && documentState && mode === "rendered" && (
          <ReaderContextMenu
            target={readerContextMenu}
            documentPath={documentState.path.startsWith("browser://") ? null : documentState.path}
            canEdit={canEdit}
            editLabel={documentState.kind === "markdown" ? "进入所见即所得编辑" : "进入文本编辑"}
            onCopySelection={(text) => void handleCopyReaderText(text)}
            onFindSelection={(text) => handleFindEditorText(text)}
            onCopyLink={(href) => void handleCopyReaderLink(href)}
            onOpenLink={handleOpenReaderLink}
            onEdit={toggleReadingEditing}
            onCopyDocumentPath={() => void handleCopyReaderDocumentPath()}
            onClose={() => setReaderContextMenu(null)}
          />
        )}
      </main>
    </>
  );
}
