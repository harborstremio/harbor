import type { Episode, Season } from "@/lib/providers/tmdb";

import type { TvdbOrder } from "./tvdb-order";

const PREFIX = "harbor.tvdbo.v2.";
const TTL = 3 * 24 * 60 * 60 * 1000;

type Serialized = {
  t: number;
  seasons: Season[];
  bySeason: [number, Episode[]][];
  absByEpId: [number, number][];
  imageByAbs: [number, string][];
};

export function readOrderCache(seriesId: number, seasonType: string): TvdbOrder | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${seriesId}:${seasonType}`);
    if (!raw) return null;
    const s = JSON.parse(raw) as Serialized;
    if (!s || typeof s.t !== "number" || Date.now() - s.t > TTL) return null;
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
