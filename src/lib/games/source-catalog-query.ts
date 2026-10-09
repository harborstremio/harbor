import { processSource } from './source-processing';
import { rememberSourceIndex, sourceIndex, sourceIndexCandidates } from './source-index';
import { matchingReleases, SOURCE_MAX_ENTRIES, type GameSource, type SourceRelease } from './sources';
import type { StoredCatalog, ValidatedSource } from './source-store-format';
import { createSourceBrowseCache } from './source-browse-cache';
import { createSourceTitleCache } from './source-title-index';

const browseCache = createSourceBrowseCache();
const titleCache = createSourceTitleCache();

export function storedCatalog(source: GameSource): StoredCatalog {
  const { entries: _, catalog, ...header } = source;
  if (!catalog) throw Error('source_storage');
  return { source: header, version: catalog.version, parts: catalog.parts };
}
export async function catalogMatchRows(source: GameSource, game: Parameters<typeof matchingReleases>[1], signal: AbortSignal) {
  signal.throwIfAborted();
  if (source.catalogIssue) throw Error('source_storage');
  const ref = source.catalog;
  if (!ref) throw Error('source_storage');
  let index = sourceIndex(source.entries);
  if (!index) {
    // Eviction is not an empty catalog. Recover the validated immutable version
    // in the worker, using its disk summary or a bounded chunk scan if necessary.
    const restored = await processSource({ kind: 'catalogSummary', profile: ref.profile, catalog: storedCatalog(source), priority: 'foreground' }, signal) as ValidatedSource;
    signal.throwIfAborted();
    index = sourceIndex(restored.source.entries);
    if (!index || restored.layout.bytes !== ref.layout.bytes || restored.storedEnds?.length !== ref.storedEnds.length || restored.storedEnds.some((end, i) => end !== ref.storedEnds[i])) throw Error('source_storage');
    rememberSourceIndex(source.entries, index);
  }
  return sourceIndexCandidates(index, game);
}
export async function catalogMatches(source: GameSource, game: Parameters<typeof matchingReleases>[1], signal: AbortSignal) {
  const rows = await catalogMatchRows(source, game, signal), ref = source.catalog!;
  // Empty candidates still verify the current subscription/version on disk.
  const value = await processSource({ kind: 'catalogRows', profile: ref.profile, catalog: storedCatalog(source), rows, ends: ref.storedEnds }, signal) as ValidatedSource;
  signal.throwIfAborted();
  return matchingReleases([{ ...source, entries: value.source.entries }], game).map(match => ({ ...match, source }));
}
export type CatalogBrowse = { entries: SourceRelease[]; total: number };
export async function browseSourceCatalog(source: GameSource, query: string, limit: number, signal: AbortSignal): Promise<CatalogBrowse> {
  signal.throwIfAborted();
  if (source.catalogIssue) throw Error('source_storage');
  if (typeof query !== 'string' || query.length > 500 || !Number.isSafeInteger(limit) || limit < 0 || limit > SOURCE_MAX_ENTRIES) throw Error('source_storage');
  const normalized = query.trim().toLocaleLowerCase();
  const ref = source.catalog;
  if (!ref) { const entries = source.entries.filter(entry => entry.title.toLocaleLowerCase().includes(normalized)); return { entries: entries.slice(0, limit), total: entries.length }; }
  const token = browseCache.select(ref.profile);
  const identity = JSON.stringify([ref.profile, source.id, source.url, ref.version, ref.parts, ref.storedEnds]);
  const titleToken = titleCache.select(identity), key = JSON.stringify([identity, normalized]);
  let cached = browseCache.get(token, key), searched = false;
  try {
    const titles = titleCache.get(titleToken);
    if (!cached && titles) {
      cached = await processSource({ kind: 'catalogSearch', index: titles, query: normalized }, signal) as Uint32Array;
      searched = true;
      signal.throwIfAborted();
    }
    if (cached) {
      const rows = Array.from(cached.subarray(0, limit));
      // Even a cached empty result rechecks the immutable version, so a removed
      // or refreshed subscription cannot silently return an obsolete count.
      const value = await processSource({ kind: 'catalogRows', profile: ref.profile, catalog: storedCatalog(source), rows, ends: ref.storedEnds }, signal) as ValidatedSource;
      signal.throwIfAborted();
      if (value.source.entries.length !== rows.length || value.source.entries.some(entry => !entry.title.toLocaleLowerCase().includes(normalized))) throw Error('source_storage');
      if (searched) browseCache.put(token, key, cached, ref.storedEnds.at(-1) ?? 0);
      return { entries: value.source.entries, total: cached.length };
    }
    const value = await processSource({ kind: 'catalogBrowse', profile: ref.profile, catalog: storedCatalog(source), query: normalized, limit }, signal) as ValidatedSource;
    signal.throwIfAborted();
    if (value.browseRows && value.browseRows.length === value.total && value.storedEnds?.length === ref.storedEnds.length && value.storedEnds.every((end, i) => end === ref.storedEnds[i])) {
      browseCache.put(token, key, value.browseRows, ref.storedEnds.at(-1) ?? 0);
      if (value.browseTitles) titleCache.put(titleToken, value.browseTitles, ref.storedEnds.at(-1) ?? 0);
    }
    return { entries: value.source.entries, total: value.total ?? 0 };
  } catch (error) {
    browseCache.remove(token, key);
    if (!signal.aborted) titleCache.remove(titleToken);
    throw error;
  }
}
