import { meta as cinemetaMeta } from "./cinemeta";
import { library, type LibraryItem } from "./stremio";
import { readLocalEntries } from "./watchlist";
import { listLocalCw } from "./local-cw";
import { manualWatchedLibraryItems } from "./manual-watched";
import { fetchWatchlist as fetchTraktWatchlist } from "./trakt/watchlist";
import { tvmazeUpcoming } from "./providers/tvmaze";
import {
  tmdbFindByImdb,
  tmdbMovieRelease,
  tmdbTvPoster,
  tmdbTvUpcoming,
} from "./providers/tmdb/tmdb-calendar";
import { aniZipByAnilist, aniZipByKitsu, aniZipByMal, pickEpisodeTitle } from "./providers/anizip";
import { imdbToKitsu, tmdbTvToKitsu } from "./providers/anime-mapping";
import { franchiseRoot } from "./providers/anime-franchise-root";
import type { CalendarItem } from "./calendar";
import { localDateTimeFromIso } from "./calendar-time";

const SERIES_LIMIT = 80;
const MOVIE_LIMIT = 80;
const TMDB_CONCURRENCY = 6;
const TVMAZE_CONCURRENCY = 3;

export type SavedCandidate = {
  id: string;
  type: "movie" | "series";
  name: string;
  mtime: number;
  temp: boolean;
};

type Candidate = SavedCandidate;

type ResolvedEpisode = {
  season: number;
  number: number;
  name: string;
  airDate: string;
  releaseTime?: string;
  releaseAtMs?: number;
  image: string | null;
  overview: string;
  voteAverage: number;
};

