import type { Meta } from "@/lib/cinemeta";
import { isWatchedFlagged } from "@/lib/watched-flag";
import { anilistCountriesByMalIds } from "@/lib/anilist/browse";

function malIdOf(m: Meta): number {
  if (m.malId != null) return m.malId;
  if (m.id.startsWith("mal:")) return Number(m.id.slice(4));
  return NaN;
}

export async function enrichAnimeCountry(metas: Meta[]): Promise<Meta[]> {
  const malNeed = metas
    .filter((m) => !m.country)
    .map(malIdOf)
    .filter((n) => Number.isFinite(n));
  if (malNeed.length === 0) return metas;
  const empty = new Map<number, string>();
  const countryMap = await Promise.race([
    anilistCountriesByMalIds(malNeed).catch(() => empty),
    new Promise<Map<number, string>>((r) => setTimeout(() => r(empty), 4000)),
  ]);
  if (countryMap.size === 0) return metas;
  return metas.map((m) => {
    if (m.country) return m;
    const c = countryMap.get(malIdOf(m));
    return c ? { ...m, country: c } : m;
  });
}

export type AnimeFilterOpts = {
  excludeOrigins: string[];
  hideWatched: boolean;
  isWatched?: (id: string) => boolean;
};

export function animeOriginExcluded(meta: Meta, excludeOrigins: string[]): boolean {
  return excludeOrigins.length > 0 && !!meta.country && excludeOrigins.includes(meta.country);
}

export function animeFiltered(meta: Meta, opts: AnimeFilterOpts): boolean {
  if (animeOriginExcluded(meta, opts.excludeOrigins)) return true;
  if (opts.hideWatched && (isWatchedFlagged(meta.id) || opts.isWatched?.(meta.id) === true)) {
    return true;
  }
  return false;
}

export const ORIGIN_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "CN", label: "Chinese (Donghua)" },
  { code: "KR", label: "Korean (Aeni)" },
  { code: "TW", label: "Taiwanese" },
];
