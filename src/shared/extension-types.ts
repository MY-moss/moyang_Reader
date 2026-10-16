import type { AiAsset } from "./ai-types";

export type ExtensionKind = "reader" | "theme" | "skill" | "mcp" | "assistant";
export type ExtensionCommand = { id: string; name: string; modifiesDocument?: boolean };
export type ExtensionActions = {
  commands: Array<{ id: string; label: string; disabled?: boolean }>;
  execute: (id: string) => void;
};
export type McpConfiguration =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { url: string; headers?: Record<string, string> };
export type ExtensionPackage = {
  format: "moyang-extension";
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  kind: ExtensionKind;
  description: string;
  author: string;
  homepage?: string;
  license?: string;
  readme?: string;
  sourceFormat?: "agent-skill";
  entry?: string;
  files?: Record<string, string>;
  commands?: ExtensionCommand[];
  formats?: Array<"markdown" | "text" | "docx">;
  documentAnalysis?: boolean;
  theme?: { light: Record<string, string>; dark: Record<string, string> };
  skill?: { body: string; assets: AiAsset[] };
  mcp?: McpConfiguration;
  assistant?: { prompt: string; starters: string[] };
};
export type InstalledExtension = {
  package: ExtensionPackage;
  enabled: boolean;
  installedAt: number;
  previous?: ExtensionPackage;
  source: string;
  skillId?: string;
  skillRevision?: number;
  mcpOverride?: McpConfiguration;
};
export type ExtensionCatalog = {
  url: string;
  name: string;
  packages: ExtensionPackage[];
  checkedAt: number;
};
export type ExtensionState = {
  revision: number;
  installed: InstalledExtension[];
  catalogs: ExtensionCatalog[];
};
export type ExtensionLocation = { line: number; from: number; to: number };
export type ExtensionDocumentAnalysis = {
  headings: Array<ExtensionLocation & { depth: number; text: string }>;
  tasks: Array<ExtensionLocation & { checked: boolean; text: string }>;
  links: Array<ExtensionLocation & { text: string; url: string; image: boolean }>;
  tables: Array<ExtensionLocation & { rows: string[][] }>;
};
export type ExtensionInput = {
  command: string;
  text: string;
  path: string;
  title: string;
  format: string;
  analysis?: ExtensionDocumentAnalysis;
};
export type ExtensionFinding = ExtensionLocation & { label: string; detail?: string };
export type ExtensionArtifact = { name: string; content: string };
export type ExtensionOutput = {
  replacement?: string;
  report?: string;
  findings?: ExtensionFinding[];
  files?: ExtensionArtifact[];
};
export const extensionKinds: Record<ExtensionKind, string> = {
  reader: "阅读插件",
  theme: "主题",
  skill: "AI 技能",
  mcp: "MCP 服务",
  assistant: "聊天助手",
};
export const emptyExtensionState = (): ExtensionState => ({ revision: 0, installed: [], catalogs: [] });
