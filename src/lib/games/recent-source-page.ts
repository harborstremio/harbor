import { processSource } from './source-processing';
import { storedCatalog } from './source-catalog-query';
import { createSourceBrowseCache } from './source-browse-cache';
import { recentSourceRows, validRecentSourceQuery, type RecentSourceQuery } from './source-recent-browse';
import { SOURCE_MAX_ENTRIES, type GameSource } from './sources';
import type { ValidatedSource } from './source-store-format';
import { collectRecent, RECENT_SOURCE_LIMIT, type RecentSourceRelease } from './source-recent-selection';
import { sourceRecentPreview, validateRecentPreviews } from './source-recent-preview';
import { hydrateRecentPages } from './source-recent-hydration';

const cache = createSourceBrowseCache(true,128);
const firstPage = (filters: RecentSourceQuery, limit: number) => !filters.query.trim() && filters.sort === 'newest' && !filters.since && limit <= RECENT_SOURCE_LIMIT;
async function sourcePage(source: GameSource, filters: RecentSourceQuery, limit: number, signal: AbortSignal) {
  if (source.catalogIssue) throw Error('source_storage');
  const ref = source.catalog;
  if (!ref) {
    if (firstPage(filters, limit)) {
      const recent: RecentSourceRelease[] = []; let deadline = performance.now() + 5;
      for (const _ of collectRecent([source], filters.now, RECENT_SOURCE_LIMIT, recent)) {
        signal.throwIfAborted();
        if (performance.now() >= deadline) { await new Promise<void>(resolve => setTimeout(resolve, 0)); signal.throwIfAborted(); deadline = performance.now() + 5; }
      }
      const rows = new Map(recent.map(item => [item.release, -1]));
      for (let row = 0; row < source.entries.length; row++) {
        if (rows.has(source.entries[row])) rows.set(source.entries[row], row);
        if (row % 256 === 0 && performance.now() >= deadline) { await new Promise<void>(resolve => setTimeout(resolve, 0)); signal.throwIfAborted(); deadline = performance.now() + 5; }
      }
      return { source, entries: recent.slice(0, limit).map(item => sourceRecentPreview(item.release, rows.get(item.release)!)),
        total: recent.length < RECENT_SOURCE_LIMIT ? recent.length : Math.max(recent.length, limit + 1) };
    }
    const rows = recentSourceRows(source.entries, filters);
    return { source, entries: Array.from(rows.subarray(0, limit), row => sourceRecentPreview(source.entries[row], row)), total: rows.length };
  }
  // Reuse the existing lightweight summary for the first screen. Only scrolling
  // deeper or filtering needs the full catalog's compact date index.
  if (firstPage(filters, limit)) {
    let recent = ref.recent;
    if (filters.now < ref.recentAt || filters.now >= ref.recentUntil) {
      const value = await processSource({ kind: 'catalogSummary', profile: ref.profile, catalog: storedCatalog(source), now: filters.now, priority: 'foreground' }, signal) as ValidatedSource;
      signal.throwIfAborted(); recent = value.recent ?? [];
    }
    const entries = validateRecentPreviews(recent, ref.storedEnds.at(-1) ?? 0, filters.now, RECENT_SOURCE_LIMIT);
    return {source,entries:entries.slice(0,limit),total:entries.length<RECENT_SOURCE_LIMIT?entries.length:Math.max(entries.length,limit+1)};
  }
  const token = cache.select(ref.profile), catalog = storedCatalog(source);
  const key = JSON.stringify([ref.profile,source.id,source.url,ref.version,ref.parts,ref.storedEnds,filters]);
  let rows = cache.get(token, key);
  try {
    if (!rows) {
      const result = await processSource({kind:'catalogBrowse',profile:ref.profile,catalog,query:filters.query,limit:0,recent:filters},signal) as ValidatedSource;
      signal.throwIfAborted();
      if (!result.browseRows || result.browseRows.length !== result.total || result.storedEnds?.some((end,i)=>end!==ref.storedEnds[i]) || result.storedEnds?.length!==ref.storedEnds.length) throw Error('source_storage');
      rows = result.browseRows;
      cache.put(token,key,rows,ref.storedEnds.at(-1)??0);
    }
    const requested = Array.from(rows.subarray(0, limit));
    const result = await processSource({kind:'catalogRows',profile:ref.profile,catalog,rows:requested,ends:ref.storedEnds,preview:true},signal) as ValidatedSource;
    signal.throwIfAborted();
    const entries = validateRecentPreviews(result.recent, ref.storedEnds.at(-1) ?? 0, filters.now, requested.length);
    if (entries.length !== requested.length) throw Error('source_storage');
    // Disk reads are returned in physical order; restore the date-sorted index.
    const byRow = new Map(entries.map(entry => [entry.row, entry]));
    if (requested.some(row => !byRow.has(row))) throw Error('source_storage');
    return {source,entries:requested.map(row=>byRow.get(row)!),total:rows.length};
  } catch (error) { cache.remove(token,key); throw error; }
}

export async function loadRecentSourcePage(sources: readonly GameSource[], filters: RecentSourceQuery, limit: number, signal: AbortSignal, onFailed?: (source: GameSource, error: unknown) => void) {
  if (!validRecentSourceQuery(filters) || !Number.isSafeInteger(limit) || limit < 1) throw Error('source_storage');
  const pages: Awaited<ReturnType<typeof sourcePage>>[] = [], failed: string[] = [];
  const reportFailure = (source: GameSource, error: unknown) => { failed.push(source.name); onFailed?.(source, error); };
  for (const source of sources) {
    signal.throwIfAborted();
    if (!source.enabled) continue;
    try { pages.push(await sourcePage(source,filters,Math.min(limit === RECENT_SOURCE_LIMIT ? limit : limit+1,SOURCE_MAX_ENTRIES),signal)); }
    catch (error) { signal.throwIfAborted(); reportFailure(source, error); }
  }
  const result = await hydrateRecentPages(pages, filters, limit, signal, reportFailure);
  return {...result,failed};
}
