import { isGenericEpisodeTitle } from "../episode-title.ts";

export const TVDB_ORDER_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const TVDB_ORDER_TRANSIENT_CACHE_TTL_MS = 2 * 60 * 1000;

type EpisodeTitleOrder = {
  bySeason: ReadonlyMap<
    number,
    readonly { episodeNumber: number; name: string | null | undefined }[]
  >;
};

export function tvdbOrderPersistedExpiresAt(
  order: EpisodeTitleOrder,
  cachedAt: number,
): number {
  return cachedAt +
    (hasCompleteEpisodeTitles(order)
      ? TVDB_ORDER_CACHE_TTL_MS
      : TVDB_ORDER_TRANSIENT_CACHE_TTL_MS);
}

export function tvdbOrderMemoryExpiresAt(
  order: EpisodeTitleOrder,
  cachedAt: number,
): number | null {
  return hasCompleteEpisodeTitles(order)
    ? null
    : cachedAt + TVDB_ORDER_TRANSIENT_CACHE_TTL_MS;
}

function hasCompleteEpisodeTitles(order: EpisodeTitleOrder): boolean {
  let episodeCount = 0;
  for (const episodes of order.bySeason.values()) {
    for (const episode of episodes) {
      episodeCount += 1;
      if (isGenericEpisodeTitle(episode.name, episode.episodeNumber)) return false;
    }
  }
  return episodeCount > 0;
}