type ResolvedSeries = {
  name: string;
  poster: string | null;
  isAnime: boolean;
  episodes: ResolvedEpisode[];
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const seriesCache = new Map<string, { at: number; series: ResolvedSeries | null }>();
const movieCache = new Map<string, { at: number; movie: CalendarItem | null }>();

function wideWindow(): (iso: string) => boolean {
  const lo = Date.now() - 31 * 864e5;
  const hi = Date.now() + 400 * 864e5;
  return (iso) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= lo && t <= hi;
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function inMonthFactory(year: number, month: number): (iso: string) => boolean {
  return (iso) => {
    if (!iso) return false;
    const [y, m] = iso.split("-").map(Number);
    return y === year && (m ?? 0) - 1 === month;
  };
}

function isAnimationGenre(genres: string[] | undefined): boolean {
  if (!genres) return false;
  return genres.some((g) => {
    const l = g.toLowerCase();
    return l === "animation" || l === "anime";
  });
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

function isAnimeId(id: string): boolean {
  return id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");
}

function animeNumericId(id: string): number | null {
  const n = Number(id.split(":")[1]);
  return Number.isFinite(n) ? n : null;
}

async function animeUpcoming(
  id: string,
  inWindow: (date: string) => boolean,
  tmdbKey: string,
): Promise<ResolvedSeries | null> {
  const numId = animeNumericId(id);
  if (numId == null) return null;
  const mapping = id.startsWith("kitsu:")
    ? await aniZipByKitsu(numId)
    : id.startsWith("mal:")
      ? await aniZipByMal(numId)
      : await aniZipByAnilist(numId);
  if (!mapping?.episodes) return null;
  const episodes: ResolvedEpisode[] = [];
  for (const [k, ep] of Object.entries(mapping.episodes)) {
    const { date, time, atMs } = localDateTimeFromIso(ep.airDateUtc ?? ep.airDate ?? ep.airdate);
    if (!date || !inWindow(date)) continue;
    episodes.push({
      season: ep.seasonNumber ?? 1,
      number: ep.episodeNumber ?? (Number(k) || 0),
      name: pickEpisodeTitle(ep) ?? "",
      airDate: date,
      releaseTime: time,
      releaseAtMs: atMs,
      image: ep.image ?? null,
      overview: ep.overview ?? "",
      voteAverage: 0,
    });
  }
  // AniZip has no series-poster field, only small per-episode stills, so the
  // per-episode images are frequently low-resolution. Resolve a proper poster
  // via the TMDB cross-reference AniZip already supplies, when available.
  let poster: string | null = null;
  const tmdbId = mapping.mappings?.themoviedb_id;
  const numTmdbId = typeof tmdbId === "string" ? Number(tmdbId) : tmdbId;
  if (tmdbKey && numTmdbId != null && Number.isFinite(numTmdbId)) {
    poster = await tmdbTvPoster(tmdbKey, numTmdbId).catch(() => null);
  }
  return {
    name: mapping.titles?.en ?? mapping.titles?.["x-jat"] ?? "",
    poster,
    isAnime: true,
    episodes,
  };
}

async function tmdbSeries(
  id: string,
  inWindow: (date: string) => boolean,
  tmdbKey: string,
): Promise<ResolvedSeries | null> {
  let tvId: number | null = null;
  if (id.startsWith("tmdb:tv:")) tvId = Number(id.split(":")[2]);
  else if (id.startsWith("tt")) tvId = (await tmdbFindByImdb(tmdbKey, id.split(":")[0])).tvId;
  if (tvId == null || !Number.isFinite(tvId)) return null;
  return tmdbTvUpcoming(tmdbKey, tvId, inWindow);
}

async function cinemetaSeriesUpcoming(
  id: string,
  inWindow: (date: string) => boolean,
): Promise<ResolvedSeries | null> {
  const imdb = id.startsWith("tt") ? id.split(":")[0] : null;
  if (!imdb) return null;
  const m = await cinemetaMeta("series", imdb).catch(() => null);
  if (!m?.videos) return null;
  const episodes: ResolvedEpisode[] = [];
  for (const v of m.videos) {
    const { date, time, atMs } = localDateTimeFromIso(v.released ?? v.firstAired);
    if (!date || !inWindow(date)) continue;
    const number = v.episode ?? v.number;
    if (number == null) continue;
    episodes.push({
      season: v.season ?? 0,
      number,
      name: v.name ?? v.title ?? "",
      airDate: date,
      releaseTime: time,
      releaseAtMs: atMs,
      image: v.thumbnail ?? null,
      overview: "",
      voteAverage: 0,
    });
  }
  if (episodes.length === 0) return null;
  return { name: m.name, poster: m.poster ?? null, isAnime: isAnimationGenre(m.genres), episodes };
}

async function seriesUpcoming(
  c: Candidate,
  inWindow: (date: string) => boolean,
  tmdbKey: string,
): Promise<ResolvedSeries | null> {
  if (isAnimeId(c.id)) return animeUpcoming(c.id, inWindow, tmdbKey);
  if (c.id.startsWith("tt")) {
    const cm = await cinemetaSeriesUpcoming(c.id, inWindow);
    if (cm) return cm;
  }
  if (tmdbKey) {
    const t = await tmdbSeries(c.id, inWindow, tmdbKey).catch(() => null);
    if (t) return t;
  } else if (c.id.startsWith("tt")) {
    const up = await tvmazeUpcoming(c.id.split(":")[0], inWindow).catch(() => null);
    if (up) {
      return {
        name: up.show.name,
        poster: up.show.image,
        isAnime: up.show.isAnime,
        episodes: up.episodes.map((e) => ({
          season: e.season,
          number: e.number,
          name: e.name,
          airDate: e.airdate,
          image: e.image,
          overview: e.summary,
          voteAverage: 0,
        })),
      };
    }
  }
  return null;
}

async function movieRelease(
  c: Candidate,
  inWindow: (date: string) => boolean,
  tmdbKey: string,
): Promise<CalendarItem | null> {
  const imdb = c.id.startsWith("tt") ? c.id.split(":")[0] : null;
  let movieId: number | null = null;
  if (c.id.startsWith("tmdb:movie:")) movieId = Number(c.id.split(":")[2]);
  else if (imdb && tmdbKey) movieId = (await tmdbFindByImdb(tmdbKey, imdb)).movieId;

  if (movieId != null && Number.isFinite(movieId) && tmdbKey) {
    const m = await tmdbMovieRelease(tmdbKey, movieId);
    if (!m || !inWindow(m.releaseDate)) return null;
    return {
      id: c.id,
      imdbId: imdb,
      type: "movie",
      name: m.name || c.name,
      poster: m.poster,
      background: m.background,
      releaseDate: m.releaseDate,
      isAnime: m.isAnime,
      overview: m.overview,
      voteAverage: m.voteAverage,
    };
  }
  if (imdb) {
    const m = await cinemetaMeta("movie", imdb);
    if (!m) return null;
    const date = (m.releaseDate ?? "").slice(0, 10);
    if (!inWindow(date)) return null;
    return {
      id: m.id,
      imdbId: imdb,
      type: "movie",
      name: m.name,
      poster: m.poster ?? null,
      background: m.background ?? null,
      releaseDate: date,
      isAnime: isAnimationGenre(m.genres),
      overview: m.description ?? "",
      voteAverage: parseFloat(m.imdbRating ?? "0") || 0,
    };
  }
  return null;
}

function gatherCandidates(
  stremio: LibraryItem[],
  local: ReturnType<typeof readLocalEntries>,
  trakt: Awaited<ReturnType<typeof fetchTraktWatchlist>>,
  watched: Candidate[],
): Candidate[] {
  const byId = new Map<string, Candidate>();
  const add = (c: Candidate) => {
    const prev = byId.get(c.id);
    if (!prev) byId.set(c.id, c);
    else
      byId.set(c.id, {
        ...prev,
        temp: prev.temp && c.temp,
        mtime: Math.max(prev.mtime, c.mtime),
        name: prev.name || c.name,
      });
  };
  for (const i of stremio) {
    if (i.removed) continue;
    add({
      id: i._id,
      type: i.type === "series" ? "series" : "movie",
      name: i.name ?? "",
      mtime: Date.parse(i._mtime ?? "") || 0,
      temp: !!i.temp,
    });
  }
  for (const e of local) {
    add({ id: e.id, type: e.type, name: e.name ?? "", mtime: e.addedAt || 0, temp: false });
  }
  for (const t of trakt) {
    const id =
      t.ids.imdb ??
      (t.ids.tmdb
        ? t.type === "movie"
          ? `tmdb:movie:${t.ids.tmdb}`
          : `tmdb:tv:${t.ids.tmdb}`
        : null);
    if (!id) continue;
    add({
      id,
      type: t.type === "show" ? "series" : "movie",
      name: t.title ?? "",
      mtime: Date.parse(t.contextDate ?? "") || 0,
      temp: false,
    });
  }
  // Anime with a Kitsu/MAL/AniList id is deliberately never written to the
  // Stremio library (cloudWriteId/libraryPut return for anime ids), so a show
  // the user started watching only lives in Continue Watching and manual-watched
  // state. Include those, or a just-started anime never reaches this calendar.
  for (const c of watched) add(c);
  return Array.from(byId.values());
}

function locallyWatchedCandidates(): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (id: string, type: "movie" | "series", name: string, mtime: number) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, type, name, mtime, temp: false });
  };
  for (const i of manualWatchedLibraryItems()) {
    push(
      i._id,
      i.type === "anime" || i.type === "series" ? "series" : "movie",
      i.name ?? "",
      Date.parse(i._mtime ?? "") || 0,
    );
  }
  for (const e of listLocalCw()) {
    push(e.id, e.type === "movie" ? "movie" : "series", e.name ?? "", e.t || 0);
  }
  return out;
}

