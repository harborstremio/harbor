import { safeFetch } from "@/lib/safe-fetch";

import { kitsuToTvdb } from "./anime-mapping";

const PROXY = "https://harbor.site/api/tvdb/images";

export type TvdbImageMap = Record<string, string>;

export async function fetchTvdbProxyImages(opts: {
  imdb?: string | null;
  kitsuId?: number | null;
  type?: string;
}): Promise<TvdbImageMap> {
  let series: number | null = null;
  if (opts.kitsuId != null) series = await kitsuToTvdb(opts.kitsuId).catch(() => null);
  const q = new URLSearchParams();
  if (series) q.set("series", String(series));
  else if (opts.imdb && opts.imdb.startsWith("tt")) q.set("imdb", opts.imdb);
  else return {};
  q.set("type", opts.type && opts.type !== "aired" ? opts.type : "default");
  try {
    const res = await safeFetch(`${PROXY}?${q.toString()}`);
    if (!res.ok) return {};
    const j = (await res.json()) as { images?: TvdbImageMap };
    return j?.images ?? {};
  } catch {
    return {};
  }
}

export function pickTvdbImage(
  map: TvdbImageMap,
  ep: {
    seasonNumber?: number;
    number: number;
    absoluteNumber?: number;
    imdbSeason?: number;
    imdbEpisode?: number;
  },
): string | null {
  const abs = ep.absoluteNumber ?? ep.number;
  return (
    map[`abs${abs}`] ??
    (ep.imdbSeason != null && ep.imdbEpisode != null ? map[`s${ep.imdbSeason}e${ep.imdbEpisode}`] : undefined) ??
    (ep.seasonNumber != null ? map[`s${ep.seasonNumber}e${ep.number}`] : undefined) ??
    null
  );
}
