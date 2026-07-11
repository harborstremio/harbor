import { get, IMG } from "./tmdb-client";

export type WatchProvider = {
  id: number;
  name: string;
  logo: string;
  link: string;
};

type RawProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
  display_priority?: number;
};

type RegionProviders = {
  link?: string;
  flatrate?: RawProvider[];
  free?: RawProvider[];
  ads?: RawProvider[];
};

export async function tmdbWatchProviders(
  key: string,
  kind: "movie" | "tv",
  id: number | string,
  region: string,
): Promise<WatchProvider[]> {
  if (!key || !id) return [];
  const data = await get<{ results?: Record<string, RegionProviders> }>(key, `${kind}/${id}/watch/providers`).catch(
    () => null,
  );
  const results = data?.results;
  if (!results) return [];
  const r = results[(region || "US").toUpperCase()] ?? results.US;
  if (!r) return [];
  const link = r.link ?? "";
  const raw = [...(r.flatrate ?? []), ...(r.free ?? []), ...(r.ads ?? [])].sort(
    (a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99),
  );
  const seen = new Set<number>();
  const out: WatchProvider[] = [];
  for (const p of raw) {
    if (seen.has(p.provider_id) || !p.logo_path) continue;
    seen.add(p.provider_id);
    out.push({
      id: p.provider_id,
      name: p.provider_name,
      logo: `${IMG}/original${p.logo_path}`,
      link,
    });
    if (out.length >= 8) break;
  }
  return out;
}