const curatedFirst = (a: Candidate, b: Candidate) =>
  (a.temp ? 1 : 0) - (b.temp ? 1 : 0) || b.mtime - a.mtime;

/**
 * The same anime is often in the library twice: once as a Kitsu/MAL/AniList row
 * (started watching) and once as its IMDb/TMDB row (porvider metadata). They
 * resolve to the same franchise but with different names and provider dates, so
 * the per-episode dedup cannot see the overlap. When an anime-scheme candidate
 * covers a franchise, drop the catalog candidate for that same franchise.
 */
async function candidateRoot(id: string): Promise<string> {
  if (isAnimeId(id) || id.startsWith("anidb:")) return franchiseRoot(id).catch(() => id);
  // franchiseRoot knows imdb and anime-scheme ids, but not tmdb:tv — bridge it.
  let kitsu: number | null = null;
  if (/^tt\d+/.test(id)) kitsu = await imdbToKitsu(id.split(":")[0]).catch(() => null);
  else if (id.startsWith("tmdb:tv:")) {
    const n = Number(id.split(":")[2]);
    kitsu = Number.isFinite(n) ? await tmdbTvToKitsu(n).catch(() => null) : null;
  }
  if (kitsu == null) return id;
  return franchiseRoot(`kitsu:${kitsu}`).catch(() => `kitsu:${kitsu}`);
}

async function dropCatalogDuplicates(candidates: Candidate[]): Promise<Candidate[]> {
  const roots = new Map<string, string>();
  const animeRoots = new Set<string>();
  for (const c of candidates) {
    const root = await candidateRoot(c.id);
    roots.set(c.id, root);
    if (isAnimeId(c.id)) animeRoots.add(root);
  }
  if (animeRoots.size === 0) return candidates;
  return candidates.filter((c) => {
    if (isAnimeId(c.id)) return true;
    const root = roots.get(c.id);
    return root == null || !animeRoots.has(root);
  });
}

export async function fetchLibraryCalendar(
  authKey: string,
  year: number,
  month: number,
  opts: { tmdbKey: string; includeTrakt: boolean },
): Promise<CalendarItem[]> {
  const local = readLocalEntries();
  let stremio: LibraryItem[] = [];
  let stremioFailed = false;
  if (authKey) {
    try {
      stremio = await library(authKey);
    } catch {
      stremioFailed = true;
    }
  }
  const trakt = opts.includeTrakt ? await fetchTraktWatchlist().catch(() => []) : [];

  const gathered = gatherCandidates(stremio, local, trakt, locallyWatchedCandidates());
  const candidates = await dropCatalogDuplicates(gathered);
  if (candidates.length === 0) {
    if (stremioFailed) throw new Error("Couldn't load your library");
    return [];
  }
  return resolveSavedCalendar(candidates, year, month, { tmdbKey: opts.tmdbKey });
}

