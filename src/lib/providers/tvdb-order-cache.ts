import type { Season } from "@/lib/providers/tmdb";
import type { OrderedEpisode, TvdbOrder } from "./tvdb-order";
import { tvdbOrderPersistedExpiresAt } from "./tvdb-order-cache-policy.ts";

const PREFIX = "harbor.tvdbo.v5.";

type Serialized = {
  t: number;
  seasons: Season[];
  bySeason: [number, OrderedEpisode[]][];
  absByEpId: [number, number][];
  imageByAbs: [number, string][];
};

export type TvdbOrderCacheEntry = {
  order: TvdbOrder;
  cachedAt: number;
};

export function readOrderCacheEntry(
  seriesId: number,
  seasonType: string,
): TvdbOrderCacheEntry | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${seriesId}:${seasonType}`);
    if (!raw) return null;
    const s = JSON.parse(raw) as Serialized;
    if (!s || typeof s.t !== "number") return null;
    const order = {
      seasons: s.seasons,
      bySeason: new Map(s.bySeason),
      absByEpId: new Map(s.absByEpId),
      imageByAbs: new Map(s.imageByAbs),
    };
    if (Date.now() > tvdbOrderPersistedExpiresAt(order, s.t)) return null;
    return { order, cachedAt: s.t };
  } catch {
    return null;
  }
}

export function readOrderCache(seriesId: number, seasonType: string): TvdbOrder | null {
  return readOrderCacheEntry(seriesId, seasonType)?.order ?? null;
}

export function writeOrderCache(
  seriesId: number,
  seasonType: string,
  order: TvdbOrder,
  cachedAt = Date.now(),
): void {
  try {
    const s: Serialized = {
      t: cachedAt,
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
