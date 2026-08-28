export type ReaderMode = "rendered" | "source" | "wysiwyg";

export type ContextPanelTab = "outline" | "backlinks" | "properties";

export type LayoutState = {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeContextTab: ContextPanelTab;
  focusMode: boolean;
};

export type EditorResult =
  { status: "changed"; markdown: string } | { status: "fallback"; markdown: string; reason: string };

export type DocumentKind = "markdown" | "text" | "docx" | "pdf" | "image";

export type FileStamp = {
  size: number;
  modifiedMs: number | null;
};

export type ThemeMode = "system" | "light" | "dark";

export type ReadingScale = "small" | "medium" | "large";

export type ReadingWidth = "narrow" | "standard" | "wide";

export type ExportPaper = "a4" | "letter";

export type ExportOrientation = "portrait" | "landscape";

export type ExportMargin = "compact" | "standard" | "wide";

export type OpenPath = {
  path: string;
  kind: "document" | "workspace";
};

export type WorkspaceFile = {
  path: string;
  name: string;
  relativePath: string;
  size: number;
  modifiedMs?: number | null;
  kind: DocumentKind;
};

export type WorkspaceDirectory = {
  path: string;
  name: string;
  relativePath: string;
};

export type WorkspaceEntryDetails = {
  kind: "file" | "folder";
  name: string;
  relativePath: string;
  absolutePath?: string;
  documentKind?: DocumentKind;
  size?: number;
  fileCount?: number;
};

export type WorkspaceSearchResult = {
  file: WorkspaceFile;
  preview: string;
};

export type WorkspaceExportFailure = {
  fileName: string;
  reason: string;
};

export type WorkspaceIndexEntry = {
  file: WorkspaceFile;
  title: string;
  links: string[];
  tags: string[];
};

export type WorkspaceRefreshResult = {
  scopePaths: string[];
  folderScopePaths: string[];
  folders: WorkspaceDirectory[];
  files: WorkspaceFile[];
  index: WorkspaceIndexEntry[];
};

export type RecentFile = {
  path: string;
  name: string;
};

export type RecentWorkspace = {
  path: string;
  name: string;
};

export type TocItem = {
  id: string;
  depth: number;
  text: string;
};

export type RenderedMarkdown = {
  html: string;
  toc: TocItem[];
  wordCount: number;
  readingMinutes: number;
};

export type OpenDocument = {
  path: string;
  name: string;
  kind: DocumentKind;
  source: string;
  rendered: RenderedMarkdown;
  previewUrl?: string;
  modified: boolean;
  externallyModified: boolean;
};
