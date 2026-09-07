import { lruSet } from "@/lib/cache";
import { registerEvictable } from "@/lib/maintenance";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { safeFetch } from "@/lib/safe-fetch";
import { fetchCsmAdvisory } from "@/lib/providers/csm";

const BASE = `${HARBOR_API_BASE}/api/imdb`;

export type ParentalCategory = { category: string; severity: string };

const titleCache = new Map<string, number | null>();
const parentalCache = new Map<string, ParentalCategory[]>();
const parentalInflight = new Map<string, Promise<ParentalCategory[]>>();
const episodeCache = new Map<string, Map<string, number>>();
const episodeInflight = new Map<string, Promise<Map<string, number>>>();

registerEvictable("harbor-imdb-episodes", (aggressive) => {
  if (aggressive) episodeCache.clear();
});

registerEvictable("harbor-imdb-parental", (aggressive) => {
  if (aggressive) parentalCache.clear();
});

export async function harborImdbEpisodes(seriesTt: string): Promise<Map<string, number>> {
  if (!seriesTt.startsWith("tt")) return new Map();
  const cached = episodeCache.get(seriesTt);
  if (cached) return cached;
  const pending = episodeInflight.get(seriesTt);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(`${BASE}/episodes/${seriesTt}`);
      const map = new Map<string, number>();
      if (res.ok) {
        const j = (await res.json()) as { ratings?: Record<string, number> };
        for (const [k, raw] of Object.entries(j.ratings ?? {})) {
          const v = Number(raw);
          if (Number.isFinite(v) && v > 0) map.set(k, v);
        }
      }
      lruSet(episodeCache, seriesTt, map, 200);
      return map;
    } catch {
      const empty = new Map<string, number>();
      lruSet(episodeCache, seriesTt, empty, 200);
      return empty;
    } finally {
      episodeInflight.delete(seriesTt);
    }
  })();
  episodeInflight.set(seriesTt, p);
  return p;
}

export function harborImdbEpisodesCached(seriesTt: string): Map<string, number> | undefined {
  return episodeCache.get(seriesTt);
}

export async function harborImdbTitle(tt: string): Promise<number | null> {
  if (!tt.startsWith("tt")) return null;
  if (titleCache.has(tt)) return titleCache.get(tt) ?? null;
  try {
    const res = await fetch(`${BASE}/title/${tt}`);
    if (!res.ok) {
      titleCache.set(tt, null);
      return null;
    }
    const j = (await res.json()) as { rating?: number | null };
    const v = Number(j.rating);
    const out = Number.isFinite(v) && v > 0 ? v : null;
    titleCache.set(tt, out);
    return out;
  } catch {
    return null;
  }
}

export function harborImdbTitleCached(tt: string): number | null | undefined {
  return titleCache.get(tt);
}

async function resolveTitleForParental(
  tt: string,
): Promise<{ name: string; year?: string | number; isMovie: boolean } | null> {
  for (const type of ["series", "movie"] as const) {
    try {
      const res = await safeFetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`);
      if (res.ok) {
        const j = (await res.json()) as {
          meta?: { name?: string; type?: string; releaseInfo?: string; releaseDate?: string };
        };
        if (j.meta?.name) {
          return {
            name: j.meta.name,
            year: j.meta.releaseInfo ?? j.meta.releaseDate,
            isMovie: type === "movie",
          };
        }
      }
    } catch {}
  }
  return null;
}

const mpaRatingCache = new Map<string, string | null>();

export function harborImdbMpaRating(rawTt: string): string | null {
  const match = rawTt.match(/tt\d+/);
  const tt = match ? match[0] : rawTt;
  return mpaRatingCache.get(tt) ?? null;
}

export async function harborImdbParental(rawTt: string): Promise<ParentalCategory[]> {
  const match = rawTt.match(/tt\d+/);
  const tt = match ? match[0] : rawTt;
  if (!tt.startsWith("tt")) return [];
  const cached = parentalCache.get(tt);
  if (cached) return cached;
  const pending = parentalInflight.get(tt);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await safeFetch(`${BASE}/parental/${tt}`, {
        signal: AbortSignal.timeout(3000),
      });
      const out: ParentalCategory[] = [];
      if (res.ok) {
        const j = (await res.json()) as { categories?: ParentalCategory[]; mpaRating?: string };
        if (j.mpaRating) mpaRatingCache.set(tt, j.mpaRating);
        for (const c of j.categories ?? []) {
          if (c && typeof c.category === "string" && typeof c.severity === "string") {
            out.push({ category: c.category, severity: c.severity });
          }
        }
      }
      if (out.length > 0) {
        lruSet(parentalCache, tt, out, 200);
        return out;
      }
    } catch {
      // Backend unavailable; fall back to Common Sense Media.
    }

    try {
      const titleInfo = await resolveTitleForParental(tt);
      if (titleInfo?.name) {
        const csm = await fetchCsmAdvisory(titleInfo.name, titleInfo.year, titleInfo.isMovie);
        if (csm) {
          if (csm.badgeRating) mpaRatingCache.set(tt, csm.badgeRating);
          if (csm.categories.length > 0) {
            const out = csm.categories.filter((c) => c.severity !== "None");
            if (out.length > 0) {
              lruSet(parentalCache, tt, out, 200);
              return out;
            }
          }
        }
      }
    } catch {
      // Fallback failed.
    }

    lruSet(parentalCache, tt, [], 200);
    return [];
  })().finally(() => {
    parentalInflight.delete(tt);
  });
  parentalInflight.set(tt, p);
  return p;
}

export function harborImdbParentalCached(tt: string): ParentalCategory[] | undefined {
  return parentalCache.get(tt);
}
