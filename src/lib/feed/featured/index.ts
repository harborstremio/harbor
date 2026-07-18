import { topMovies, type Meta } from "@/lib/cinemeta";
import type { Settings } from "@/lib/settings";
import { getStore } from "@/lib/discover/store";
import { buildExclusionSets, isExcluded, warmCandidateIds } from "../exclude";
import { getVoteEntries } from "../preferences";
import { diversify } from "./diversify";
import { mergeAndDedup } from "./normalize";
import { passesFloor, scoreFeatured } from "./score";
import { buildLanes, fastLanes, type Seed } from "./sources";
import type { FeaturedItem } from "./types";

export type FeaturedResult = { featured: Meta[]; reserve: Meta[]; pool: FeaturedItem[] };

const dayIndex = () => Math.floor(Date.now() / 86_400_000);

function topSeeds(): Seed[] {
  return getVoteEntries()
    .filter((e) => e.vote === "up")
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 3)
    .map((e) => ({ id: e.altId ?? e.id, name: e.name, ts: e.ts }));
}

function rank(pool: FeaturedItem[], now: number, di: number): FeaturedItem[] {
  const sets = buildExclusionSets();
  const { affinity } = getStore();
  return pool
    .filter(
      (it) =>
        it.meta.background && passesFloor(it.meta, it.source) && !isExcluded(it.meta, sets, now),
    )
    .map((it) => ({ it, s: scoreFeatured(it, affinity, now, di) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
}

function split(items: FeaturedItem[]): FeaturedResult {
  return {
    featured: items.slice(0, 10).map((it) => it.meta),
    reserve: items.slice(10).map((it) => it.meta),
    pool: items,
  };
}

export async function buildFeaturedFast(key: string, settings: Settings): Promise<FeaturedResult> {
  if (!key) return buildFeatured(key, settings);
  const raw = await fastLanes(key, settings.region || "US");
  return split(diversify(rank(mergeAndDedup(raw), Date.now(), dayIndex()), 30));
}

export async function buildFeatured(key: string, settings: Settings): Promise<FeaturedResult> {
  const now = Date.now();
  if (!key) {
    const metas = (await topMovies().catch(() => [] as Meta[])).filter((m) => m.background);
    const items: FeaturedItem[] = metas.map((meta, i) => ({ meta, source: "tmdb", sourceRank: i }));
    return split(diversify(rank(items, now, dayIndex()), 30));
  }
  const raw = await buildLanes(key, settings, topSeeds());
  await warmCandidateIds(
    key,
    raw.map((r) => r.meta),
  );
  const merged = mergeAndDedup(raw);
  return split(diversify(rank(merged, now, dayIndex()), 30));
}

export function rescoreFeatured(pool: FeaturedItem[]): FeaturedResult {
  return split(diversify(rank(pool, Date.now(), dayIndex()), 30));
}
