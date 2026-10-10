import { SOURCE_MAX_ENTRIES, type SourceRelease } from './sources';
import type { StoredMatchPreview } from './source-match-preview';

export type CachedSourceMatch = { release: SourceRelease; match: 'identity' | 'title' };
export const SOURCE_MATCH_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_QUERIES = 512, MAX_MATCHES = 8192, PER_OWNER = 12, PER_QUERY = 1000;
type Owner = { queries: Map<string, object> };
type Batch = { kind: 'files'; values: readonly CachedSourceMatch[] } | { kind: 'previews'; values: readonly StoredMatchPreview[] };

// Account every string as UTF-16 plus conservative record/property/array slots.
// This is a retained-data budget, not an exact engine heap measurement. Unknown
// nested data is not cached, so an accidental back-reference cannot retain a catalog.
function recordBytes(value: object, allowFiles: boolean, limit: number): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Infinity;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return Infinity;
  const keys = Object.keys(value);
  if (keys.length > 32 || Reflect.ownKeys(value).length !== keys.length) return Infinity;
  let bytes = 96;
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !('value' in property)) return Infinity;
    const item: unknown = property.value;
    bytes += 48 + key.length * 2;
    if (typeof item === 'string') bytes += item.length * 2;
    else if (item == null || typeof item === 'number' || typeof item === 'boolean') bytes += 16;
    else if (allowFiles && key === 'files' && Array.isArray(item) && item.length <= 64) {
      bytes += 64 + item.length * 8;
      for (const file of item) {
        if (!file || typeof file !== 'object') return Infinity;
        bytes += recordBytes(file, false, limit - bytes);
        if (bytes > limit) return Infinity;
      }
    } else return Infinity;
    if (bytes > limit) return Infinity;
  }
  return bytes;
}

/** Shared LRU bounds all live catalog snapshots. Tokens never retain their
 * owner arrays or source metadata; eviction also removes the owner's query key. */
export function createSourceMatchCache(maxBytes = SOURCE_MATCH_CACHE_BYTES, maxQueries = MAX_QUERIES, maxMatches = MAX_MATCHES, perOwner = PER_OWNER) {
  const owners = new WeakMap<object, Owner>();
  const held = new Map<object, Batch & { owner: Owner; key: string; bytes: number }>();
  let bytes = 0, matches = 0;
  function remove(token: object) {
    const item = held.get(token);
    if (!item) return;
    held.delete(token); item.owner.queries.delete(item.key);
    bytes -= item.bytes; matches -= item.values.length;
  }
  function get(owner: object, key: string) {
    const group = owners.get(owner), token = group?.queries.get(key), item = token && held.get(token);
    if (!group || !token || !item) return;
    held.delete(token); held.set(token, item);
    group.queries.delete(key); group.queries.set(key, token);
    return item;
  }
  function remember(owner: object, key: string, batch: Batch) {
    const values = batch.values;
    let group = owners.get(owner);
    const previous = group?.queries.get(key); if (previous) remove(previous);
    if (values.length > PER_QUERY || values.length > maxMatches || maxQueries < 1 || perOwner < 1) return;
    let size = 160 + key.length * 2 + values.length * 40;
    let detached: Batch;
    try {
      for (const value of values) {
        if (size > maxBytes) return;
        size += recordBytes(value.release, batch.kind === 'files', maxBytes - size);
        if (batch.kind === 'previews') {
          if (!('deferred' in value) || !value.deferred || !/^[a-f0-9]{64}$/.test(value.deferred.signature)
            || !Array.isArray(value.deferred.rows) || value.deferred.rows.length > SOURCE_MAX_ENTRIES
            || value.deferred.rows.some(row => !Number.isSafeInteger(row) || row < 0 || row >= SOURCE_MAX_ENTRIES)) return;
          size += 256 + value.deferred.signature.length * 2 + value.deferred.rows.length * 8;
        }
      }
      if (size > maxBytes) return;
      // Keep only detached scalar metadata and copied row references.
      detached = batch.kind === 'files'
        ? { kind: 'files', values: batch.values.map(({ release, match }) => ({ release, match })) }
        : { kind: 'previews', values: batch.values.map(({ release, match, deferred }) => ({ release: { ...release }, match, deferred: { signature: deferred.signature, rows: [...deferred.rows] } })) };
    } catch { return; }
    if (!group) { group = { queries: new Map() }; owners.set(owner, group); }
    const token = {};
    // Do not retain each result's source, whose entries/recent data can be large.
    held.set(token, { ...detached, owner: group, key, bytes: size });
    group.queries.set(key, token); bytes += size; matches += values.length;
    while (group.queries.size > perOwner) remove(group.queries.values().next().value!);
    while (bytes > maxBytes || held.size > maxQueries || matches > maxMatches) remove(held.keys().next().value!);
  }
  return {
    get(owner: object, key: string) { const item = get(owner, key); return item?.kind === 'files' ? item.values : undefined; },
    remember(owner: object, key: string, values: readonly CachedSourceMatch[]) { remember(owner, key, { kind: 'files', values }); },
    getPreviews(owner: object, key: string) { const item = get(owner, key); return item?.kind === 'previews' ? item.values : undefined; },
    rememberPreviews(owner: object, key: string, values: readonly StoredMatchPreview[]) { remember(owner, key, { kind: 'previews', values }); },
    forget(owner: object, key: string) { const token = owners.get(owner)?.queries.get(key); if (token) remove(token); },
    usage: () => ({ bytes, matches, queries: held.size }),
  };
}

export const sourceMatchCache = createSourceMatchCache();
