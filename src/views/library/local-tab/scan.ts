import { parseFilename, type LocalEntry } from "@/lib/local-library";
import { effectiveTmdbLanguage } from "@/lib/providers/tmdb/tmdb-client";
import { imageRequestLang } from "@/lib/providers/tmdb/tmdb-image-lang";
import {
  findLocalArt,
  findNfo,
  findShowArt,
  findShowNfo,
  readNfo,
} from "@/lib/local-library/sidecars";

export type ScannedFile = { path: string; filename: string; size: number };

type Parsed = ReturnType<typeof parseFilename>;

export type TmdbLookup = {
  tmdbId?: number;
  imdbId?: string;
  poster?: string;
  matchedTitle?: string;
  matchedYear?: number | null;
  rating?: number;
  runtime?: number;
  isAnime?: boolean;
  genres?: string[];
};

const ANIMATION_GENRE_ID = 16;

export function hashPath(path: string): string {
  let hash = 5381;
  for (let i = 0; i < path.length; i++) {
    hash = ((hash << 5) + hash + path.charCodeAt(i)) | 0;
  }
  return `local-${(hash >>> 0).toString(36)}`;
}

export async function buildTmdbEntry(
  f: ScannedFile,
  parsed: Parsed,
  tmdbKey: string | null,
): Promise<LocalEntry> {
  let tmdb: TmdbLookup = {};
  if (tmdbKey)
    tmdb = await tmdbLookup(tmdbKey, parsed.title, parsed.year, parsed.type).catch(() => ({}));
  const needsReview = tmdbKey ? lowConfidence(parsed, tmdb) : false;
  const identified = tmdb.tmdbId != null && !needsReview;
  return {
    id: hashPath(f.path),
    path: f.path,
    filename: f.filename,
    title: identified ? tmdb.matchedTitle?.trim() || parsed.title : parsed.title,
    year: (identified ? tmdb.matchedYear : null) ?? parsed.year,
    type: parsed.type,
    resolution: parsed.resolution,
    size: f.size ?? null,
    rating: tmdb.rating ?? null,
    runtime: tmdb.runtime ?? null,
    genres: tmdb.genres ?? null,
    poster: tmdb.poster ?? null,
    tmdbId: tmdb.tmdbId ?? null,
    imdbId: tmdb.imdbId ?? null,
    season: parsed.season,
    episode: parsed.episode,
    addedAt: Date.now(),
    source: "tmdb",
    needsReview: needsReview || undefined,
    isAnime: tmdb.isAnime || undefined,
  };
}

export async function buildNfoEntry(
  f: ScannedFile,
  parsed: Parsed,
  tmdbKey: string | null,
): Promise<LocalEntry> {
  const nfoPath = await findNfo(f.path);
  const nfo = nfoPath ? await readNfo(nfoPath) : null;

  const isShow = parsed.type === "show";
  let seriesNfo: Awaited<ReturnType<typeof readNfo>> = null;
  if (isShow) {
    const showNfoPath = await findShowNfo(f.path);
    seriesNfo = showNfoPath ? await readNfo(showNfoPath) : null;
  }
  const meta = isShow ? seriesNfo : nfo;

  const files = isShow ? await findShowArt(f.path, parsed.season) : await findLocalArt(f.path);

  const art = {
    poster: files.poster ?? meta?.art?.poster,
    logo: files.logo ?? meta?.art?.logo,
    backdrop: files.backdrop ?? meta?.art?.backdrop,
  };

  let title = (
    isShow ? meta?.title || nfo?.showTitle || parsed.title : nfo?.title || parsed.title
  ).trim();
  const year = meta?.year ?? parsed.year;
  let tmdbId = meta?.tmdbId ?? null;
  let imdbId = meta?.imdbId ?? null;
  let poster: string | null = null;
  let rating = meta?.rating ?? null;
  let runtime = meta?.runtime ?? null;
  let isAnime = false;
  // The .nfo wins; TMDB only fills the gap when the file carries no <genre>.
  let genres = meta?.genres ?? nfo?.genres ?? null;

  if (tmdbKey && !tmdbId) {
    const look = await tmdbLookup(tmdbKey, title, year, parsed.type).catch(
      () => ({}) as TmdbLookup,
    );
    if (look.tmdbId) tmdbId = look.tmdbId;
    if (!imdbId && look.imdbId) imdbId = look.imdbId;
    if (!art.poster && look.poster) poster = look.poster;
    if (rating == null && look.rating != null) rating = look.rating;
    if (runtime == null && look.runtime != null) runtime = look.runtime;
    if (look.isAnime) isAnime = true;
    if (genres == null && look.genres != null) genres = look.genres;
    const hadNfoTitle = isShow ? !!(meta?.title || nfo?.showTitle) : !!nfo?.title;
    if (!hadNfoTitle && look.matchedTitle) title = look.matchedTitle.trim();
  }

  const localArt = art.poster || art.logo || art.backdrop ? art : undefined;
  const needsReview = !tmdbId && !imdbId && !art.poster;

  return {
    id: hashPath(f.path),
    path: f.path,
    filename: f.filename,
    title,
    year,
    type: parsed.type,
    resolution: parsed.resolution,
    size: f.size ?? null,
    rating,
    runtime,
    genres,
    poster,
    tmdbId,
    imdbId,
    season: parsed.season,
    episode: parsed.episode,
    addedAt: Date.now(),
    source: "nfo",
    localArt,
    needsReview: needsReview || undefined,
    isAnime: isAnime || undefined,
  };
}

