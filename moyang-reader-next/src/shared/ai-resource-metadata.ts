import type { AiAsset, AiRecord, AiRecordView, AiResourceInfo } from "./ai-types";

export async function resourceMetadata(asset: AiAsset): Promise<AiResourceInfo> {
  const bytes = new TextEncoder().encode(`${asset.encoding}\0${asset.content}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    path: asset.path,
    encoding: asset.encoding,
    size: new TextEncoder().encode(asset.content).length,
    fingerprint: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

export async function previewRecordView(record: AiRecord): Promise<AiRecordView> {
  const { assets, ...fields } = record;
  return { ...fields, resources: await Promise.all(assets.map(resourceMetadata)) };
}
