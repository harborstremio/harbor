import { SOURCE_MAX_ENTRIES, SOURCE_CATALOG_MAX_BYTES } from './sources';
import { SOURCE_CHUNK_BYTES, type StoredCatalog, type ValidatedSource, type SourceEntryLayout } from './source-store-format';
import { validateRecentPreviews } from './source-recent-preview';
import type { SourceIndex } from './source-index';
import { RECENT_SOURCE_LIMIT } from './source-recent-selection';

// Bump whenever normalization, matching, recent selection or stored chunk rules change.
export const SOURCE_SUMMARY_SCHEMA = 5;
export const SOURCE_SUMMARY_MAX_BYTES = 4 * 1024 * 1024;
export type SourceSummaryCache = {
  schema: number; profile: string; id: string; url: string; version: string; parts: number;
  layout: SourceEntryLayout; storedEnds: number[]; recent: NonNullable<ValidatedSource['recent']>;
  recentAt: number; recentUntil: number; index: SourceIndex; sha256: string;
};
export const summaryCacheKey = (profile: string, catalog: StoredCatalog) => JSON.stringify([profile, catalog.source.id, catalog.version]);

function validEnds(value: unknown, parts: number): value is number[] {
  return Array.isArray(value) && value.length === parts && value.every((end, i) => Number.isSafeInteger(end) && end > (value[i - 1] ?? 0) && end <= SOURCE_MAX_ENTRIES);
}
function checked(value: unknown, profile: string, catalog: StoredCatalog): SourceSummaryCache {
  const item = value as SourceSummaryCache | null;
  if (!item || item.schema !== SOURCE_SUMMARY_SCHEMA || item.profile !== profile || item.id !== catalog.source.id || item.url !== catalog.source.url || item.version !== catalog.version || item.parts !== catalog.parts || typeof profile !== 'string' || !profile || profile.length > 256 || !Number.isSafeInteger(item.parts) || item.parts < 0 || item.parts > 512) throw Error('source_cache');
  if (!item.layout || !Number.isSafeInteger(item.layout.bytes) || item.layout.bytes < 2 || item.layout.bytes > SOURCE_CATALOG_MAX_BYTES || !validEnds(item.layout.ends, item.parts) || !validEnds(item.storedEnds, item.parts) || item.layout.ends.some((end, i) => end !== item.storedEnds[i])) throw Error('source_cache');
  const count = item.storedEnds.at(-1) ?? 0;
  if (!count && item.layout.bytes !== 2 || count && item.layout.bytes > item.parts * SOURCE_CHUNK_BYTES) throw Error('source_cache');
  if (!item.index || !(item.index.keys instanceof Uint32Array) || !(item.index.rows instanceof Uint32Array) || item.index.keys.length !== count * 2 || item.index.rows.length !== count * 2) throw Error('source_cache');
  const occurrences = new Uint8Array(count);
  for (let i = 0; i < item.index.keys.length; i++) {
    const row = item.index.rows[i];
    if (row >= count || i > 0 && item.index.keys[i] < item.index.keys[i - 1] || ++occurrences[row] > 2) throw Error('source_cache');
  }
  if (occurrences.some(value => value !== 2)) throw Error('source_cache');
  if (!Array.isArray(item.recent) || item.recent.length > Math.min(RECENT_SOURCE_LIMIT, count) || !Number.isFinite(item.recentAt) || item.recentAt < 0 || !(item.recentUntil === Infinity || Number.isFinite(item.recentUntil) && item.recentUntil > item.recentAt)) throw Error('source_cache');
  const recent = validateRecentPreviews(item.recent, count, item.recentAt, RECENT_SOURCE_LIMIT);
  return { schema: SOURCE_SUMMARY_SCHEMA, profile, id: item.id, url: item.url, version: item.version, parts: item.parts, layout: { bytes: item.layout.bytes, ends: [...item.layout.ends] }, storedEnds: [...item.storedEnds], recent, recentAt: item.recentAt, recentUntil: item.recentUntil, index: item.index, sha256: item.sha256 };
}
function encoded(item: SourceSummaryCache) {
  const { index, sha256: _, ...metadata } = item;
  const text = JSON.stringify(metadata);
  if (text.length > SOURCE_SUMMARY_MAX_BYTES) throw Error('source_cache');
  const header = new TextEncoder().encode(text), size = header.byteLength + index.keys.byteLength + index.rows.byteLength;
  if (size > SOURCE_SUMMARY_MAX_BYTES) throw Error('source_cache');
  const bytes = new Uint8Array(size); bytes.set(header); bytes.set(new Uint8Array(index.keys.buffer, index.keys.byteOffset, index.keys.byteLength), header.length); bytes.set(new Uint8Array(index.rows.buffer, index.rows.byteOffset, index.rows.byteLength), header.length + index.keys.byteLength);
  return bytes;
}
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** Optional derived data; checksums detect corruption, not publisher authenticity. */
export async function createSummaryCache(profile: string, catalog: StoredCatalog, value: ValidatedSource, index: SourceIndex) {
  const item = checked({ schema: SOURCE_SUMMARY_SCHEMA, profile, id: catalog.source.id, url: catalog.source.url, version: catalog.version, parts: catalog.parts, layout: value.layout, storedEnds: value.storedEnds, recent: value.recent, recentAt: value.recentAt, recentUntil: value.recentUntil, index, sha256: '' }, profile, catalog);
  const bytes = encoded(item); item.sha256 = await digest(bytes);
  return { item, bytes: bytes.byteLength };
}
export async function restoreSummaryCache(value: unknown, profile: string, catalog: StoredCatalog, bytes: number, now: number): Promise<{ value: ValidatedSource; index: SourceIndex } | undefined> {
  try {
    const item = checked(value, profile, catalog);
    if (!Number.isFinite(now) || now < item.recentAt || now >= item.recentUntil || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) return;
    const encodedBytes = encoded(item);
    if (encodedBytes.byteLength !== bytes || await digest(encodedBytes) !== item.sha256) return;
    return { value: { source: { ...catalog.source, entries: [] }, layout: item.layout, storedEnds: item.storedEnds, recent: item.recent, recentAt: item.recentAt, recentUntil: item.recentUntil }, index: item.index };
  } catch { return; }
}