function lowConfidence(parsed: Parsed, tmdb: TmdbLookup): boolean {
  if (!tmdb.tmdbId) return true;
  if (
    parsed.year != null &&
    tmdb.matchedYear != null &&
    Math.abs(parsed.year - tmdb.matchedYear) > 1
  ) {
    return true;
  }
  if (tmdb.matchedTitle) {
    const a = tokenize(parsed.title);
    const b = tokenize(tmdb.matchedTitle);
    if (a.length && b.length && !a.some((w) => b.includes(w))) return true;
  }
  return false;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1);
}

async function tmdbLookup(
  key: string,
  title: string,
  year: number | null,
  type: "movie" | "show",
): Promise<TmdbLookup> {
  const path = type === "movie" ? "movie" : "tv";
  const params = new URLSearchParams({ api_key: key, query: title });
  const lang = effectiveTmdbLanguage() || imageRequestLang();
  if (lang) params.set("language", lang);
  if (year && type === "movie") params.set("year", String(year));
  if (year && type === "show") params.set("first_air_date_year", String(year));
  const r = await fetch(`https://api.themoviedb.org/3/search/${path}?${params}`);
  if (!r.ok) return {};
  const json = await r.json();
  const top = json.results?.[0];
  if (!top) return {};
  let imdbId: string | undefined;
  let rating: number | undefined;
  let runtime: number | undefined;
  let isAnime = Array.isArray(top.genre_ids) && top.genre_ids.includes(ANIMATION_GENRE_ID);
  let genres: string[] | undefined;
  try {
    const dparams = new URLSearchParams({ api_key: key, append_to_response: "external_ids" });
    if (lang) dparams.set("language", lang);
    const dr = await fetch(`https://api.themoviedb.org/3/${path}/${top.id}?${dparams}`);
    if (dr.ok) {
      const dj = await dr.json();
      const imdb = dj.imdb_id ?? dj.external_ids?.imdb_id;
      if (typeof imdb === "string" && imdb.startsWith("tt")) imdbId = imdb;
      if (typeof dj.vote_average === "number" && dj.vote_average > 0) rating = dj.vote_average;
      if (type === "movie" && typeof dj.runtime === "number" && dj.runtime > 0)
        runtime = dj.runtime;
      if (type === "show" && Array.isArray(dj.episode_run_time) && dj.episode_run_time[0] > 0) {
        runtime = dj.episode_run_time[0];
      }
      // Already in the response we fetch for imdb_id/runtime — no extra request.
      if (Array.isArray(dj.genres)) {
        isAnime = isAnime || dj.genres.some((g: { id?: number }) => g.id === ANIMATION_GENRE_ID);
        const names = dj.genres
          .map((g: { name?: unknown }) => (typeof g?.name === "string" ? g.name.trim() : ""))
          .filter((n: string) => n.length > 0);
        if (names.length > 0) genres = names;
      }
    }
  } catch {
    /* noop */
  }
  if (rating == null && typeof top.vote_average === "number" && top.vote_average > 0) {
    rating = top.vote_average;
  }
  const date: string | undefined = top.release_date ?? top.first_air_date;
  return {
    tmdbId: top.id,
    imdbId,
    poster: top.poster_path ? `https://image.tmdb.org/t/p/w342${top.poster_path}` : undefined,
    matchedTitle: top.title ?? top.name,
    matchedYear: date ? parseInt(date.slice(0, 4), 10) : null,
    rating,
    runtime,
    isAnime,
    genres,
  };
}
