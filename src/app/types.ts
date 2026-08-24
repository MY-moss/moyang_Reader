export type ReaderMode = "rendered" | "source";

export type DocumentKind = "markdown" | "text" | "docx" | "pdf" | "image";

export type ThemeMode = "system" | "light" | "dark";

export type ReadingScale = "small" | "medium" | "large";

export type ReadingWidth = "narrow" | "standard" | "wide";

export type OpenPath = {
  path: string;
  kind: "document" | "workspace";
};

export type WorkspaceFile = {
  path: string;
  name: string;
  relativePath: string;
  size: number;
  kind: DocumentKind;
};

export type WorkspaceSearchResult = {
  file: WorkspaceFile;
  preview: string;
};

export type WorkspaceIndexEntry = {
  file: WorkspaceFile;
  title: string;
  links: string[];
  tags: string[];
};

export type WorkspaceRefreshResult = {
  scopePaths: string[];
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
};
