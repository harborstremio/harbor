import { get } from "./tmdb-client";

export type Video = {
  key: string;
  site: string;
  type: string;
  official: boolean;
  published_at?: string;
};

export const pickTrailers = (videos: Video[]): string[] => {
  const yt = videos.filter((v) => v.site === "YouTube");
  const ranked: Video[] = [
    ...yt.filter((v) => v.type === "Trailer" && v.official),
    ...yt.filter((v) => v.type === "Trailer" && !v.official),
    ...yt.filter((v) => v.type === "Teaser" && v.official),
    ...yt.filter((v) => v.type === "Teaser"),
    ...yt.filter((v) => v.type === "Clip" || v.type === "Featurette"),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of ranked) {
    if (!v.key || seen.has(v.key)) continue;
    seen.add(v.key);
    out.push(v.key);
  }
  return out;
};

export async function tmdbTrailerList(key: string, metaId: string): Promise<string[]> {
  if (!key) return [];
  const match = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!match) return [];
  const [, kind, id] = match;
  const data = await get<{ results?: Video[] }>(key, `${kind}/${id}/videos`);
  return pickTrailers(data?.results ?? []);
}

export async function tmdbTrailer(key: string, metaId: string): Promise<string | null> {
  const list = await tmdbTrailerList(key, metaId);
  return list[0] ?? null;
}
