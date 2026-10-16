export type SourceLocation = {
  path: string;
  hash?: string;
  page?: number;
  paragraph?: number;
  offset?: number;
  endOffset?: number;
  source?: boolean;
  quote?: string;
};
export type SourceChunk = { text: string; location: SourceLocation };
export type ReaderSearchHit = { path: string; title: string; kind: string; hits: SourceChunk[] };
export type ReaderSearchPage = { items: ReaderSearchHit[]; total: number };
export type Bookmark = {
  id: string;
  title: string;
  location: SourceLocation;
  query?: string;
  view?: SavedView;
  created: number;
};
export type Annotation = { id: string; location: SourceLocation; quote: string; comment: string; created: number };
export type SavedView = {
  id: string;
  title: string;
  root: string;
  query: string;
  tag: string | null;
  kind: string;
  sort: "relevance" | "name";
};
export type SavedVersion = { id: number; created: number; size: number; preview: string };
export type RecycledEntry = { id: string; path: string; name: string; deletedAt: number; folder: boolean };
export type RecyclePreview = { path: string; name: string; folder: boolean; children: string[] };
