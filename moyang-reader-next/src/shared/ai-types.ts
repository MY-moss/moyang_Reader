export type AiKind = "knowledge" | "memory" | "skill";
export type AiAsset = { path: string; encoding: "utf8" | "base64"; content: string };
export type AiLocation = {
  uri: string;
  fingerprint: string;
  page: number | null;
  paragraph: number | null;
  quote: string;
};
export type AiSnapshot = {
  uri: string;
  format: string;
  fingerprint: string;
  imported_at: number;
  checked_at: number | null;
  locations: AiLocation[];
};
export type AiFragment = { ordinal: number; text: string; location: AiLocation; score: number };
export type AiFields = {
  kind: AiKind;
  title: string;
  summary: string;
  body: string;
  project: string;
  agent: string;
  sharing?: "legacy" | "global" | "project";
  snapshot?: AiSnapshot | null;
  tags: string[];
  source: string;
  memory_type: string;
  importance: number;
  pinned: boolean;
  expires_at: number | null;
  links: string[];
  assets: AiAsset[];
  skill_meta: Record<string, unknown>;
};
export type AiRecord = AiFields & {
  id: string;
  revision: number;
  created_at: number;
  updated_at: number;
  state: "active" | "archived";
};
export type AiRevision = { record: AiRecord; reason: string; recorded_at: number };
export type AiResourceInfo = Omit<AiAsset, "content"> & { size: number; fingerprint: string };
export type AiRecordView = Omit<AiRecord, "assets"> & { resources: AiResourceInfo[] };
export type AiRevisionView = { record: AiRecordView; reason: string; recorded_at: number };
export type AiRevisionSummary = {
  revision: number;
  title: string;
  reason: string;
  recorded_at: number;
  body_chars: number;
  resource_count: number;
};
export type AiHistoryPage = { items: AiRevisionSummary[]; next_before: number | null };
export type AiHit = Pick<
  AiRecord,
  | "id"
  | "kind"
  | "title"
  | "summary"
  | "project"
  | "agent"
  | "tags"
  | "source"
  | "revision"
  | "updated_at"
  | "pinned"
  | "state"
> & { excerpt: string; score: number; fragments?: AiFragment[] };
export type AiSearch = { items: AiHit[]; total: number; warning: string | null };
export type AiSemantic = { enabled: boolean; endpoint: string; model: string };
export type AiStats = {
  knowledge: number;
  memory: number;
  skill: number;
  archived: number;
  expired: number;
  indexed_chunks: number;
  embedded_chunks: number;
  semantic_paused?: boolean;
  projects: string[];
  agents: string[];
  database_path: string;
  semantic: AiSemantic;
};
export type AiBackup = {
  format: "moyang-ai-space";
  version: 1 | 2;
  exported_at: number;
  records: AiRecord[];
  history: AiRevision[];
  settings?: Record<string, string>;
  checkpoints?: unknown[];
  conflicts?: unknown[];
  activities?: unknown[];
  feedback?: Array<{ id: string; score: number; uses: number }>;
};
export type AiConnection = { directory: string; executable: string; available: boolean; native: boolean };
export const aiKinds: { key: AiKind; label: string; description: string }[] = [
  { key: "knowledge", label: "知识库", description: "资料与出处，让回答有据可查。" },
  { key: "memory", label: "长期记忆", description: "偏好、决策与经验，让每一次协作有所积累。" },
  { key: "skill", label: "技能库", description: "把好用的方法，变成可重复使用的步骤。" },
];
export function emptyAiFields(kind: AiKind): AiFields {
  return {
    kind,
    title: "",
    summary: "",
    body: "",
    project: "",
    agent: "",
    sharing: "global",
    snapshot: null,
    tags: [],
    source: "手动整理",
    memory_type: "fact",
    importance: 3,
    pinned: false,
    expires_at: null,
    links: [],
    assets: [],
    skill_meta: {},
  };
}
