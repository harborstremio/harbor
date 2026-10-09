import { invoke } from "@tauri-apps/api/core";
import { safeFetch as fetch, safeFetchBytes } from "@/lib/safe-fetch";
import { formatAirDate } from "@/lib/dates";
import {
  isPermissionGranted as tauriNotifyGranted,
  requestPermission as tauriNotifyRequest,
  sendNotification as tauriSendNotification,
} from "@tauri-apps/plugin-notification";
import { emitDeepLinkOpen, parseHarborOpen } from "@/lib/deep-link";
import { isLinuxDesktop, isMacDesktop, isWeb, isWindowsDesktop } from "@/lib/platform";
import { ensureNotifyPermission } from "@/lib/reminders";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import { focusWindow } from "@/lib/window";
import { tmdbImdbId } from "./providers/tmdb";
import { automaticNotificationPermission } from "./notification-permission";

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const ANIMATION_GENRE = 16;

export type CalendarItem = {
  id: string;
  imdbId?: string | null;
  type: "movie" | "tv";
  name: string;
  poster: string | null;
  background: string | null;
  releaseDate: string;
  releaseTime?: string;
  releaseAtMs?: number;
  isAnime: boolean;
  overview: string;
  voteAverage: number;
};

export type CalendarFilter = "all" | "movie" | "tv" | "anime";
export type CalendarPosterSize = "default" | "large";

const POSTER = (path: string | null | undefined) => (path ? `${IMG}/w342${path}` : null);
const BACKDROP = (path: string | null | undefined) => (path ? `${IMG}/w780${path}` : null);

type DiscoverMovieRow = {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
};

type DiscoverTvRow = {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
};

function isAnimeRow(row: {
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
}): boolean {
  const animation = (row.genre_ids ?? []).includes(ANIMATION_GENRE);
  const japanese = row.original_language === "ja" || (row.origin_country ?? []).includes("JP");
  return animation && japanese;
}

