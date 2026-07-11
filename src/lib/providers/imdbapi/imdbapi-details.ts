import { safeFetch } from "@/lib/safe-fetch";

import type { TmdbDetail } from "../tmdb/tmdb-details";

const BASE = "https://api.imdbapi.dev/titles";

interface ImdbTitleResponse {
  id: string;
  type: string;
  primaryTitle: string;
  primaryImage?: { url: string };
  startYear?: number;
  runtimeSeconds?: number;
  genres?: string[];
  rating?: { aggregateRating: number; voteCount: number };
  plot?: string;
  directors?: Array<{
    id: string;
    displayName: string;
    primaryImage?: { url: string };
  }>;
  writers?: Array<{
    id: string;
    displayName: string;
    primaryImage?: { url: string };
  }>;
  stars?: Array<{
    id: string;
    displayName: string;
    primaryImage?: { url: string };
  }>;
}

interface ImdbEpisodeEntry {
  id: string;
  title: string;
  primaryImage?: { url: string };
  season: string;
  episodeNumber: number;
  runtimeSeconds?: number;
  plot?: string;
  rating?: { aggregateRating: number; voteCount: number };
}

interface ImdbCreditsEntry {
  name: {
    id: string;
    displayName: string;
    primaryImage?: { url: string };
  };
  category: string;
  characters?: string[];
}

const cache = new Map<string, TmdbDetail>();

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await safeFetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function formatRuntime(seconds: number | undefined): string | undefined {
  if (!seconds) return undefined;
  const min = Math.round(seconds / 60);
  return `${min} min`;
}

function toTmdbDetail(title: ImdbTitleResponse, cast: TmdbDetail["cast"]): TmdbDetail {
  return {
    kind: title.type === "movie" ? "movie" : "tv",
    id: 0,
    imdbId: title.id,
    title: title.primaryTitle ?? "",
    originalTitle: title.primaryTitle ?? "",
    tagline: "",
    overview: title.plot ?? "",
    poster: title.primaryImage?.url ?? undefined,
    backdrop: undefined,
    logo: undefined,
    year: title.startYear ? String(title.startYear) : undefined,
    rating: title.rating?.aggregateRating ? Number(title.rating.aggregateRating).toFixed(1) : undefined,
    voteCount: title.rating?.voteCount ?? 0,
    runtime: formatRuntime(title.runtimeSeconds),
    status: "Released",
    genres: title.genres ?? [],
    originalLanguage: "",
    spokenLanguages: [],
    productionCountries: [],
    productionCompanies: [],
    networks: [],
    productionCompaniesRich: [],
    productionCountriesRich: [],
    spokenLanguagesRich: [],
    networksRich: [],
    trailerYtId: null,
    trailerCandidates: [],
    extraVideos: [],
    gallery: { backdrops: [], posters: [], logos: [] },
    cast,
    crew: [],
    directors: (title.directors ?? []).map((d) => ({ id: 0, name: d.displayName })),
    writers: (title.writers ?? []).map((w) => ({ id: 0, name: w.displayName })),
    creators: [],
    producers: [],
    composer: [],
    cinematography: [],
    editor: [],
    recommendations: [],
    similar: [],
    collection: null,
    seasons: [],
    numberOfSeasons: 0,
    numberOfEpisodes: 0,
    keywords: [],
  };
}

function creditsToCast(credits: ImdbCreditsEntry[]): TmdbDetail["cast"] {
  return credits
    .filter((c) => c.category === "actor" || c.category === "actress")
    .map((c, i) => ({
      id: 0,
      name: c.name.displayName,
      character: c.characters?.[0] ?? "",
      profilePath: c.name.primaryImage?.url ?? null,
      order: i,
    }));
}

export async function imdbapiDetails(metaId: string, season?: number, episode?: number): Promise<TmdbDetail | null> {
  if (!metaId.startsWith("tt")) return null;

  const cacheKey = season !== undefined && episode !== undefined ? `${metaId}:s${season}e${episode}` : metaId;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const title = await fetchJson<ImdbTitleResponse>(`${BASE}/${metaId}`);
  if (!title) return null;

  let targetId = metaId;

  if (season !== undefined && episode !== undefined && title.type !== "movie") {
    const eps = await fetchJson<{ episodes: ImdbEpisodeEntry[] }>(`${BASE}/${metaId}/episodes`);
    const match = eps?.episodes?.find((e) => Number(e.season) === season && e.episodeNumber === episode);
    if (match) targetId = match.id;
  }

  const creditsResp = await fetchJson<{ credits: ImdbCreditsEntry[] }>(`${BASE}/${targetId}/credits`);
  const cast = creditsResp ? creditsToCast(creditsResp.credits) : [];

  let detail = title;
  if (targetId !== metaId) {
    const epTitle = await fetchJson<ImdbTitleResponse>(`${BASE}/${targetId}`);
    if (epTitle) detail = epTitle;
  }

  const result = toTmdbDetail(detail, cast);
  cache.set(cacheKey, result);
  return result;
}
