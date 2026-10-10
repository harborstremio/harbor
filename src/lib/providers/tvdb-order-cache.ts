import type { Season } from "@/lib/providers/tmdb";
import type { OrderedEpisode, TvdbOrder } from "./tvdb-order";
import { isPlaceholderEpisodeText } from "./episode-placeholder";

// v7: invalidates orders cached before unaired-episode handling (date
// reconciliation and rating gating) shipped — stale rows must not pin old
// air dates or numbering for up to three days.
const PREFIX = "harbor.tvdbo.v7.";
const TTL = 3 * 24 * 60 * 60 * 1000;

/**
 * A cached order is stale when it still carries a provider placeholder (e.g.
 * "TBA") for an episode that has already aired — providers publish the real
 * name on or shortly after the air date, so such a cache predates the name and
 * must not pin the placeholder on the page.
 */
export function isStaleTvdbOrder(
  bySeason: Iterable<[number, OrderedEpisode[]]>,
  now = Date.now(),
): boolean {
  for (const [, episodes] of bySeason) {
    for (const ep of episodes) {
      if (!isPlaceholderEpisodeText(ep.name)) continue;
      const aired = ep.airDate ? Date.parse(ep.airDate) : NaN;
      if (Number.isFinite(aired) && aired <= now) return true;
    }
  }
  return false;
}

type Serialized = {
  t: number;
  seasons: Season[];
  bySeason: [number, OrderedEpisode[]][];
  absByEpId: [number, number][];
  imageByAbs: [number, string][];
};

export function readOrderCache(seriesId: number, seasonType: string): TvdbOrder | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${seriesId}:${seasonType}`);
    if (!raw) return null;
    const s = JSON.parse(raw) as Serialized;
    if (!s || typeof s.t !== "number" || Date.now() - s.t > TTL) return null;
    if (isStaleTvdbOrder(s.bySeason)) return null;
    return {
      seasons: s.seasons,
      bySeason: new Map(s.bySeason),
      absByEpId: new Map(s.absByEpId),
      imageByAbs: new Map(s.imageByAbs),
    };
  } catch {
    return null;
  }
}

export function writeOrderCache(seriesId: number, seasonType: string, order: TvdbOrder): void {
  try {
    const s: Serialized = {
      t: Date.now(),
      seasons: order.seasons,
      bySeason: [...order.bySeason],
      absByEpId: [...order.absByEpId],
      imageByAbs: [...order.imageByAbs],
    };
    localStorage.setItem(`${PREFIX}${seriesId}:${seasonType}`, JSON.stringify(s));
  } catch {
    /* quota or serialize error, non-fatal */
  }
}
