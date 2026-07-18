import type { Episode, Season } from "@/lib/providers/tmdb";
import { tvdbEpisodesByType, tvdbSeasonNames, tvdbSeriesByRemote, type TvdbEpisode } from "./tvdb";
import { readOrderCache, writeOrderCache } from "./tvdb-order-cache";

export type TvdbOrder = {
  seasons: Season[];
  bySeason: Map<number, Episode[]>;
  absByEpId: Map<number, number>;
  imageByAbs: Map<number, string>;
};

export function seasonDateRange(eps: Episode[]): { from?: string; to?: string } {
  let from: string | undefined;
  let to: string | undefined;
  for (const e of eps) {
    if (!e.airDate) continue;
    if (!from || e.airDate < from) from = e.airDate;
    if (!to || e.airDate > to) to = e.airDate;
  }
  return { from, to };
}

const orderCache = new Map<string, TvdbOrder | null>();

export async function fetchTvdbOrder(
  apiKey: string,
  remoteId: string,
  seasonType: string,
  lang?: string,
): Promise<TvdbOrder | null> {
  if (!remoteId) return null;
  const seriesId = await tvdbSeriesByRemote(apiKey, remoteId);
  if (!seriesId) return null;
  return fetchTvdbOrderBySeriesId(apiKey, seriesId, seasonType, lang);
}

export async function fetchTvdbOrderBySeriesId(
  apiKey: string,
  seriesId: number,
  seasonType: string,
  lang?: string,
): Promise<TvdbOrder | null> {
  if (!seriesId) return null;
  const typeKey = lang ? `${seasonType}:${lang}` : seasonType;
  const cacheKey = `${seriesId}:${typeKey}`;
  if (orderCache.has(cacheKey)) return orderCache.get(cacheKey) ?? null;
  const persisted = readOrderCache(seriesId, typeKey);
  if (persisted) {
    orderCache.set(cacheKey, persisted);
    return persisted;
  }
  const result = await build(apiKey, seriesId, seasonType, lang).catch(() => null);
  if (result) {
    orderCache.set(cacheKey, result);
    writeOrderCache(seriesId, typeKey, result);
  }
  return result;
}

async function build(
  apiKey: string,
  seriesId: number,
  seasonType: string,
  lang?: string,
): Promise<TvdbOrder | null> {
  const joinedClean = seasonType === "absolute";
  const rawAbsolute = seasonType === "tvdbabsolute";
  const slug =
    seasonType === "aired" || joinedClean ? "default" : rawAbsolute ? "absolute" : seasonType;
  const nameTypeSlug =
    seasonType === "aired" || joinedClean || rawAbsolute ? "official" : seasonType;
  const [defaultEps, names] = await Promise.all([
    tvdbEpisodesByType(apiKey, seriesId, "default"),
    tvdbSeasonNames(apiKey, seriesId, nameTypeSlug),
  ]);
  const altEps = slug === "default" ? defaultEps : await tvdbEpisodesByType(apiKey, seriesId, slug);
  if (altEps.length === 0) return null;
  const transAlt: TvdbEpisode[] = lang
    ? await tvdbEpisodesByType(apiKey, seriesId, slug, lang).catch(() => [])
    : [];
  const transById = new Map(transAlt.map((e) => [e.id, e] as const));

  const canonical = new Map<number, { season: number; episode: number }>();
  for (const e of defaultEps) {
    if (e.seasonNumber >= 1) canonical.set(e.id, { season: e.seasonNumber, episode: e.number });
  }

  const bySeason = new Map<number, Episode[]>();
  const seenEpisodeId = new Set<number>();
  for (const e of altEps) {
    if (seenEpisodeId.has(e.id)) continue;
    seenEpisodeId.add(e.id);
    const c = canonical.get(e.id) ?? { season: e.seasonNumber, episode: e.number };
    if (joinedClean && c.season < 1) continue;
    const bucketKey = joinedClean || rawAbsolute ? 1 : e.seasonNumber;
    const bucket = bySeason.get(bucketKey) ?? [];
    const tr = transById.get(e.id);
    bucket.push({
      id: e.id,
      seasonNumber: c.season,
      episodeNumber: c.episode,
      name: (tr?.name || e.name) ?? "",
      overview: (tr?.overview || e.overview) ?? "",
      stillPath: e.image ?? null,
      airDate: e.aired ?? null,
      runtime: e.runtime ?? null,
      voteAverage: null,
    });
    bySeason.set(bucketKey, bucket);
  }
  if (bySeason.size === 0) return null;
  if (joinedClean) {
    bySeason
      .get(1)
      ?.sort((x, y) => x.seasonNumber - y.seasonNumber || x.episodeNumber - y.episodeNumber);
  }

  const absByEpId = new Map<number, number>();
  const imageByAbs = new Map<number, string>();
  for (const e of altEps) {
    if (e.absoluteNumber != null) {
      absByEpId.set(e.id, e.absoluteNumber);
      if (e.image) imageByAbs.set(e.absoluteNumber, e.image);
    }
  }

  const seasons: Season[] = [...bySeason.keys()]
    .sort((a, b) => (a <= 0 ? 1 : b <= 0 ? -1 : a - b))
    .map((n) => ({
      id: n,
      seasonNumber: n,
      name:
        joinedClean || rawAbsolute
          ? "All Episodes"
          : names.get(n) || (n === 0 ? "Specials" : `Season ${n}`),
      overview: "",
      posterPath: null,
      episodeCount: bySeason.get(n)!.length,
      airDate: bySeason.get(n)![0]?.airDate ?? null,
    }));
  return { seasons, bySeason, absByEpId, imageByAbs };
}
