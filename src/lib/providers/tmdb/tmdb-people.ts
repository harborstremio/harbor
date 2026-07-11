import { lruSet } from "../../cache";
import type { Meta } from "../../cinemeta";
import { effectiveTmdbLanguage, get, IMG } from "./tmdb-client";

const PERSON_NAME_CACHE_MAX = 3000;
const PERSON_CACHE_MAX = 10;

const PERSON_NAME_KEY = "harbor.tmdb.personName.v1";
const personNameCache = new Map<string, number | null>();
const personNameInflight = new Map<string, Promise<number | null>>();
let personNameLoaded = false;
let personNameSaveTimer: number | null = null;

function loadPersonNameCache() {
  if (personNameLoaded) return;
  personNameLoaded = true;
  try {
    const raw = localStorage.getItem(PERSON_NAME_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, number | null>;
      for (const [k, v] of Object.entries(obj)) personNameCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

function persistPersonNameSoon() {
  if (personNameSaveTimer) clearTimeout(personNameSaveTimer);
  personNameSaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(PERSON_NAME_KEY, JSON.stringify(Object.fromEntries(personNameCache)));
    } catch {
      /* ignore */
    }
  }, 5000);
}

function personKey(name: string): string {
  return name.trim().toLowerCase();
}

export function tmdbPersonIdCached(name: string): number | null | undefined {
  loadPersonNameCache();
  const k = personKey(name);
  return personNameCache.has(k) ? (personNameCache.get(k) ?? null) : undefined;
}

export async function tmdbPersonIdByName(key: string, name: string, preferDept?: string): Promise<number | null> {
  if (!key || !name) return null;
  loadPersonNameCache();
  const k = preferDept ? `${personKey(name)}|${preferDept.toLowerCase()}` : personKey(name);
  if (personNameCache.has(k)) return personNameCache.get(k) ?? null;
  if (personNameInflight.has(k)) return personNameInflight.get(k)!;
  const p = (async () => {
    const data = await get<{
      results?: Array<{
        id: number;
        popularity?: number;
        known_for_department?: string;
      }>;
    }>(key, "search/person", { query: name, include_adult: "false" });
    const all = data?.results ?? [];
    const ranked = [...all].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    let chosen = ranked[0];
    if (preferDept) {
      const wantedDept = preferDept.toLowerCase();
      const match = ranked.find((r) => (r.known_for_department ?? "").toLowerCase() === wantedDept);
      if (match) chosen = match;
    }
    const id = chosen?.id ?? null;
    lruSet(personNameCache, k, id, PERSON_NAME_CACHE_MAX);
    persistPersonNameSoon();
    return id;
  })().finally(() => personNameInflight.delete(k));
  personNameInflight.set(k, p);
  return p;
}

export type PersonRef = {
  id: number;
  name: string;
};

export type PersonCredit = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string;
  background?: string;
  releaseInfo?: string;
  releaseDate?: string;
  imdbRating?: string;
  description?: string;
  character?: string;
  job?: string;
  department?: string;
  popularity: number;
  voteCount: number;
  voteAverage: number;
  episodeCount?: number;
  order?: number;
  genreIds?: number[];
};

export type PersonDetail = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownForDepartment: string;
  profilePath: string | null;
  imdbId: string | null;
  homepage: string | null;
  cast: PersonCredit[];
  crew: PersonCredit[];
};

const personCache = new Map<number, PersonDetail>();
const personInflight = new Map<number, Promise<PersonDetail | null>>();

export function tmdbPersonCached(personId: number): PersonDetail | undefined {
  return personCache.get(personId);
}

export async function tmdbPerson(key: string, personId: number): Promise<PersonDetail | null> {
  if (!key) return null;
  const cached = personCache.get(personId);
  if (cached) return cached;
  if (personInflight.has(personId)) return personInflight.get(personId)!;
  const p = fetchPerson(key, personId).finally(() => personInflight.delete(personId));
  personInflight.set(personId, p);
  return p;
}

async function fetchPerson(key: string, personId: number): Promise<PersonDetail | null> {
  const raw = await get<any>(key, `person/${personId}`, {
    append_to_response: "combined_credits,external_ids",
    language: effectiveTmdbLanguage() || "en",
  });
  if (!raw) return null;

  const toCredit = (c: any): PersonCredit => ({
    id: c.id,
    mediaType: c.media_type,
    title: c.title ?? c.name ?? "",
    poster: c.poster_path ? `${IMG}/w342${c.poster_path}` : undefined,
    background: c.backdrop_path ? `${IMG}/w780${c.backdrop_path}` : undefined,
    releaseInfo: (c.release_date ?? c.first_air_date)?.slice(0, 4),
    releaseDate: c.release_date ?? c.first_air_date,
    imdbRating: c.vote_average > 0 ? Number(c.vote_average).toFixed(1) : undefined,
    description: c.overview ?? "",
    character: c.character ?? undefined,
    job: c.job ?? undefined,
    department: c.department ?? undefined,
    popularity: c.popularity ?? 0,
    voteCount: c.vote_count ?? 0,
    voteAverage: c.vote_average ?? 0,
    episodeCount: c.episode_count ?? undefined,
    order: typeof c.order === "number" ? c.order : undefined,
    genreIds: Array.isArray(c.genre_ids) ? c.genre_ids : undefined,
  });

  const detail: PersonDetail = {
    id: raw.id,
    name: raw.name ?? "",
    biography: raw.biography ?? "",
    birthday: raw.birthday ?? null,
    deathday: raw.deathday ?? null,
    placeOfBirth: raw.place_of_birth ?? null,
    knownForDepartment: raw.known_for_department ?? "",
    profilePath: raw.profile_path ?? null,
    imdbId: raw.external_ids?.imdb_id ?? null,
    homepage: raw.homepage ?? null,
    cast: (raw.combined_credits?.cast ?? []).map(toCredit),
    crew: (raw.combined_credits?.crew ?? []).map(toCredit),
  };
  lruSet(personCache, personId, detail, PERSON_CACHE_MAX);
  return detail;
}

export function creditToMeta(c: PersonCredit): Meta {
  return {
    id: c.mediaType === "movie" ? `tmdb:movie:${c.id}` : `tmdb:tv:${c.id}`,
    type: c.mediaType === "movie" ? "movie" : "series",
    name: c.title,
    poster: c.poster,
    background: c.background,
    description: c.description,
    releaseInfo: c.releaseInfo,
    releaseDate: c.releaseDate,
    imdbRating: c.imdbRating,
  };
}
