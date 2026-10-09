import { sourceFileIdentity, uniqueSourceFiles } from './source-files';
import type { matchingReleases, GameSource } from './sources';

export type SourceMatch = ReturnType<typeof matchingReleases>[number];
export type SourceMatchPreview = Omit<SourceMatch, 'release'> & {
  release: Omit<SourceMatch['release'], 'files'>;
  deferred: { signature: string; rows: number[] };
};
export type SourceGroupMatch = SourceMatch | SourceMatchPreview;
export type SourceMatchGroup<T extends SourceGroupMatch = SourceGroupMatch> = { source: GameSource; matches: T[] };

export function sourceReleaseGroupKey(release: SourceMatch['release']): string {
  return JSON.stringify([release.title.normalize('NFKC').trim().toLocaleLowerCase('en'), release.platform, release.version, release.kind, release.size,
    release.files.map(file => [sourceFileIdentity(file), file.sizeBytes, file.sha256]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
}

/** Keep publisher provenance and editions distinct; tracker variants are the same payload. */
export function groupSourceMatches(matches: SourceMatch[]): SourceMatchGroup<SourceMatch>[];
export function groupSourceMatches(matches: SourceGroupMatch[]): SourceMatchGroup[];
export function groupSourceMatches(matches: SourceGroupMatch[]): SourceMatchGroup[] {
  const groups = new Map<string, SourceMatchGroup>(), seen = new Map<string, Map<string, number>>();
  for (const match of matches) {
    let group = groups.get(match.source.id), keys = seen.get(match.source.id);
    if (!group) { group = { source: match.source, matches: [] }; keys = new Map(); groups.set(match.source.id, group); seen.set(match.source.id, keys); }
    const key = 'deferred' in match ? `deferred:${match.deferred.signature}` : sourceReleaseGroupKey(match.release);
    const previous = keys!.get(key);
    if (previous === undefined) { keys!.set(key, group.matches.length); group.matches.push('deferred' in match ? { ...match, deferred: { ...match.deferred, rows: [...match.deferred.rows] } } : match); }
    else {
      const kept = group.matches[previous];
      if ('deferred' in kept && 'deferred' in match) for (const row of match.deferred.rows) kept.deferred.rows.push(row);
      else if (!('deferred' in kept) && !('deferred' in match)) group.matches[previous] = { ...kept, release: { ...kept.release, files: uniqueSourceFiles([...kept.release.files, ...match.release.files]) } };
    }
  }
  return [...groups.values()];
}

/** Append arriving publishers without moving an open/focused row. Reuse unchanged
 * groups so adding another publisher does not cancel and restart file hydration. */
export function retainSourceMatchGroups(matches: SourceGroupMatch[], previous: SourceMatchGroup[]): SourceMatchGroup[] {
  const pending = new Map(groupSourceMatches(matches).map(group => [group.source.id, group]));
  const same = (a: SourceGroupMatch, b: SourceGroupMatch) => a.release === b.release && a.match === b.match
    && ('deferred' in a ? 'deferred' in b && a.deferred.signature === b.deferred.signature
      && a.deferred.rows.length === b.deferred.rows.length && a.deferred.rows.every((row, i) => row === b.deferred.rows[i]) : !('deferred' in b));
  const result: SourceMatchGroup[] = [];
  for (const old of previous) {
    const next = pending.get(old.source.id); if (!next) continue;
    pending.delete(old.source.id);
    result.push(old.source === next.source && old.matches.length === next.matches.length && old.matches.every((match, i) => same(match, next.matches[i])) ? old : next);
  }
  return [...result, ...pending.values()];
}
