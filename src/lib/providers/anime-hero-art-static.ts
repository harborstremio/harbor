import type { Meta } from "@/lib/cinemeta";
import { safeFetch } from "@/lib/safe-fetch";

export type StaticHeroArt = {
  bg?: string;
  logo?: string;
  name?: string;
  desc?: string;
  year?: string;
  genres?: string[];
  country?: string;
  format?: string;
};

const URL = "https://harbor.site/anime-hero-art.json";

let map: Record<string, StaticHeroArt> | null = null;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    const res = await safeFetch(URL);
    const j = res.ok ? ((await res.json()) as { art?: Record<string, StaticHeroArt> }) : null;
    map = j?.art ?? {};
  } catch {
    map = {};
  }
}

export function ensureStaticHeroArt(): Promise<void> {
  if (map) return Promise.resolve();
  if (!loading) loading = load();
  return loading;
}

export function peekStaticHeroArt(id: string): StaticHeroArt | undefined {
  return map?.[id];
}

export async function staticHeroArt(id: string): Promise<StaticHeroArt | undefined> {
  await ensureStaticHeroArt();
  return map?.[id];
}

const SCHEME_RANK = (k: string) =>
  k.startsWith("kitsu:") ? 0 : k.startsWith("mal:") ? 1 : k.startsWith("anilist:") ? 2 : 3;

let poolCache: Meta[] | null = null;

export function staticHeroPool(): Meta[] {
  if (poolCache) return poolCache;
  if (!map) return [];
  const byBg = new Map<string, { keys: string[]; art: StaticHeroArt }>();
  for (const [key, art] of Object.entries(map)) {
    if (!art.bg || art.bg.includes("anilist.co") || (!art.logo && !art.name)) continue;
    const g = byBg.get(art.bg) ?? { keys: [], art };
    g.keys.push(key);
    byBg.set(art.bg, g);
  }
  const out: Meta[] = [];
  for (const { keys, art } of byBg.values()) {
    const id = keys.sort((a, b) => SCHEME_RANK(a) - SCHEME_RANK(b))[0];
    out.push({
      id,
      type: art.format === "MOVIE" ? "movie" : "series",
      name: art.name ?? "",
      background: art.bg,
      logo: art.logo,
      poster: art.bg,
      description: art.desc,
      releaseInfo: art.year,
      genres: art.genres,
      country: art.country,
      animeFormat: art.format,
    });
  }
  poolCache = out;
  return out;
}
