import { meta as cinemetaMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { get } from "@/lib/providers/tmdb/tmdb-client";
import { back, poster, rating, year, type RawMovie, type RawSeries } from "@/lib/providers/tmdb/tmdb-meta-mappers";

import { traktItemToMeta } from "./to-meta";
import type { TraktItem } from "./types";

async function tmdbHydrate(key: string, kind: "movie" | "show", tmdbId: number): Promise<Partial<Meta> | null> {
  if (kind === "show") {
    const r = await get<RawSeries>(key, `tv/${tmdbId}`);
    if (!r) return null;
    return {
      poster: poster(r.poster_path),
      background: back(r.backdrop_path),
      description: r.overview,
      releaseInfo: year(r.first_air_date),
      imdbRating: rating(r.vote_average),
    };
  }
  const r = await get<RawMovie>(key, `movie/${tmdbId}`);
  if (!r) return null;
  return {
    poster: poster(r.poster_path),
    background: back(r.backdrop_path),
    description: r.overview,
    releaseInfo: year(r.release_date),
    imdbRating: rating(r.vote_average),
  };
}

async function hydrateOne(item: TraktItem, tmdbKey: string): Promise<Meta | null> {
  const skeleton = traktItemToMeta(item);
  if (!skeleton) return null;

  if (tmdbKey && item.ids.tmdb) {
    const enriched = await tmdbHydrate(tmdbKey, item.type, item.ids.tmdb).catch(() => null);
    if (enriched && enriched.poster) {
      return { ...skeleton, ...enriched };
    }
  }

  if (item.ids.imdb) {
    const full = await cinemetaMeta(narrowMediaType(skeleton.type), item.ids.imdb).catch(() => null);
    if (full && full.poster) return full;
  }

  return skeleton;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

export async function hydrateTraktItems(items: TraktItem[], tmdbKey: string): Promise<Meta[]> {
  const results = await mapLimit(items, 20, (it) => hydrateOne(it, tmdbKey));
  return results.filter((m): m is Meta => m !== null && !!m.poster);
}
