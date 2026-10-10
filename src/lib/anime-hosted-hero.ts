import type { Meta } from "@/lib/cinemeta";
import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const HOSTED_URL = `${HARBOR_API_BASE}/api/hero/anime.json`;
const CACHE_KEY = "harbor.anime.hero.hosted.v5";
const TTL_MS = 3 * 60 * 60 * 1000;

export type HostedHeroItem = Meta & { source?: string };

type RawItem = {
  id: string;
  name: string;
  description?: string;
  background?: string;
  logo?: string | null;
  poster?: string | null;
  year?: string | null;
  rating?: string | null;
  country?: string | null;
  format?: string | null;
  source?: string;
};

type Cached = { t: number; items: HostedHeroItem[] };
let mem: Cached | null = null;

function toMeta(r: RawItem): HostedHeroItem | null {
  if (!r.id || !r.name || !r.background) return null;
  return {
    id: r.id,
    type: r.format === "MOVIE" ? "movie" : "series",
    name: r.name,
    description: r.description || undefined,
    background: r.background,
    logo: r.logo || undefined,
    poster: r.poster || undefined,
    releaseInfo: r.year || undefined,
    imdbRating: r.rating || undefined,
    country: r.country || undefined,
    animeFormat: r.format || undefined,
    source: r.source,
  };
}

function readStored(): Cached | null {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (!c?.items?.length || typeof c.t !== "number") return null;
    mem = c;
    return c;
  } catch {
    return null;
  }
}

function readCache(): HostedHeroItem[] | null {
  const c = readStored();
  return c && Date.now() - c.t < TTL_MS ? c.items : null;
}

export function peekHostedHero(): HostedHeroItem[] | null {
  return readStored()?.items ?? null;
}

export async function fetchHostedHero(): Promise<HostedHeroItem[] | null> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const res = await safeFetch(HOSTED_URL);
    if (!res.ok) return peekHostedHero();
    const j = (await res.json()) as { updated?: number; items?: RawItem[] };
    const items = (j?.items ?? []).map(toMeta).filter((m): m is HostedHeroItem => m != null);
    if (items.length === 0) return peekHostedHero();
    mem = { t: Date.now(), items };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(mem));
    } catch {
      /* ignore */
    }
    return items;
  } catch {
    return peekHostedHero();
  }
}
