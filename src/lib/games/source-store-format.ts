import { SOURCE_MAX_SUBSCRIPTIONS, SOURCE_CATALOG_MAX_BYTES, SOURCE_STORE_MAX_BYTES, type GameSource, type SourceRelease, type SourceRecentPreview } from "./sources";
import { validateSourceStore } from "./source-store-validation";
import type { SourceTitleIndex } from './source-title-index';
import { sourceByteSize } from './source-byte-size';

export const SOURCE_CHUNK_BYTES = 8 * 1024 * 1024;
// Adjacent chunks together exceed one full chunk, even when a large release
// cannot share its chunk. Allow one final partial chunk per subscription too.
export const SOURCE_STORE_MAX_PARTS = 2 * Math.ceil(SOURCE_STORE_MAX_BYTES / SOURCE_CHUNK_BYTES) + SOURCE_MAX_SUBSCRIPTIONS;
export type SourceEntryLayout = { bytes: number; ends: number[] };
export type ValidatedSource = { source: GameSource; layout: SourceEntryLayout; storedEnds?: number[]; recent?: SourceRecentPreview[]; recentAt?: number; recentUntil?: number; total?: number; browseRows?: Uint32Array; browseTitles?: SourceTitleIndex };
export type StoredCatalog = { source: Omit<GameSource, "entries">; version: string; parts: number };
export type StoredSourceProfile = { version: 2; catalogs: StoredCatalog[] };

export function sourceEntryLayout(entries: SourceRelease[]): SourceEntryLayout {
  const builder = sourceEntryLayoutBuilder();
  builder.add(entries);
  return builder.finish();
}

/** Recompute the same normalized boundaries without retaining earlier chunks. */
export function sourceEntryLayoutBuilder() {
  let bytes = 2, chunkBytes = 2, start = 0, count = 0;
  const ends: number[] = [];
  return {
    add(entries: SourceRelease[]) {
      for (const entry of entries) {
        const size = sourceByteSize(JSON.stringify(entry), SOURCE_CHUNK_BYTES - 2);
        if (size + 2 > SOURCE_CHUNK_BYTES) throw Error("source_limit");
        if (count > start && chunkBytes + size + 1 > SOURCE_CHUNK_BYTES) {
          ends.push(count); start = count; chunkBytes = 2;
        }
        chunkBytes += size + (count > start ? 1 : 0);
        bytes += size + (count ? 1 : 0);
        if (bytes > SOURCE_CATALOG_MAX_BYTES) throw Error("source_limit");
        count++;
      }
    },
    finish(): SourceEntryLayout { return { bytes, ends: count ? [...ends, count] : [] }; },
  };
}

export function sourceStoreHeaders(sources: GameSource[]) {
  const headers = validateSourceStore(sources.map(source => ({ ...source, entries: [] })));
  if (new Set(headers.map(source => source.id)).size !== headers.length) throw Error("source_storage");
  return headers.map(({ entries: _, ...source }) => source);
}

export function storedSourceProfile(value: unknown): StoredSourceProfile {
  if (!value || typeof value !== "object") throw Error("source_storage");
  const profile = value as StoredSourceProfile;
  if (profile.version !== 2 || !Array.isArray(profile.catalogs) || profile.catalogs.length > SOURCE_MAX_SUBSCRIPTIONS) throw Error("source_storage");
  let parts = 0;
  for (const catalog of profile.catalogs) {
    if (!catalog || !catalog.source || typeof catalog.version !== "string" || !/^[a-f0-9-]{36}$/.test(catalog.version) || !Number.isSafeInteger(catalog.parts) || catalog.parts < 0 || (parts += catalog.parts) > SOURCE_STORE_MAX_PARTS) throw Error("source_storage");
  }
  const headers = sourceStoreHeaders(profile.catalogs.map(catalog => ({ ...catalog.source, entries: [] })));
  return { version: 2, catalogs: profile.catalogs.map((catalog, index) => ({ source: headers[index], version: catalog.version, parts: catalog.parts })) };
}

export function sourceProfileBytes(headers: Omit<GameSource, "entries">[], layouts: SourceEntryLayout[]) {
  let bytes = 2 + Math.max(0, headers.length - 1);
  for (let index = 0; index < headers.length; index++) {
    bytes += sourceByteSize(JSON.stringify({ ...headers[index], entries: [] })) - 2 + layouts[index].bytes;
    if (bytes > SOURCE_STORE_MAX_BYTES) throw Error("source_capacity");
  }
  return bytes;
}