async function resolveSeriesCached(
  c: SavedCandidate,
  tmdbKey: string,
): Promise<ResolvedSeries | null> {
  const hit = seriesCache.get(c.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.series;
  const series = await seriesUpcoming(c, wideWindow(), tmdbKey).catch(() => null);
  seriesCache.set(c.id, { at: Date.now(), series });
  return series;
}

async function resolveMovieCached(
  c: SavedCandidate,
  tmdbKey: string,
): Promise<CalendarItem | null> {
  const hit = movieCache.get(c.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.movie;
  const movie = await movieRelease(c, wideWindow(), tmdbKey).catch(() => null);
  movieCache.set(c.id, { at: Date.now(), movie });
  return movie;
}

export async function resolveSavedCalendar(
  candidates: SavedCandidate[],
  year: number,
  month: number,
  opts: { tmdbKey: string },
): Promise<CalendarItem[]> {
  const inMonth = inMonthFactory(year, month);
  const series = candidates
    .filter((c) => c.type === "series")
    .sort(curatedFirst)
    .slice(0, SERIES_LIMIT);
  const movies = candidates
    .filter((c) => c.type === "movie")
    .sort(curatedFirst)
    .slice(0, MOVIE_LIMIT);

  const out: CalendarItem[] = [];

  const seriesConc = opts.tmdbKey ? TMDB_CONCURRENCY : TVMAZE_CONCURRENCY;
  const seriesResults = await mapLimit(series, seriesConc, async (c) => ({
    c,
    r: await resolveSeriesCached(c, opts.tmdbKey),
  }));
  for (const { c, r } of seriesResults) {
    if (!r) continue;
    const showName = r.name || c.name;
    for (const ep of r.episodes) {
      if (ep.season === 0 && ep.number === 0) continue;
      if (!inMonth(ep.airDate)) continue;
      const epLabel = `S${pad(ep.season)}E${pad(ep.number)}`;
      out.push({
        id: `${c.id}:${ep.season}:${ep.number}`,
        imdbId: c.id.startsWith("tt") ? c.id.split(":")[0] : null,
        type: "tv",
        name: ep.name ? `${showName} ${epLabel}: ${ep.name}` : `${showName} ${epLabel}`,
        poster: r.poster ?? ep.image ?? null,
        background: null,
        releaseDate: ep.airDate,
        releaseTime: ep.releaseTime,
        releaseAtMs: ep.releaseAtMs,
        isAnime: r.isAnime,
        overview: ep.overview,
        voteAverage: ep.voteAverage,
      });
    }
  }

  const movieResults = await mapLimit(movies, TMDB_CONCURRENCY, (c) =>
    resolveMovieCached(c, opts.tmdbKey),
  );
  for (const mi of movieResults) if (mi && inMonth(mi.releaseDate)) out.push(mi);

  const seen = new Set<string>();
  const unique: CalendarItem[] = [];
  const episodeOf = (item: CalendarItem) => item.name.match(/\sS(\d+)E(\d+)/i);
  const showKeyOf = (item: CalendarItem, ep: RegExpMatchArray) =>
    item.name
      .slice(0, item.name.indexOf(ep[0]))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  for (const item of out) {
    const ep = episodeOf(item);
    const key = ep
      ? `tv|${showKeyOf(item, ep)}|s${Number(ep[1])}e${Number(ep[2])}|${item.releaseDate}`
      : `movie|${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}|${item.releaseDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  // TMDB merges a sequel into the parent season, so a single airing can arrive
  // as both S1E14 and S2E03 on the same date. When a show reports several
  // seasons on one date, keep the newest season; the older label is the merge.
  const byShowDate = new Map<string, CalendarItem[]>();
  const deduped: CalendarItem[] = [];
  for (const item of unique) {
    const ep = episodeOf(item);
    if (!ep) {
      deduped.push(item);
      continue;
    }
    const key = `tv|${showKeyOf(item, ep)}|${item.releaseDate}`;
    const list = byShowDate.get(key);
    if (list) list.push(item);
    else byShowDate.set(key, [item]);
  }
  for (const list of byShowDate.values()) {
    if (list.length === 1) {
      deduped.push(list[0]);
      continue;
    }
    const seasons = new Map<number, CalendarItem[]>();
    for (const item of list) {
      const season = Number(episodeOf(item)![1]);
      const bucket = seasons.get(season);
      if (bucket) bucket.push(item);
      else seasons.set(season, [item]);
    }
    if (seasons.size > 1) {
      const newest = Math.max(...seasons.keys());
      deduped.push(...seasons.get(newest)!);
    } else {
      deduped.push(...list);
    }
  }
  deduped.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return deduped;
}
