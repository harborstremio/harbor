import type { SourceGameArtwork } from './source-display';
import { sourcePageUrl } from './source-page-url';
import { sourceUrl, type GameSource, type SourceRelease } from './sources';

export const RECENT_ART_CACHE_BYTES = 4 * 1024 * 1024;
const MAX_ENTRIES = 144;
type CachedArt = { until: number; art?: SourceGameArtwork };

/** Keep every artwork input, not unrelated download mirrors. The same page
 * selector is used by the actual reader, so ambiguity cannot change on a hit. */
export function recentArtworkKey(release: SourceRelease, source?: GameSource): string {
  const page = source && !release.steamId && !release.igdbId ? sourcePageUrl(source, release) : undefined;
  return JSON.stringify([
    release.title, release.steamId, release.igdbId, release.platform, release.kind,
    source?.id, source?.url, source?.name, source?.checkedAt, source?.catalog?.profile, source?.catalog?.version,
    page, sourceUrl(release.sourcePage) || sourceUrl(source?.homepage) || sourceUrl(source?.url),
  ]);
}

/** Account and detach a small plain metadata tree. Oversized/unknown values are
 * still returned to callers, but never retain arbitrary graphs in this cache.
 * UTF-16 strings and conservative slots form a budget, not an exact heap limit. */
function copyArtwork(art: SourceGameArtwork | undefined, limit: number) {
  let bytes = 0, nodes = 0;
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > 2048 || depth > 8) throw Error('art_cache_limit');
    bytes += 16;
    if (typeof value === 'string') bytes += value.length * 2;
    if (bytes > limit) throw Error('art_cache_limit');
    if (value == null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
    if (typeof value !== 'object') throw Error('art_cache_shape');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw Error('art_cache_shape');
    const keys = Object.keys(value);
    if (keys.length > (array ? 1024 : 64) || Reflect.ownKeys(value).length !== keys.length + (array ? 1 : 0)
      || array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) throw Error('art_cache_shape');
    bytes += 96;
    const result: Record<string, unknown> | unknown[] = array ? [] : {};
    for (const key of keys) {
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (!property || !('value' in property)) throw Error('art_cache_shape');
      bytes += 48 + key.length * 2;
      const item = copy(property.value, depth + 1);
      Object.defineProperty(result, key, { value: item, enumerable: true, writable: true, configurable: true });
    }
    if (bytes > limit) throw Error('art_cache_limit');
    return Object.freeze(result);
  };
  return { art: copy(art, 0) as SourceGameArtwork | undefined, bytes };
}

export function createRecentSourceArtCache(maxBytes = RECENT_ART_CACHE_BYTES, maxEntries = MAX_ENTRIES) {
  const held = new Map<string, { value: CachedArt; bytes: number }>();
  let bytes = 0;
  const remove = (key: string) => {
    const item = held.get(key);
    if (item) { bytes -= item.bytes; held.delete(key); }
  };
  return {
    get(key: string, now = Date.now()): CachedArt | undefined {
      const item = held.get(key);
      if (!item) return;
      if (item.value.until <= now) { remove(key); return; }
      held.delete(key); held.set(key, item);
      return item.value;
    },
    remember(key: string, art: SourceGameArtwork | undefined, now = Date.now()) {
      remove(key);
      for (const [key, item] of held) if (item.value.until <= now) remove(key);
      const overhead = 160 + key.length * 2;
      if (maxEntries < 1 || overhead > maxBytes) return;
      let copied: ReturnType<typeof copyArtwork>;
      try { copied = copyArtwork(art, maxBytes - overhead); } catch { return; }
      const size = overhead + copied.bytes;
      const value = Object.freeze({ until: now + (art?.game.sourceListing ? 5 * 60_000 : art ? 30 * 60_000 : 60_000), art: copied.art });
      held.set(key, { value, bytes: size }); bytes += size;
      while (bytes > maxBytes || held.size > maxEntries) remove(held.keys().next().value!);
    },
    usage: () => ({ bytes, entries: held.size }),
  };
}
