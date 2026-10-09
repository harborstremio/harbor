import { catalogMatchRows, storedCatalog } from './source-catalog-query';
import { sourceIndex } from './source-index';
import { sourceMatchCache as cache } from './source-match-cache';
import { readCatalogVersions } from './source-store-db';
import { matchingReleasesAsync } from './source-matches';
import { processSource } from './source-processing';
import type { StoredMatchPreview } from './source-match-preview';
import type { SourceGroupMatch, SourceMatch, SourceMatchGroup } from './source-groups';
import type { matchingReleases, GameSource, SourceRelease } from './sources';

export type SourceMatchProgress = { source: GameSource; matches: SourceGroupMatch[]; checked: number; total: number };
const matchOrder = (a: SourceGroupMatch, b: SourceGroupMatch) => Number(b.match === 'identity') - Number(a.match === 'identity')
  || (Date.parse(b.release.date || '') || 0) - (Date.parse(a.release.date || '') || 0);

/** Available releases keeps file mirrors in storage until a publisher is opened. */
export async function matchingReleasePreviewsAsync(sources: GameSource[], game: Parameters<typeof matchingReleases>[1], signal: AbortSignal,
  failed?: (source: GameSource, error: unknown) => void, progress?: (value: SourceMatchProgress) => void): Promise<SourceGroupMatch[]> {
  signal.throwIfAborted();
  const batches: SourceGroupMatch[][] = new Array(sources.length);
  const key = JSON.stringify([game.id, game.name, game.steamId, game.igdbId, game.platforms, game.sourceOrigin]);
  const versions = new Map<string, ReturnType<typeof readCatalogVersions>>();
  const ordered = sources.map((source, position) => ({ source, position, cold: Boolean(source.catalog && !sourceIndex(source.entries)),
    origin: source.id === game.sourceOrigin?.sourceId && source.url === game.sourceOrigin.sourceUrl })).filter(item => item.source.enabled);
  ordered.sort((a, b) => Number(b.origin) - Number(a.origin) || Number(a.cold) - Number(b.cold));
  let checked = 0;
  for (const { source, position } of ordered) {
    signal.throwIfAborted();
    if (!source.enabled) continue;
    const ref = source.catalog;
    const sourceKey = JSON.stringify(['previews', source.id, source.url, ref?.profile, ref?.version, ref?.parts, ref?.storedEnds, ref?.layout, key]);
    try {
      if (source.catalogIssue) throw Error('source_storage');
      if (!ref) batches[position] = await matchingReleasesAsync([source], game, signal);
      else {
        const warm = cache.getPreviews(source.entries, sourceKey);
        if (warm) {
          let current = versions.get(ref.profile);
          if (!current) { current = readCatalogVersions(ref.profile); versions.set(ref.profile, current); }
          const catalogs = await current;
          signal.throwIfAborted();
          if (!catalogs.some(item => item.source.id === source.id && item.source.url === source.url && item.version === ref.version && item.parts === ref.parts)) throw Error('source_changed');
          batches[position] = warm.map(item => ({ ...item, source }));
        } else {
          const rows = await catalogMatchRows(source, game, signal);
          const previews = await processSource({ kind: 'matchPreviews', profile: ref.profile, catalog: storedCatalog(source), rows, ends: ref.storedEnds, game }, signal) as StoredMatchPreview[];
          signal.throwIfAborted();
          cache.rememberPreviews(source.entries, sourceKey, previews);
          batches[position] = previews.map(item => ({ ...item, source }));
        }
      }
    } catch (error) { cache.forget(source.entries, sourceKey); if (signal.aborted || !failed) throw error; failed(source, error); }
    signal.throwIfAborted();
    // Publish the final order within this publisher, including which duplicate
    // supplies metadata, so opening it early cannot choose an older variant.
    batches[position]?.sort(matchOrder);
    progress?.({ source, matches: batches[position] ?? [], checked: ++checked, total: ordered.length });
  }
  signal.throwIfAborted();
  return batches.flat().sort(matchOrder);
}

export async function loadSourceGroupMatches(group: SourceMatchGroup, limit: number, signal: AbortSignal): Promise<SourceMatch[]> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(limit) || limit < 0) throw Error('source_storage');
  const selected = group.matches.slice(0, limit), previews = selected.filter(item => 'deferred' in item);
  if (!previews.length) return selected as SourceMatch[];
  const source = group.source, ref = source.catalog;
  if (!ref || source.catalogIssue || previews.some(item => item.source !== source)) throw Error('source_storage');
  const releases = await processSource({ kind: 'matchFiles', profile: ref.profile, catalog: storedCatalog(source),
    previews: previews.map(({ release, match, deferred }) => ({ release, match, deferred })), ends: ref.storedEnds }, signal) as SourceRelease[];
  signal.throwIfAborted();
  if (releases.length !== previews.length) throw Error('source_storage');
  let index = 0;
  return selected.map(item => 'deferred' in item ? { source, release: releases[index++], match: item.match } : item);
}
