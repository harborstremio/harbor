import { freshAffinity, type Affinity, type DiscoverEvent, type ProfileSnapshot } from "./types";

const HALF_LIFE_MS = 90 * 24 * 60 * 60 * 1000;
const KIND_WEIGHT: Record<DiscoverEvent["kind"], number> = {
  open: 1.0,
  play: 3.0,
  dwell: 2.5,
  watchlist: 4.0,
  watched: 6.0,
  vote_up: 5.0,
  vote_down: -3.0,
};

const CATEGORY_WEIGHT = {
  cast: 1.0,
  directors: 1.5,
  creators: 1.5,
  genres: 0.8,
  keywords: 1.2,
  decade: 0.4,
  language: 0.3,
};

export function buildAffinity(events: DiscoverEvent[], now = Date.now()): Affinity {
  const a = freshAffinity();
  for (const e of events) {
    if (!e.meta) continue;
    const recency = Math.exp((-Math.LN2 * Math.max(0, now - e.ts)) / HALF_LIFE_MS);
    const w = (KIND_WEIGHT[e.kind] ?? 1) * recency;
    if (w === 0) continue;
    for (const id of e.meta.cast) bumpNum(a.cast, id, w);
    for (const id of e.meta.directors) bumpNum(a.directors, id, w * 1.2);
    for (const id of e.meta.creators) bumpNum(a.creators, id, w * 1.2);
    for (const g of e.meta.genres) bumpStr(a.genres, g, w);
    for (const k of e.meta.keywords) bumpNum(a.keywords, k, w);
    if (e.meta.decade) bumpStr(a.decades, e.meta.decade, w);
    if (e.meta.language) bumpStr(a.languages, e.meta.language, w);
    a.totalEvents++;
  }
  a.lastUpdated = now;
  return a;
}

export function score(profile: ProfileSnapshot, affinity: Affinity): number {
  const cast = avgWeight(profile.cast, affinity.cast);
  const directors = sumWeight(profile.directors, affinity.directors);
  const creators = sumWeight(profile.creators, affinity.creators);
  const genres = avgWeight(profile.genres, affinity.genres);
  const keywords = avgWeight(profile.keywords, affinity.keywords);
  const decade = profile.decade ? (affinity.decades[profile.decade] ?? 0) : 0;
  const lang = profile.language ? (affinity.languages[profile.language] ?? 0) : 0;
  return (
    CATEGORY_WEIGHT.cast * cast +
    CATEGORY_WEIGHT.directors * directors +
    CATEGORY_WEIGHT.creators * creators +
    CATEGORY_WEIGHT.genres * genres +
    CATEGORY_WEIGHT.keywords * keywords +
    CATEGORY_WEIGHT.decade * decade +
    CATEGORY_WEIGHT.language * lang
  );
}

export function topEntries<K extends string | number>(weights: Record<K, number>, n: number): Array<[K, number]> {
  return (Object.entries(weights) as Array<[K, number]>).sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function affinityIsEmpty(a: Affinity): boolean {
  return a.totalEvents === 0;
}

function avgWeight<K extends string | number>(ids: K[], map: Record<K, number>): number {
  if (ids.length === 0) return 0;
  let s = 0;
  for (const id of ids) s += map[id] ?? 0;
  return s / Math.sqrt(ids.length);
}

function sumWeight<K extends string | number>(ids: K[], map: Record<K, number>): number {
  let s = 0;
  for (const id of ids) s += map[id] ?? 0;
  return s;
}

function bumpNum(map: Record<number, number>, id: number, w: number) {
  if (!Number.isFinite(id)) return;
  map[id] = (map[id] ?? 0) + w;
}

function bumpStr(map: Record<string, number>, k: string, w: number) {
  if (!k) return;
  map[k] = (map[k] ?? 0) + w;
}
