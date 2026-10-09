import { parseStoredSourceManifest, SOURCE_MAX_SUBSCRIPTIONS, SOURCE_STORE_MAX_BYTES, sourceUrl, sourceWebsite, type GameSource } from "./sources";
import { sourceByteSize } from './source-byte-size';

export function validateSourceStore(value: unknown): GameSource[] {
  if (!Array.isArray(value) || value.length > SOURCE_MAX_SUBSCRIPTIONS) throw Error("source_storage");
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item.id !== "string" || !/^[\w-]{1,80}$/.test(item.id) || !sourceUrl(item.url) || seen.has(item.url) || !Number.isFinite(item.checkedAt)) throw Error("source_storage");
    seen.add(item.url);
    const manifest = parseStoredSourceManifest(item);
    if (manifest.skipped) throw Error("source_storage");
    const website = sourceWebsite(item.website);
    if (item.format === "website" && (!website || website.site !== sourceUrl(item.url))) throw Error("source_storage");
    return { ...manifest, metadataVersion: Number.isSafeInteger(item.metadataVersion) && item.metadataVersion > 0 ? item.metadataVersion : undefined, id: item.id, url: sourceUrl(item.url)!, checkedAt: item.checkedAt, enabled: item.enabled === true, format: item.format === "website" ? "website" : item.format === "community" ? "community" : "harbor", website: item.format === "website" ? website : undefined, skipped: Number.isSafeInteger(item.skipped) && item.skipped >= 0 ? item.skipped : 0, error: typeof item.error === "string" && /^games\.sources\.source_[a-z_]+$/.test(item.error) ? item.error : undefined };
  });
}

export function checkSourceStoreSize(sources: GameSource[]) {
  if (sources.length > SOURCE_MAX_SUBSCRIPTIONS) throw Error("source_limit");
  // Measure one catalog at a time to avoid a second full-profile JSON allocation.
  let bytes = 2 + Math.max(0, sources.length - 1);
  for (const source of sources) {
    bytes += sourceByteSize(JSON.stringify(source), SOURCE_STORE_MAX_BYTES - bytes);
    if (bytes > SOURCE_STORE_MAX_BYTES) throw Error("source_capacity");
  }
}
