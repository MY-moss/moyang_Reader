import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";
export type StorageLocation = {
  key: string;
  label: string;
  logical: string;
  physical: string;
  bytes: number;
  files: number;
};
export type StorageInfo = {
  native: boolean;
  locations: StorageLocation[];
  program?: string;
  externalModels?: string;
  report?: { status: "running" | "complete" | "error"; message: string; target: string; retained?: string[] } | null;
};
export type StoragePlan = { target: string; items: StorageLocation[]; bytes: number; free: number };
export const storageInfo = (): Promise<StorageInfo> =>
  isTauriRuntime() ? invoke("storage_info") : Promise.resolve({ native: false, locations: [] });
export const chooseStorageTarget = (): Promise<string | null> => invoke("storage_choose_target");
export const prepareStorageMove = (includeModels: boolean): Promise<StoragePlan> =>
  invoke("storage_prepare", { includeModels });
export const startStorageMove = (): Promise<void> => invoke("storage_start");
