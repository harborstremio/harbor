import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import { registerEvictable } from "@/lib/maintenance";
import { safeFetch as fetch } from "@/lib/safe-fetch";

import type { CastEntry, TmdbDetail } from "./tmdb/tmdb-details";
import type { PersonRef } from "./tmdb/tmdb-people";

const CINEMETA = "https://v3-cinemeta.strem.io";

type CinemetaMeta = {
  id?: string;
  imdb_id?: string;
  moviedb_id?: number;
  name?: string;
  type?: string;
  cast?: string[];
  director?: string[];
  writer?: string[];
  country?: string;
  description?: string;
  releaseInfo?: string | number;
  year?: number;
  released?: string;
  runtime?: string;
  imdbRating?: string;
  logo?: string;
  poster?: string;
  background?: string;
  genre?: string[];
  genres?: string[];
  trailerStreams?: Array<{ ytId?: string; title?: string }>;
  trailers?: Array<{ source?: string; type?: string }>;
  videos?: Array<{ id?: string; season?: number; episode?: number; released?: string; title?: string }>;
};

function extractImdbId(id: string): string | null {
  if (id.startsWith("tt")) return id;
  return null;
}

function synthId(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i);
  return -(Math.abs(h) || 1);
}

function people(arr: string[] | undefined): PersonRef[] {
  const seen = new Set<string>();
  const out: PersonRef[] = [];
  for (const name of arr ?? []) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ id: synthId(name), name });
  }
  return out;
}

function toDetail(m: CinemetaMeta, kind: "movie" | "tv", related: Meta[]): TmdbDetail {
  const cast: CastEntry[] = (m.cast ?? []).map((name, i) => ({
    id: synthId(name),
    name,
    character: "",
    profilePath: null,
    order: i,
  }));
  const directors = people(m.director);
  const writers = people(m.writer);
  const genres = m.genre ?? m.genres ?? [];
  const trailerCandidates = (m.trailerStreams ?? [])
    .map((t) => t.ytId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const trailerYtId = trailerCandidates[0] ?? null;
  const year =
    m.year != null
      ? String(m.year)
      : typeof m.releaseInfo === "string"
        ? m.releaseInfo.slice(0, 4)
        : typeof m.releaseInfo === "number"
          ? String(m.releaseInfo)
          : m.released
            ? m.released.slice(0, 4)
            : undefined;

  return {
    kind,
    id: m.moviedb_id ?? 0,
    imdbId: m.imdb_id ?? (m.id?.startsWith("tt") ? m.id : null),
    title: m.name ?? "",
    originalTitle: m.name ?? "",
    tagline: "",
    overview: m.description ?? "",
    poster: m.poster,
    backdrop: m.background,
    logo: m.logo,
    year,
    rating: m.imdbRating,
    voteCount: 0,
    runtime: m.runtime,
    status: "",
    genres,
    originalLanguage: "",
    spokenLanguages: [],
    productionCountries: m.country
      ? m.country
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    productionCompanies: [],
    networks: [],
    productionCompaniesRich: [],
    productionCountriesRich: [],
    spokenLanguagesRich: [],
    networksRich: [],
    trailerYtId,
    trailerCandidates,
    extraVideos: [],
    gallery: { backdrops: [], posters: [], logos: [] },
    cast,
    crew: [],
    directors,
    writers,
    creators: [],
    producers: [],
    composer: [],
    cinematography: [],
    editor: [],
    recommendations: [],
    similar: related,
    seasons: [],
    numberOfSeasons: 0,
    numberOfEpisodes: 0,
    keywords: [],
    firstAirDate: m.released?.slice(0, 10),
    lastAirDate: undefined,
    releaseDate: m.released?.slice(0, 10),
    lastEpisodeAir: undefined,
    budget: undefined,
    revenue: undefined,
    homepage: undefined,
  };
}

const detailCache = new Map<string, { v: TmdbDetail | null; t: number }>();
const TTL = 30 * 60 * 1000;

registerEvictable("cinemeta-details", (aggressive) => {
  if (aggressive) return detailCache.clear();
  const now = Date.now();
  for (const [k, e] of detailCache) if (now - e.t > TTL) detailCache.delete(k);
});

export async function cinemetaDetails(meta: Meta): Promise<TmdbDetail | null> {
  const imdbId = extractImdbId(meta.id);
  if (!imdbId) return null;
  const cacheKey = `${meta.type}:${imdbId}`;
  const hit = detailCache.get(cacheKey);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const kind: "movie" | "tv" = meta.type === "series" ? "tv" : "movie";
  const typePath = kind === "tv" ? "series" : "movie";
  try {
    const res = await fetch(`${CINEMETA}/meta/${typePath}/${imdbId}.json`);
    if (!res.ok) {
      detailCache.set(cacheKey, { v: null, t: Date.now() });
      return null;
    }
    const json = (await res.json()) as { meta?: CinemetaMeta };
    const m = json.meta;
    if (!m) {
      detailCache.set(cacheKey, { v: null, t: Date.now() });
      return null;
    }
    const primaryGenre = (m.genre ?? m.genres ?? [])[0];
    const relatedFetcher = kind === "movie" ? topMovies : topSeries;
    const related = primaryGenre ? await relatedFetcher(primaryGenre).catch(() => [] as Meta[]) : [];
    const filtered = related.filter((r) => r.id !== imdbId).slice(0, 30);
    const out = toDetail(m, kind, filtered);
    detailCache.set(cacheKey, { v: out, t: Date.now() });
    return out;
  } catch {
    detailCache.set(cacheKey, { v: null, t: Date.now() });
    return null;
  }
}
