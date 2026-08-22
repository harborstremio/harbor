import { meta as cinemetaMeta } from "./cinemeta";
import {
  fetchAnticipatedMovies,
  fetchAnticipatedShows,
  fetchUpcomingEpisodes,
  fetchUpcomingMovies,
} from "./trakt/calendar";
import type { CalendarItem } from "./calendar";
import { localDateTimeFromIso } from "./calendar-time";
import { resolveSavedCalendar, type SavedCandidate } from "./calendar-library";
import { fetchWatchlist as fetchSimklWatchlist, fetchWatchingItems } from "./simkl/watchlist";
import { fetchSimklCdnCalendar } from "./simkl/calendar";
import { isAuthenticated as simklConnected } from "./simkl/session";
import { fetchAniListAiringCalendar as fetchAniListAiring } from "./anilist/airing";
import { fetchDubSchedule } from "./providers/anime-dub-sub";

export { fetchLibraryCalendar } from "./calendar-library";

interface CacheEntry {
  items: CalendarItem[];
  timestamp: number;
}

const calendarCache = new Map<string, CacheEntry>();
const calendarInFlight = new Map<string, Promise<CalendarItem[]>>();
const CACHE_STALE_MS = 30 * 60 * 1000;

function withCalendarCache(
  cacheKey: string,
  fetcher: () => Promise<CalendarItem[]>,
): Promise<CalendarItem[]> {
  const cached = calendarCache.get(cacheKey);
  const now = Date.now();

  if (cached) {
    if (now - cached.timestamp >= CACHE_STALE_MS) {
      if (!calendarInFlight.has(cacheKey)) {
        const promise = fetcher()
          .then((items) => {
            calendarCache.set(cacheKey, { items, timestamp: Date.now() });
            return items;
          })
          .catch(() => cached.items)
          .finally(() => {
            calendarInFlight.delete(cacheKey);
          });
        calendarInFlight.set(cacheKey, promise);
      }
    }
    return Promise.resolve(cached.items);
  }

  if (calendarInFlight.has(cacheKey)) {
    return calendarInFlight.get(cacheKey)!;
  }

  const promise = fetcher()
    .then((items) => {
      calendarCache.set(cacheKey, { items, timestamp: Date.now() });
      return items;
    })
    .finally(() => {
      calendarInFlight.delete(cacheKey);
    });
  calendarInFlight.set(cacheKey, promise);
  return promise;
}

export function clearCalendarSourceCache() {
  calendarCache.clear();
  calendarInFlight.clear();
}

export async function fetchSimklPremieresCalendar(
  year: number,
  month: number,
): Promise<CalendarItem[]> {
  const cacheKey = `simkl-premieres:${year}-${month}`;
  return withCalendarCache(cacheKey, () => fetchSimklCdnCalendar(year, month).catch(() => []));
}

export async function fetchAniListAiringCalendar(
  year: number,
  month: number,
): Promise<CalendarItem[]> {
  const cacheKey = `anilist-airing:${year}-${month}`;
  return withCalendarCache(cacheKey, () => fetchAniListAiring(year, month).catch(() => []));
}

export async function fetchAnimeDubCalendar(year: number, month: number): Promise<CalendarItem[]> {
  const cacheKey = `anime-dub:${year}-${month}`;
  return withCalendarCache(cacheKey, () => mapDubFeedToCalendar(year, month).catch(() => []));
}