async function fetchDiscoverMovies(
  apiKey: string,
  start: string,
  end: string,
  region: string,
  page: number,
): Promise<DiscoverMovieRow[]> {
  const url = new URL(`${TMDB}/discover/movie`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("primary_release_date.gte", start);
  url.searchParams.set("primary_release_date.lte", end);
  if (region) url.searchParams.set("region", region);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("with_runtime.gte", "30");
  url.searchParams.set("page", String(page));
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: DiscoverMovieRow[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

async function fetchDiscoverTv(
  apiKey: string,
  start: string,
  end: string,
  page: number,
): Promise<DiscoverTvRow[]> {
  const url = new URL(`${TMDB}/discover/tv`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("first_air_date.gte", start);
  url.searchParams.set("first_air_date.lte", end);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("page", String(page));
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: DiscoverTvRow[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

async function fetchUpcomingMovies(
  apiKey: string,
  region: string,
  page: number,
): Promise<DiscoverMovieRow[]> {
  const url = new URL(`${TMDB}/movie/upcoming`);
  url.searchParams.set("api_key", apiKey);
  if (region) url.searchParams.set("region", region);
  url.searchParams.set("page", String(page));
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: DiscoverMovieRow[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

export async function fetchCalendarRange(
  apiKey: string,
  start: string,
  end: string,
  region: string,
): Promise<CalendarItem[]> {
  if (!apiKey) return [];
  const inRange = (d?: string) => !!d && d >= start && d <= end;
  const [m1, m2, mu1, t1, t2] = await Promise.all([
    fetchDiscoverMovies(apiKey, start, end, region, 1),
    fetchDiscoverMovies(apiKey, start, end, region, 2),
    fetchUpcomingMovies(apiKey, region, 1),
    fetchDiscoverTv(apiKey, start, end, 1),
    fetchDiscoverTv(apiKey, start, end, 2),
  ]);
  const movieP1 = [...m1, ...m2, ...mu1.filter((m) => inRange(m.release_date))];
  const movieP2: DiscoverMovieRow[] = [];
  const tvP1 = [...t1, ...t2];
  const tvP2: DiscoverTvRow[] = [];
  const movies: CalendarItem[] = [...movieP1, ...movieP2]
    .filter((m) => m.release_date && m.title)
    .map((m) => ({
      id: `tmdb:movie:${m.id}`,
      imdbId: null,
      type: "movie" as const,
      name: m.title || m.original_title || "Untitled",
      poster: POSTER(m.poster_path),
      background: BACKDROP(m.backdrop_path),
      releaseDate: (m.release_date ?? "").slice(0, 10),
      isAnime: isAnimeRow(m),
      overview: m.overview ?? "",
      voteAverage: m.vote_average ?? 0,
    }));
  const series: CalendarItem[] = [...tvP1, ...tvP2]
    .filter((s) => s.first_air_date && s.name)
    .map((s) => ({
      id: `tmdb:tv:${s.id}`,
      imdbId: null,
      type: "tv" as const,
      name: s.name || s.original_name || "Untitled",
      poster: POSTER(s.poster_path),
      background: BACKDROP(s.backdrop_path),
      releaseDate: (s.first_air_date ?? "").slice(0, 10),
      isAnime: isAnimeRow(s),
      overview: s.overview ?? "",
      voteAverage: s.vote_average ?? 0,
    }));
  const all = [...movies, ...series];
  const seen = new Set<string>();
  const deduped: CalendarItem[] = [];
  for (const item of all) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  deduped.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return deduped;
}

export function applyCalendarFilter(items: CalendarItem[], filter: CalendarFilter): CalendarItem[] {
  if (filter === "all") return items;
  if (filter === "anime") return items.filter((i) => i.isAnime);
  if (filter === "movie") return items.filter((i) => i.type === "movie" && !i.isAnime);
  return items.filter((i) => i.type === "tv" && !i.isAnime);
}

export function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const out = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (!item.releaseDate) continue;
    const list = out.get(item.releaseDate) ?? [];
    list.push(item);
    out.set(item.releaseDate, list);
  }
  return out;
}

type PersonCreditRow = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
};

type TrackedPerson = {
  id: number;
  name: string;
  role: "any" | "acting" | "directing";
};

async function fetchPersonCredits(
  apiKey: string,
  personId: number,
  kind: "movie" | "tv",
): Promise<PersonCreditRow[]> {
  const url = new URL(`${TMDB}/person/${personId}/${kind}_credits`);
  url.searchParams.set("api_key", apiKey);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = (await res.json()) as { cast?: PersonCreditRow[]; crew?: PersonCreditRow[] };
    return [...(json.cast ?? []), ...(json.crew ?? [])];
  } catch {
    return [];
  }
}

function inWindow(date: string | undefined, start: string, end: string): boolean {
  if (!date) return false;
  const s = date.slice(0, 10);
  return s >= start && s <= end;
}

export async function fetchPersonUpcoming(
  apiKey: string,
  person: TrackedPerson,
  start: string,
  end: string,
): Promise<CalendarItem[]> {
  if (!apiKey) return [];
  const [movies, tv] = await Promise.all([
    fetchPersonCredits(apiKey, person.id, "movie"),
    fetchPersonCredits(apiKey, person.id, "tv"),
  ]);
  void person.role;
  const items: CalendarItem[] = [];
  const seen = new Set<string>();
  for (const m of movies) {
    if (!inWindow(m.release_date, start, end)) continue;
    const id = `tmdb:movie:${m.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      imdbId: null,
      type: "movie",
      name: m.title || m.original_title || "Untitled",
      poster: POSTER(m.poster_path),
      background: BACKDROP(m.backdrop_path),
      releaseDate: (m.release_date ?? "").slice(0, 10),
      isAnime: isAnimeRow(m),
      overview: m.overview ?? "",
      voteAverage: m.vote_average ?? 0,
    });
  }
  for (const s of tv) {
    if (!inWindow(s.first_air_date, start, end)) continue;
    const id = `tmdb:tv:${s.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      imdbId: null,
      type: "tv",
      name: s.name || s.original_name || "Untitled",
      poster: POSTER(s.poster_path),
      background: BACKDROP(s.backdrop_path),
      releaseDate: (s.first_air_date ?? "").slice(0, 10),
      isAnime: isAnimeRow(s),
      overview: s.overview ?? "",
      voteAverage: s.vote_average ?? 0,
    });
  }
  return items;
}

async function discoverFiltered(opts: {
  apiKey: string;
  start: string;
  end: string;
  region: string;
  kind: "movie" | "tv";
  genreIds: number[];
  providerIds: number[];
  countryCodes: string[];
}): Promise<CalendarItem[]> {
  const { apiKey, start, end, region, kind, genreIds, providerIds, countryCodes } = opts;
  if (genreIds.length === 0 && providerIds.length === 0 && countryCodes.length === 0) return [];
  const url = new URL(`${TMDB}/discover/${kind}`);
  url.searchParams.set("api_key", apiKey);
  if (kind === "movie") {
    url.searchParams.set("primary_release_date.gte", start);
    url.searchParams.set("primary_release_date.lte", end);
    if (region) url.searchParams.set("region", region);
    url.searchParams.set("with_runtime.gte", "30");
  } else {
    url.searchParams.set("first_air_date.gte", start);
    url.searchParams.set("first_air_date.lte", end);
  }
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("include_adult", "false");
  if (genreIds.length) url.searchParams.set("with_genres", genreIds.join(","));
  if (providerIds.length) {
    url.searchParams.set("with_watch_providers", providerIds.join("|"));
    url.searchParams.set("watch_region", region || "US");
  }
  if (countryCodes.length) {
    url.searchParams.set("with_origin_country", countryCodes.join("|"));
  }
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Array<DiscoverMovieRow | DiscoverTvRow> };
    const rows = json.results ?? [];
    return rows.map((r) => {
      if (kind === "movie") {
        const m = r as DiscoverMovieRow;
        return {
          id: `tmdb:movie:${m.id}`,
          imdbId: null,
          type: "movie" as const,
          name: m.title || m.original_title || "Untitled",
          poster: POSTER(m.poster_path),
          background: BACKDROP(m.backdrop_path),
          releaseDate: (m.release_date ?? "").slice(0, 10),
          isAnime: isAnimeRow(m),
          overview: m.overview ?? "",
          voteAverage: m.vote_average ?? 0,
        };
      }
      const s = r as DiscoverTvRow;
      return {
        id: `tmdb:tv:${s.id}`,
        imdbId: null,
        type: "tv" as const,
        name: s.name || s.original_name || "Untitled",
        poster: POSTER(s.poster_path),
        background: BACKDROP(s.backdrop_path),
        releaseDate: (s.first_air_date ?? "").slice(0, 10),
        isAnime: isAnimeRow(s),
        overview: s.overview ?? "",
        voteAverage: s.vote_average ?? 0,
      };
    });
  } catch {
    return [];
  }
}

export type CustomCalendarFilters = {
  trackedPeople: TrackedPerson[];
  genres: Array<{ id: number; name: string; mediaType: "movie" | "tv" }>;
  watchProviders: Array<{ id: number; name: string }>;
  originCountries: string[];
  mediaTypes: { movie: boolean; tv: boolean; anime: boolean };
};

export async function fetchCustomCalendar(opts: {
  apiKey: string;
  region: string;
  filters: CustomCalendarFilters;
  start: string;
  end: string;
  extra?: CalendarItem[];
}): Promise<CalendarItem[]> {
  const { apiKey, region, filters, start, end, extra = [] } = opts;
  const movieGenres = filters.genres.filter((g) => g.mediaType === "movie").map((g) => g.id);
  const tvGenres = filters.genres.filter((g) => g.mediaType === "tv").map((g) => g.id);
  const providerIds = filters.watchProviders.map((p) => p.id);

  const wantMovie = filters.mediaTypes.movie;
  const wantTv = filters.mediaTypes.tv;
  const wantAnime = filters.mediaTypes.anime;

  const tasks: Promise<CalendarItem[]>[] = filters.trackedPeople.map((p) =>
    fetchPersonUpcoming(apiKey, p, start, end),
  );
  if (wantMovie || wantAnime) {
    tasks.push(
      discoverFiltered({
        apiKey,
        start,
        end,
        region,
        kind: "movie",
        genreIds: movieGenres,
        providerIds,
        countryCodes: filters.originCountries,
      }),
    );
  }
  if (wantTv || wantAnime) {
    tasks.push(
      discoverFiltered({
        apiKey,
        start,
        end,
        region,
        kind: "tv",
        genreIds: tvGenres,
        providerIds,
        countryCodes: filters.originCountries,
      }),
    );
  }
  const batches = await Promise.all(tasks);
  const all = [...extra, ...batches.flat()];

  const filterMatches = (i: CalendarItem): boolean => {
    if (i.isAnime) return wantAnime;
    if (i.type === "movie") return wantMovie;
    if (i.type === "tv") return wantTv;
    return false;
  };

  const seen = new Set<string>();
  const deduped: CalendarItem[] = [];
  for (const item of all) {
    if (!filterMatches(item)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  deduped.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return deduped;
}

export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthRangeISO(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
}

export type WebhookPayload = {
  text: string;
  items: CalendarItem[];
};

export type WebhookKind = "discord" | "telegram" | "desktop";

const DESKTOP_NOTIFY_CAP = 10;
const POSTER_FETCH_TIMEOUT_MS = 8000;
const POSTER_MAX_BYTES = 2 * 1024 * 1024;
const HARBOR_ICON_PATH = "/favicon.png";

function desktopNotifyBody(item: CalendarItem): string {
  const date = formatAirDate(item.releaseDate) || item.releaseDate;
  return item.releaseTime ? `${date} · ${item.releaseTime}` : date;
}

async function fetchPosterBytes(url: string): Promise<number[] | undefined> {
  try {
    // A same-origin app asset (e.g. the Harbor icon) lives inside the webview's
    // own bundle — safeFetchBytes's native-fetch routing is for external CDNs
    // and can't reach it, so read it with a plain same-origin fetch instead.
    const res = url.startsWith("/")
      ? await window.fetch(url)
      : await safeFetchBytes(url, undefined, POSTER_FETCH_TIMEOUT_MS, POSTER_MAX_BYTES);
    if (!res.ok) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 0 ? Array.from(bytes) : undefined;
  } catch {
    return undefined;
  }
}

function isDesktopTauri(): boolean {
  return isWindowsDesktop() || isMacDesktop() || isLinuxDesktop();
}

export async function ensureDesktopNotifyPermission(): Promise<boolean> {
  if (isWeb()) return ensureNotifyPermission();
  try {
    if (await tauriNotifyGranted()) return true;
    return (await tauriNotifyRequest()) === "granted";
  } catch {
    return false;
  }
}

/** Read permission for automatic events without prompting the user. */
export async function hasDesktopNotifyPermission(): Promise<boolean> {
  return automaticNotificationPermission(isDesktopTauri(), "Notification" in window ? Notification.permission : undefined,
    () => invoke<boolean | null>("plugin:notification|is_permission_granted"));
}

function detailDeepLink(item: CalendarItem): string | undefined {
  if (!item.imdbId) return undefined;
  const metaType = item.type === "tv" ? "series" : "movie";
  return `harbor://detail/${metaType}/${encodeURIComponent(item.imdbId)}`;
}

export async function sendDesktopNotification(
  title: string,
  body: string,
  deepLink?: string,
  posterUrl?: string,
): Promise<boolean> {
  if (isWeb()) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return false;
      const n = new Notification(title, { body, icon: posterUrl || undefined });
      n.onclick = () => {
        if (deepLink) {
          const open = parseHarborOpen(deepLink);
          if (open) emitDeepLinkOpen(open);
        }
        void focusWindow();
        n.close();
      };
      return true;
    } catch {
      return false;
    }
  }
  if (isDesktopTauri()) {
    try {
      const imageBytes = posterUrl ? await fetchPosterBytes(posterUrl) : undefined;
      await invoke("send_clickable_notification", {
        title,
        body,
        deepLink: deepLink ?? null,
        imageBytes: imageBytes ?? null,
      });
      return true;
    } catch {
      return false;
    }
  }
  try {
    tauriSendNotification({ title, body });
    return true;
  } catch {
    return false;
  }
}

export async function fireWebhook(
  kind: WebhookKind,
  url: string,
  payload: WebhookPayload,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  if (kind === "desktop") {
    const granted = await ensureDesktopNotifyPermission();
    if (!granted) {
      return { ok: false, status: 0, error: "Notifications permission not granted" };
    }
    let delivered = 0;
    let attempted = 0;
    if (payload.items.length === 0) {
      attempted = 1;
      if (await sendDesktopNotification("Harbor", payload.text, undefined, HARBOR_ICON_PATH)) {
        delivered = 1;
      }
    } else {
      for (const i of payload.items.slice(0, DESKTOP_NOTIFY_CAP)) {
        attempted++;
        const tag = i.isAnime ? "🍙" : i.type === "movie" ? "🎬" : "📺";
        if (
          await sendDesktopNotification(
            `${tag} ${i.name}`,
            desktopNotifyBody(i),
            detailDeepLink(i),
            i.poster ?? undefined,
          )
        ) {
          delivered++;
        }
      }
      if (payload.items.length > DESKTOP_NOTIFY_CAP) {
        attempted++;
        if (await sendDesktopNotification("Harbor", payload.text)) delivered++;
      }
    }
    if (delivered === 0) {
      return { ok: false, status: 0, error: "Failed to show notification" };
    }
    return {
      ok: true,
      status: 0,
      error:
        delivered < attempted ? `${attempted - delivered} notification(s) failed to show` : null,
    };
  }
  if (!url) return { ok: false, status: 0, error: "No URL configured" };
  try {
    if (kind === "discord") {
      const embeds = payload.items.slice(0, 10).map((i) => ({
        title: i.name,
        description: (i.overview || "").slice(0, 240),
        url: i.imdbId ? `https://www.imdb.com/title/${i.imdbId}` : undefined,
        color: i.type === "movie" ? 0xd3a064 : 0x7eb6ff,
        thumbnail: i.poster ? { url: i.poster } : undefined,
        fields: [
          {
            name: "Release",
            value: i.releaseDate,
            inline: true,
          },
          {
            name: "Type",
            value: i.isAnime ? "Anime" : i.type === "movie" ? "Movie" : "TV",
            inline: true,
          },
        ],
      }));
      const body: Record<string, unknown> = {
        username: "JL Media Vision",
        content: payload.text,
      };
      if (embeds.length > 0) body.embeds = embeds;
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
    }
    if (kind === "telegram") {
      const lines = [payload.text, ""];
      for (const i of payload.items.slice(0, 8)) {
        const tag = i.isAnime ? "🍙" : i.type === "movie" ? "🎬" : "📺";
        lines.push(`${tag} *${i.name}* · ${i.releaseDate}`);
      }
      const text = lines.join("\n");
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: extractTelegramChatId(url),
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      });
      return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
    }
    return { ok: false, status: 0, error: "Unknown webhook kind" };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

function extractTelegramChatId(url: string): string {
  const m = url.match(/[?&]chat_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function resolveImdbForItem(
  apiKey: string,
  item: CalendarItem,
): Promise<string | null> {
  if (!apiKey) return null;
  const m = item.id.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!m) return null;
  return tmdbImdbId(apiKey, item.id);
}

const LAST_FIRED_KEY = "harbor.calendar.webhook.last";
const LAST_FIRED_MAX_ENTRIES = 5000;

export type LastFiredState = Record<string, string>;

export function loadLastFiredState(): LastFiredState {
  try {
    const raw = localStorage.getItem(LAST_FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as LastFiredState;
  } catch {
    return {};
  }
}

function capState(state: LastFiredState): LastFiredState {
  const keys = Object.keys(state);
  if (keys.length <= LAST_FIRED_MAX_ENTRIES) return state;
  const sorted = keys.sort((a, b) => {
    const byDate = state[b].localeCompare(state[a]);
    if (byDate !== 0) return byDate;
    if (a.startsWith("__baseline__") !== b.startsWith("__baseline__")) {
      return a.startsWith("__baseline__") ? -1 : 1;
    }
    return a.localeCompare(b);
  });
  const kept: LastFiredState = {};
  for (const k of sorted.slice(0, LAST_FIRED_MAX_ENTRIES)) kept[k] = state[k];
  return kept;
}

export function saveLastFiredState(state: LastFiredState): boolean {
  const capped = capState(state);
  return setItemWithRecovery(LAST_FIRED_KEY, JSON.stringify(capped));
}
