import { adultContentHidden, isAdultAnime } from "@/lib/addons-store/adult-filter";
import type { Meta } from "@/lib/cinemeta";
import { score, topEntries } from "@/lib/discover/affinity";
import { profileFromMeta } from "@/lib/discover/profile";
import { getStore } from "@/lib/discover/store";
import { hashStr } from "@/lib/feed/daily-rows-types";
import { getDownvotedIds, getUpvotedIds } from "@/lib/feed/preferences";
import { dayIndex, mixSeed, mulberry32 } from "@/lib/feed/tags";
import { recentlyPlayed, watchTitleKey } from "@/lib/playback-history";
import { animeFranchiseKey, stripFranchiseSuffix } from "@/lib/providers/jikan";
import type { LibraryItem } from "@/lib/stremio";

export const ANIME_GENRE_TO_JIKAN: Record<string, number> = {
  Action: 1,
  Adventure: 2,
  Comedy: 4,
  Drama: 8,
  Fantasy: 10,
  Horror: 14,
  Mystery: 7,
  Romance: 22,
  "Sci-Fi": 24,
  "Slice of Life": 36,
  Sports: 30,
  Supernatural: 37,
  Thriller: 41,
  Mecha: 18,
  Music: 19,
  Psychological: 40,
};

export type PickSource = "sequel" | "rec" | "genre" | "new" | "airing" | "top";

const SOURCE_BASE: Record<PickSource, number> = {
  sequel: 100,
  rec: 40,
  genre: 20,
  new: 5,
  airing: 3,
  top: 2,
};

const RING_KEY = "harbor.anime.toppicks.shown.v1";
const RING_TTL_MS = 72 * 60 * 60 * 1000;
const RING_MAX = 12;

type RingEntry = { t: number; keys: string[] };

function readRing(): RingEntry[] {
  try {
    const raw = localStorage.getItem(RING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-RING_MAX) : [];
  } catch {
    return [];
  }
}

export function recordShownPicks(keys: string[]): void {
  if (keys.length === 0) return;
  try {
    const ring = readRing();
    ring.push({ t: Date.now(), keys });
    localStorage.setItem(RING_KEY, JSON.stringify(ring.slice(-RING_MAX)));
  } catch {}
}

export function recentlyShown(): Set<string> {
  const now = Date.now();
  const set = new Set<string>();
  for (const entry of readRing()) {
    if (now - entry.t >= RING_TTL_MS) continue;
    for (const k of entry.keys) set.add(k);
  }
  return set;
}

export function animeSeedGenres(favoriteGenres: number[]): number[] {
  const { affinity } = getStore();
  const seen = new Set<number>();
  const out: number[] = [];
  if (affinity.totalEvents > 0) {
    for (const [name, w] of topEntries(affinity.genres, 8)) {
      if (w <= 0) continue;
      const gid = ANIME_GENRE_TO_JIKAN[name];
      if (gid == null || seen.has(gid)) continue;
      seen.add(gid);
      out.push(gid);
      if (out.length >= 3) break;
    }
  }
  for (const gid of favoriteGenres) {
    if (out.length >= 3) break;
    if (seen.has(gid)) continue;
    seen.add(gid);
    out.push(gid);
  }
  return out;
}

function isFinished(item: LibraryItem): boolean {
  const s = item.state;
  if (!s) return false;
  if (s.flaggedWatched === 1) return true;
  if (s.watched) return true;
  return s.duration > 0 && s.timeOffset / s.duration >= 0.9;
}

export function finishedFranchises(libItems: LibraryItem[]): {
  franchises: Set<string>;
  seeds: LibraryItem[];
} {
  const franchises = new Set<string>();
  const seeds: LibraryItem[] = [];
  for (const item of libItems) {
    if (!item._id.startsWith("kitsu:") && !item._id.startsWith("mal:")) continue;
    if (!isFinished(item)) continue;
    franchises.add(animeFranchiseKey(stripFranchiseSuffix(item.name)));
    seeds.push(item);
  }
  return { franchises, seeds };
}

export function buildExclusion(input: {
  heroMetas: Meta[];
  continueWatching: LibraryItem[];
  libItems: LibraryItem[];
}): { skip: (m: Meta) => boolean } {
  const blockedFranchises = new Set<string>(recentlyShown());
  for (const m of input.heroMetas) blockedFranchises.add(animeFranchiseKey(m.name));
  for (const i of input.continueWatching) blockedFranchises.add(animeFranchiseKey(i.name));
  for (const fk of finishedFranchises(input.libItems).franchises) blockedFranchises.add(fk);
  const watched = recentlyPlayed();
  const voted = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
  const hideAdult = adultContentHidden();
  return {
    skip: (m: Meta) =>
      (hideAdult && isAdultAnime(m)) ||
      blockedFranchises.has(animeFranchiseKey(m.name)) ||
      watched.ids.has(m.id) ||
      watched.titles.has(watchTitleKey(m.name)) ||
      voted.has(m.id),
  };
}

export function pageFor(seedKey: string, seed: number): number {
  return 1 + Math.floor(mulberry32(mixSeed(seed, hashStr(seedKey)))() * 3);
}

function rotationNoise(franchiseKey: string, seed: number): number {
  return mulberry32(mixSeed(seed, hashStr(franchiseKey)))();
}

export function scorePick(m: Meta, source: PickSource, recsIndex = 0, recsLen = 0): number {
  let base = SOURCE_BASE[source];
  if (source === "rec" && recsLen > 0) base += Math.max(0, recsLen - recsIndex) * 0.5;
  if (source === "genre") {
    const { affinity } = getStore();
    const weights = (m.genres ?? []).map((g) => affinity.genres[g] ?? 0);
    const top = weights.length > 0 ? Math.max(0, ...weights) : 0;
    base += Math.min(20, top);
  }
  return base + score(profileFromMeta(m), getStore().affinity);
}

export type PickEntry = { meta: Meta; score: number };

export function rankPicks(byFranchise: Map<string, PickEntry>, seed: number, limit: number): Meta[] {
  return Array.from(byFranchise.entries())
    .sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      return rotationNoise(a[0], seed) - rotationNoise(b[0], seed);
    })
    .slice(0, limit)
    .map((e) => e[1].meta);
}

export { dayIndex };
