import { lruSet } from "@/lib/cache";
import { registerEvictable } from "@/lib/maintenance";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

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

export async function harborImdbParental(tt: string): Promise<ParentalCategory[]> {
  if (!tt.startsWith("tt")) return [];
  const cached = parentalCache.get(tt);
  if (cached) return cached;
  const pending = parentalInflight.get(tt);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(`${BASE}/parental/${tt}`);
      const out: ParentalCategory[] = [];
      if (res.ok) {
        const j = (await res.json()) as { categories?: ParentalCategory[] };
        for (const c of j.categories ?? []) {
          if (c && typeof c.category === "string" && typeof c.severity === "string") {
            out.push({ category: c.category, severity: c.severity });
          }
        }
      }
      parentalCache.set(tt, out);
      return out;
    } catch {
      parentalCache.set(tt, []);
      return [];
    } finally {
      parentalInflight.delete(tt);
    }
  })();
  parentalInflight.set(tt, p);
  return p;
}

export function harborImdbParentalCached(tt: string): ParentalCategory[] | undefined {
  return parentalCache.get(tt);
}
