import type { Meta } from "@/lib/cinemeta";
import { recentlyPlayed, watchTitleKey } from "@/lib/playback-history";
import { tmdbDiscover, tmdbTrending } from "@/lib/providers/tmdb";
import type { Settings } from "@/lib/settings";

import { fetchAwardWinners } from "./award-winners";
import type { ExpandedRow } from "./daily-rows-types";
import { localizeFloor } from "./locale";
import { getDownvotedIds, getUpvotedIds } from "./preferences";
import { rankMetasByAffinity } from "./rank";

const MIN_ROW = 8;

export function normalizedAffinity(map: Record<string, number>, key: string): number {
  let max = 0;
  for (const v of Object.values(map)) {
    const a = Math.abs(v);
    if (a > max) max = a;
  }
  if (max === 0) return 0;
  const w = map[key] ?? 0;
  return Math.max(0, w / max);
}

export function weightedPickWithoutReplacement<T>(
  values: readonly T[],
  weightFn: (value: T) => number,
  rng: () => number,
  n: number,
): T[] {
  const pool = values.map((value) => ({ value, weight: Math.max(0, weightFn(value)) }));
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    let total = 0;
    for (const p of pool) total += p.weight;
    let idx: number;
    if (total <= 0) {
      idx = Math.floor(rng() * pool.length);
    } else {
      let r = rng() * total;
      idx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) {
          idx = i;
          break;
        }
      }
    }
    out.push(pool[idx].value);
    pool.splice(idx, 1);
  }
  return out;
}

export function applyExclusions(metas: Meta[]): Meta[] {
  const voted = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
  const watched = recentlyPlayed();
  return metas.filter((m) => {
    if (!m.poster) return false;
    if (voted.has(m.id)) return false;
    if (watched.ids.has(m.id)) return false;
    if (watched.titles.has(watchTitleKey(m.name))) return false;
    return true;
  });
}

async function runRow(tmdbKey: string, row: ExpandedRow, floor: Record<string, string>, page: number): Promise<Meta[]> {
  if (row.endpoint === "awards") {
    return fetchAwardWinners(tmdbKey, page);
  }
  const params = { ...floor, page: String(page) };
  if (row.endpoint === "trending") {
    return tmdbTrending(tmdbKey, row.mediaType, "week", page);
  }
  return tmdbDiscover(tmdbKey, row.mediaType, params);
}

export async function fetchRowWithFallback(
  tmdbKey: string,
  row: ExpandedRow,
  page: number,
  settings?: Settings,
): Promise<Meta[]> {
  if (!tmdbKey) return [];
  const tmdbPage = (row.pageBase ?? 1) + (page - 1);
  const primaryFloor = settings ? localizeFloor(row.floorPrimary, settings, row.mediaType) : row.floorPrimary;
  const primary = applyExclusions(await runRow(tmdbKey, row, primaryFloor, tmdbPage));
  if (row.endpoint === "awards") return primary;
  if (primary.length >= MIN_ROW || row.endpoint === "trending") {
    return rankMetasByAffinity(primary);
  }
  const relaxed = applyExclusions(await runRow(tmdbKey, row, row.floorRelaxed, tmdbPage));
  const seen = new Set(primary.map((m) => m.id));
  const merged = [...primary];
  for (const m of relaxed) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  return rankMetasByAffinity(merged);
}
