import type { Meta } from "@/lib/cinemeta";
import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { readHeroArtCache, writeHeroArtCache } from "./anime-hero-art-cache";

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

const SEED_URL = "/anime-hero-art.json";
const REMOTE_URL = `${HARBOR_API_BASE}/anime-hero-art.json`;
const REFRESH_MS = 24 * 60 * 60 * 1000;
const MIN_KEEP_RATIO = 0.9;

let map: Record<string, StaticHeroArt> | null = null;
let loading: Promise<void> | null = null;
let activeVersion = 0;
let refreshing = false;

function adopt(art: Record<string, StaticHeroArt>, v: number): void {
  map = art;
  activeVersion = v;
  poolCache = null;
}

async function readSeed(): Promise<{ art: Record<string, StaticHeroArt>; v: number } | null> {
  try {
    const res = await fetch(SEED_URL);
    if (!res.ok) return null;
    const j = (await res.json()) as { v?: number; art?: Record<string, StaticHeroArt> };
    if (!j?.art || typeof j.art !== "object") return null;
    return { art: j.art, v: Number(j.v) || 0 };
  } catch {
    return null;
  }
}

async function load(): Promise<void> {
  const cached = await readHeroArtCache().catch(() => null);
  const seed = await readSeed();
  const seedCount = seed ? Object.keys(seed.art).length : 0;

  if (cached && cached.count >= seedCount) {
    adopt(cached.payload.art as Record<string, StaticHeroArt>, cached.v);
  } else if (seed) {
    adopt(seed.art, seed.v);
  } else if (cached) {
    adopt(cached.payload.art as Record<string, StaticHeroArt>, cached.v);
  } else {
    adopt({}, 0);
  }

  const savedAt = cached?.savedAt ?? 0;
  if (Date.now() - savedAt >= REFRESH_MS) void refresh();
}

async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const res = await safeFetch(REMOTE_URL);
    if (!res.ok) return;
    const j = (await res.json()) as { v?: number; art?: Record<string, StaticHeroArt> };
    const art = j?.art;
    if (!art || typeof art !== "object") return;
    const count = Object.keys(art).length;
    const have = map ? Object.keys(map).length : 0;
    if (count === 0 || count < have * MIN_KEEP_RATIO) return;
    const v = Number(j.v) || 0;
    await writeHeroArtCache({ savedAt: Date.now(), v, count, payload: { v, art } });
    if (v !== activeVersion || count !== have) adopt(art, v);
  } catch {
    return;
  } finally {
    refreshing = false;
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
