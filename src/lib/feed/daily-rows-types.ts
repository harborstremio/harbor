import type { Affinity } from "@/lib/discover/types";
import type { Settings } from "@/lib/settings";
import { mixSeed, mulberry32 } from "./tags";

export type RowEndpoint = "discover" | "trending" | "awards";

export type ExpandedRow = {
  key: string;
  title: string;
  kicker?: string;
  mediaType: "movie" | "tv";
  endpoint: RowEndpoint;
  floorPrimary: Record<string, string>;
  floorRelaxed: Record<string, string>;
  pageBase?: number;
};

export type CatalogEntry = {
  id: string;
  dimension:
    | "genre"
    | "decade"
    | "person"
    | "keyword"
    | "country"
    | "runtime"
    | "network"
    | "anchor";
  eligible: (affinity: Affinity, settings: Settings) => boolean;
  expand: (affinity: Affinity, base: number, settings: Settings) => ExpandedRow[];
};

export const LAMBDA = 0.85;

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(base: number, salt: string): () => number {
  return mulberry32(mixSeed(base, hashStr(salt)));
}

export function relax(floor: Record<string, string>): Record<string, string> {
  const out = { ...floor };
  if (out["vote_count.gte"]) {
    out["vote_count.gte"] = String(Math.max(20, Math.round(Number(out["vote_count.gte"]) * 0.6)));
  }
  if (out["vote_average.gte"]) {
    out["vote_average.gte"] = (Number(out["vote_average.gte"]) - 0.4).toFixed(1);
  }
  return out;
}

export function movieGenre(gid: number, floor: Record<string, string>): Record<string, string> {
  return { with_genres: String(gid), "with_runtime.gte": "70", ...floor };
}
