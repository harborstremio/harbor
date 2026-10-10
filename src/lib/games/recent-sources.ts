import { RECENT_SOURCE_LIMIT, type RecentSourceRelease } from './source-recent-selection';
import type { GameSource } from './sources';
import { loadRecentSourcePage } from './recent-source-page';
export { recentSourceKey, recentSourceReleases, RECENT_SOURCE_LIMIT, type RecentSourceRelease } from './source-recent-selection';

export async function recentSourceReleasesAsync(sources: readonly GameSource[], signal: AbortSignal, now = Date.now(), failed?: (source: GameSource, error: unknown) => void): Promise<RecentSourceRelease[]> {
  const page = await loadRecentSourcePage(sources, { query: '', sort: 'newest', since: 0, now }, RECENT_SOURCE_LIMIT, signal,
    failed ?? ((_source, error) => { throw error; }));
  signal.throwIfAborted();
  return page.entries;
}