async function mapDubFeedToCalendar(year: number, month: number): Promise<CalendarItem[]> {
  const entries = await fetchDubSchedule();
  const out: CalendarItem[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const media = e?.media?.media;
    if (!media) continue;
    if (media.isAdult) continue;
    if (media.format === "MOVIE" || e.episodeNumber == null) continue;
    const { date: dateISO, time, atMs } = localDateTimeFromIso(e.episodeDate);
    if (!inMonth(dateISO, year, month)) continue;
    const title =
      media.title?.english?.trim() ||
      media.title?.romaji?.trim() ||
      e.english?.trim() ||
      e.romaji?.trim() ||
      "Untitled";
    const baseId = media.idMal != null ? `mal:${media.idMal}` : `anilist:${media.id}`;
    const id = `${baseId}:1:${e.episodeNumber}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      imdbId: null,
      type: "tv",
      name: `${title} S1E${pad(e.episodeNumber)}`,
      poster: media.coverImage?.extraLarge ?? media.coverImage?.medium ?? null,
      background: media.bannerImage ?? null,
      releaseDate: dateISO,
      releaseTime: time,
      releaseAtMs: atMs,
      isAnime: true,
      overview: "",
      voteAverage: 0,
    });
  }
  out.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return out;
}

export async function fetchSimklCalendar(
  year: number,
  month: number,
  opts: { tmdbKey: string },
): Promise<CalendarItem[]> {
  if (!simklConnected()) return [];
  const cacheKey = `simkl-calendar:${year}-${month}`;
  return withCalendarCache(cacheKey, async () => {
    const [watchlist, watching] = await Promise.all([
      fetchSimklWatchlist().catch(() => []),
      fetchWatchingItems().catch(() => []),
    ]);
    const items = [...watchlist, ...watching];
    const candidates: SavedCandidate[] = [];
    const seenIds = new Set<string>();
    for (const it of items) {
      const id =
        it.ids.imdb ??
        (it.ids.tmdb
          ? it.type === "movie"
            ? `tmdb:movie:${it.ids.tmdb}`
            : `tmdb:tv:${it.ids.tmdb}`
          : it.ids.mal
            ? `mal:${it.ids.mal}`
            : null);
      if (!id) continue;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      candidates.push({
        id,
        type: it.type === "show" ? "series" : "movie",
        name: it.title,
        mtime: 0,
        temp: false,
      });
    }
    if (candidates.length === 0) return [];
    return resolveSavedCalendar(candidates, year, month, opts);
  });
}

const TRAKT_MAX_FORWARD_MONTHS = 6;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function inMonth(iso: string, year: number, month: number): boolean {
  if (!iso) return false;
  const [y, m] = iso.split("-").map(Number);
  return y === year && (m ?? 0) - 1 === month;
}

function isAnimationGenre(genres: string[] | undefined): boolean {
  if (!genres) return false;
  const wanted = ["animation", "anime"];
  return genres.some((g) => wanted.includes(g.toLowerCase()));
}

export async function fetchTraktCalendar(year: number, month: number): Promise<CalendarItem[]> {
  const today = new Date();
  const cur = new Date(year, month, 1);
  const fwdMonths =
    (cur.getFullYear() - today.getFullYear()) * 12 + (cur.getMonth() - today.getMonth());
  if (fwdMonths < 0 || fwdMonths > TRAKT_MAX_FORWARD_MONTHS) return [];
  const days = Math.max(31, (fwdMonths + 1) * 31);
  const [eps, mvs] = await Promise.all([fetchUpcomingEpisodes(days), fetchUpcomingMovies(days)]);

  const epsInMonth = eps
    .map((ep) => ({ ep, ...localDateTimeFromIso(ep.airDate) }))
    .filter((x) => inMonth(x.date, year, month));
  const mvsInMonth = mvs
    .map((m) => ({ m, ...localDateTimeFromIso(m.contextDate) }))
    .filter((x) => inMonth(x.date, year, month));

  const showIds = [
    ...new Set(epsInMonth.map((x) => x.ep.ids.imdb).filter((x): x is string => !!x)),
  ];
  const movieIds = [
    ...new Set(mvsInMonth.map((x) => x.m.ids.imdb).filter((x): x is string => !!x)),
  ];
  const [showMetas, movieMetas] = await Promise.all([
    Promise.all(showIds.map((id) => cinemetaMeta("series", id).catch(() => null))),
    Promise.all(movieIds.map((id) => cinemetaMeta("movie", id).catch(() => null))),
  ]);
  const showMeta = new Map(showIds.map((id, i) => [id, showMetas[i]] as const));
  const movieMeta = new Map(movieIds.map((id, i) => [id, movieMetas[i]] as const));

  const out: CalendarItem[] = [];
  for (const { ep, date, time, atMs } of epsInMonth) {
    const imdb = ep.ids.imdb ?? null;
    const meta = imdb ? (showMeta.get(imdb) ?? null) : null;
    const baseId = imdb ?? `trakt:${ep.ids.tmdb ?? ep.ids.tvdb ?? ep.title}`;
    const epLabel = `S${pad(ep.season)}E${pad(ep.number)}`;
    const vid = meta?.videos?.find(
      (v) => (v.season ?? 0) === ep.season && (v.episode ?? v.number ?? 0) === ep.number,
    );
    out.push({
      id: `${baseId}:${ep.season}:${ep.number}`,
      imdbId: imdb,
      type: "tv",
      name: ep.episodeTitle
        ? `${ep.title} ${epLabel}: ${ep.episodeTitle}`
        : `${ep.title} ${epLabel}`,
      poster: meta?.poster ?? vid?.thumbnail ?? null,
      background: meta?.background ?? null,
      releaseDate: date,
      releaseTime: time,
      releaseAtMs: atMs,
      isAnime: isAnimationGenre(meta?.genres),
      overview: meta?.description ?? "",
      voteAverage: parseFloat(meta?.imdbRating ?? "0") || 0,
    });
  }
  for (const { m, date, time, atMs } of mvsInMonth) {
    const imdb = m.ids.imdb ?? null;
    const meta = imdb ? (movieMeta.get(imdb) ?? null) : null;
    const id = imdb ?? `trakt:${m.ids.tmdb ?? m.title}`;
    out.push({
      id,
      imdbId: imdb,
      type: "movie",
      name: m.title,
      poster: meta?.poster ?? null,
      background: meta?.background ?? null,
      releaseDate: date,
      releaseTime: time,
      releaseAtMs: atMs,
      isAnime: isAnimationGenre(meta?.genres),
      overview: meta?.description ?? "",
      voteAverage: parseFloat(meta?.imdbRating ?? "0") || 0,
    });
  }
  out.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return out;
}

export async function fetchAnticipatedCalendar(
  year: number,
  month: number,
): Promise<CalendarItem[]> {
  const [shows, mvs] = await Promise.all([fetchAnticipatedShows(), fetchAnticipatedMovies()]);
  const inMonthShows = shows.filter((s) => inMonth(s.firstAired, year, month));
  const inMonthMovies = mvs.filter((m) => inMonth(m.released, year, month));
  const [showMetas, movieMetas] = await Promise.all([
    Promise.all(
      inMonthShows.map((s) =>
        s.ids.imdb ? cinemetaMeta("series", s.ids.imdb).catch(() => null) : Promise.resolve(null),
      ),
    ),
    Promise.all(
      inMonthMovies.map((m) =>
        m.ids.imdb ? cinemetaMeta("movie", m.ids.imdb).catch(() => null) : Promise.resolve(null),
      ),
    ),
  ]);
  const out: CalendarItem[] = [];
  for (let i = 0; i < inMonthShows.length; i++) {
    const s = inMonthShows[i];
    const meta = showMetas[i];
    const id = s.ids.imdb ?? `trakt:${s.ids.tmdb ?? s.ids.tvdb ?? s.title}`;
    out.push({
      id: `${id}:premiere`,
      imdbId: s.ids.imdb ?? null,
      type: "tv",
      name: `${s.title} (premiere)`,
      poster: meta?.poster ?? s.poster,
      background: meta?.background ?? null,
      releaseDate: s.firstAired,
      isAnime: false,
      overview: meta?.description ?? s.overview,
      voteAverage: parseFloat(meta?.imdbRating ?? "0") || 0,
    });
  }
  for (let i = 0; i < inMonthMovies.length; i++) {
    const m = inMonthMovies[i];
    const meta = movieMetas[i];
    const id = m.ids.imdb ?? `trakt:${m.ids.tmdb ?? m.title}`;
    out.push({
      id,
      imdbId: m.ids.imdb ?? null,
      type: "movie",
      name: m.title,
      poster: meta?.poster ?? m.poster,
      background: meta?.background ?? null,
      releaseDate: m.released,
      isAnime: false,
      overview: meta?.description ?? m.overview,
      voteAverage: parseFloat(meta?.imdbRating ?? "0") || 0,
    });
  }
  out.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return out;
}
