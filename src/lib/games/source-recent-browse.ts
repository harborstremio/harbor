import { recentSourceKey, type RecentSourceRelease } from './source-recent-selection';
import type { GameSource, SourceRelease, SourceRecentPreview } from './sources';

export type RecentSourceQuery = { query: string; sort: 'newest' | 'oldest'; since: number; now: number };
export const validRecentSourceQuery = (value: RecentSourceQuery) => typeof value.query === 'string' && value.query.length <= 500 && ['newest', 'oldest'].includes(value.sort) && Number.isFinite(value.since) && value.since >= 0 && Number.isFinite(value.now) && value.now >= value.since;
const title = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
const compare = (a: { at: number; key: string }, b: { at: number; key: string }, sort: RecentSourceQuery['sort']) => (sort === 'oldest' ? a.at - b.at : b.at - a.at) || a.key.localeCompare(b.key, 'en');

/** Keep only sorted row numbers for a catalog; artwork and full records remain lazy. */
export function recentSourceRows(entries: readonly SourceRelease[], filters: RecentSourceQuery): Uint32Array {
  const collector = recentSourceRowCollector(filters);
  entries.forEach((entry, row) => collector.add(entry, row));
  return collector.finish();
}

export function recentSourceRowCollector(filters: RecentSourceQuery) {
  if (!validRecentSourceQuery(filters)) throw Error('source_storage');
  const query = title(filters.query.trim()), unique = new Map<string, { row: number; at: number; key: string }>();
  return { add(release: SourceRelease, row: number) {
    const at = Date.parse(release.date ?? '');
    if (release.kind !== 'game' || !release.files.length || !Number.isFinite(at) || at <= 0 || at > filters.now || at < filters.since || !title(release.title).includes(query)) return;
    const key = recentSourceKey(release), existing = unique.get(key);
    if (!existing || at > existing.at) unique.set(key, { row, at, key });
  }, finish: () => Uint32Array.from([...unique.values()].sort((a, b) => compare(a, b, filters.sort)).map(item => item.row)) };
}

export function mergeRecentSourcePages<T extends Omit<SourceRecentPreview, 'row'>>(pages: { source: GameSource; entries: T[]; total: number }[], filters: RecentSourceQuery, limit: number) {
  const unique = new Map<string, Omit<RecentSourceRelease, 'release'> & { release: T }>();
  for (const { source, entries } of pages) for (const release of entries) {
    const key = recentSourceKey(release), addedAt = Date.parse(release.date!);
    if (!unique.has(key) || unique.get(key)!.addedAt < addedAt) unique.set(key, { key, source, release, addedAt });
  }
  const entries = [...unique.values()].sort((a, b) => compare({at:a.addedAt,key:a.key}, {at:b.addedAt,key:b.key}, filters.sort));
  return { entries: entries.slice(0, limit), hasMore: entries.length > limit || pages.some(page => page.total > page.entries.length) };
}
