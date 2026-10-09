import { matchingReleases, type GameSource } from './sources';
import { sourceIndex, sourceIndexCandidates, type SourceIndex } from './source-index';
import { catalogMatches } from './source-catalog-query';
import { processSource } from './source-processing';
import { sourceMatchCache as cache } from './source-match-cache';

type Reference = Parameters<typeof matchingReleases>[1];
type Matches = ReturnType<typeof matchingReleases>;

/** Scan the entire catalog cooperatively, so large subscriptions cannot monopolize a frame. */
export async function matchingReleasesAsync(sources: GameSource[], game: Reference, signal: AbortSignal, failed?: (source: GameSource, error: unknown) => void): Promise<Matches> {
  signal.throwIfAborted();
  const key = JSON.stringify([game.id,game.name,game.steamId,game.igdbId,game.platforms,game.sourceOrigin]);
  const batches: Matches[] = new Array(sources.length);
  // Use resident indexes before cold reads can evict them. Keep only a boolean
  // here, not index buffers that would escape the cache's memory budget.
  const ordered = sources.map((source, position) => ({ source, position, cold: Boolean(source.catalog && !sourceIndex(source.entries)) }));
  ordered.sort((a, b) => Number(a.cold) - Number(b.cold));
  let deadline = performance.now() + 5;
  for (const { source, position } of ordered) {
    signal.throwIfAborted();
    if (!source.enabled) continue;
    try {
      if (source.catalogIssue) throw Error('source_storage');
      const sourceKey = JSON.stringify([source.id, source.url, source.catalog?.profile, source.catalog?.version, key]);
      const warm = cache.get(source.entries, sourceKey);
      if (warm) { batches[position] = warm.map(match=>({...match,source})); continue; }
      let found: Matches = [];
      if (source.catalog) found = await catalogMatches(source, game, signal);
      else if (typeof Worker !== 'undefined') {
        const index = sourceIndex(source.entries) ?? await processSource({ kind: 'index', entries: source.entries }, signal) as SourceIndex;
        signal.throwIfAborted();
        found = matchingReleases([{ ...source, entries: sourceIndexCandidates(index, game).map(row => source.entries[row]) }], game).map(match => ({ ...match, source }));
      } else {
      for (let start=0;start<source.entries.length;start+=256) {
        signal.throwIfAborted();
        found.push(...matchingReleases([{...source,entries:source.entries.slice(start,start+256)}],game));
        if (performance.now() >= deadline) {
          await new Promise<void>(resolve=>setTimeout(resolve,0));
          signal.throwIfAborted(); deadline=performance.now()+5;
        }
      }
      }
      cache.remember(source.entries, sourceKey, found);
      batches[position] = found;
    } catch (error) { if (signal.aborted || !failed) throw error; failed(source, error); }
  }
  signal.throwIfAborted();
  // Execution order must not change stable source/release ordering in the UI.
  return batches.flat().sort((a,b)=>Number(b.match==='identity')-Number(a.match==='identity')||(Date.parse(b.release.date||'')||0)-(Date.parse(a.release.date||'')||0));
}
