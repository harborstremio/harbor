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

function readCache(): HostedHeroItem[] | null {
  if (mem && Date.now() - mem.t < TTL_MS) return mem.items;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (!c?.items?.length) return null;
    mem = c;
    return c.items;
  } catch {
    return null;
  }
}

export function peekHostedHero(): HostedHeroItem[] | null {
  return readCache();
}

export async function fetchHostedHero(): Promise<HostedHeroItem[] | null> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const res = await safeFetch(HOSTED_URL);
    if (!res.ok) return null;
    const j = (await res.json()) as { updated?: number; items?: RawItem[] };
    const items = (j?.items ?? []).map(toMeta).filter((m): m is HostedHeroItem => m != null);
    if (items.length === 0) return null;
    mem = { t: Date.now(), items };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(mem));
    } catch {
      /* ignore */
    }
    return items;
  } catch {
    return null;
  }
}
