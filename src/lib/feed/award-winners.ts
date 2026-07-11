import type { AwardCategory } from "@/lib/awards-catalog";
import { readAwardHistory } from "@/lib/awards-history";
import type { Meta } from "@/lib/cinemeta";
import { tmdbSearchMovie } from "@/lib/providers/tmdb";
import type { AwardType } from "@/lib/providers/wikidata";

const CACHE_KEY = "harbor.discover.awards.v1";
const MAX_TITLES = 150;
const PER_PAGE = 24;
const BATCH = 12;

const SOURCES: Array<[AwardType, AwardCategory]> = [
  ["oscar", { key: "best_picture", name: "Best Picture" }],
  ["oscar", { key: "best_director", name: "Best Director" }],
  ["oscar", { key: "best_international_feature", name: "Best International Feature" }],
  ["oscar", { key: "best_animated_feature", name: "Best Animated Feature" }],
  ["bafta", { key: "best_film", name: "Best Film" }],
  ["bafta", { key: "best_director", name: "Best Director" }],
  ["cannes", { key: "palme_dor", name: "Palme d'Or" }],
  ["golden_globe", { key: "best_picture_drama", name: "Best Drama" }],
  ["golden_globe", { key: "best_picture_musical_comedy", name: "Best Musical or Comedy" }],
  ["critics_choice", { key: "best_picture", name: "Best Picture" }],
  ["venice", { key: "golden_lion", name: "Golden Lion" }],
];

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function winnerTitles(): Array<{ title: string; year: number }> {
  const byKey = new Map<string, { title: string; year: number }>();
  for (const [award, cat] of SOURCES) {
    for (const group of readAwardHistory(award, [cat])) {
      for (const e of group.entries) {
        const k = normTitle(e.workTitle);
        if (!k) continue;
        const prev = byKey.get(k);
        if (!prev || e.year > prev.year) byKey.set(k, { title: e.workTitle, year: e.year });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.year - a.year).slice(0, MAX_TITLES);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

function readCache(): Meta[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as Meta[]) : null;
  } catch {
    return null;
  }
}

let memo: Meta[] | null = null;
let inflight: Promise<Meta[]> | null = null;

async function resolveAll(tmdbKey: string): Promise<Meta[]> {
  if (memo) return memo;
  const cached = readCache();
  if (cached) {
    memo = cached;
    return cached;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const titles = winnerTitles();
    const hits = await mapLimit(titles, BATCH, (t) => tmdbSearchMovie(tmdbKey, t.title, t.year));
    const seen = new Set<string>();
    const metas: Meta[] = [];
    for (const m of hits) {
      if (!m || !m.poster || seen.has(m.id)) continue;
      seen.add(m.id);
      metas.push(m);
    }
    memo = metas;
    if (metas.length >= 20) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(metas));
      } catch {}
    }
    return metas;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function fetchAwardWinners(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  const all = await resolveAll(tmdbKey);
  const start = (page - 1) * PER_PAGE;
  return all.slice(start, start + PER_PAGE);
}
