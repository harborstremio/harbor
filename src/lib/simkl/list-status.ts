import { activeProfileId } from "@/lib/active-profile-id";
import { currentActivitiesAll } from "./activities/gate";
import { simklRequest } from "./client";
import { simklTargetIds } from "./ids";
import { getSession, subscribeSession } from "./session";
import type { SimklTarget } from "./types";
import type { LibraryItem } from "@/lib/stremio";

export type WatchlistStatus = "watching" | "plantowatch" | "hold" | "completed" | "dropped";

export const SIMKL_STATUS_LABELS: Record<WatchlistStatus, string> = {
  watching: "Watching",
  plantowatch: "Plan to Watch",
  hold: "On Hold",
  completed: "Completed",
  dropped: "Dropped",
};

export const SHOW_STATUS_ORDER: WatchlistStatus[] = [
  "watching",
  "plantowatch",
  "completed",
  "hold",
  "dropped",
];
export const MOVIE_STATUS_ORDER: WatchlistStatus[] = ["plantowatch", "completed", "dropped"];

type RawIds = {
  simkl?: number;
  imdb?: string;
  tmdb?: number | string;
  mal?: number | string;
  kitsu?: number | string;
  anilist?: number | string;
  anidb?: number | string;
};
type RawEpisode = {
  number?: number;
  watched_at?: string | null;
  tvdb?: { season?: number; episode?: number };
};
type RawSeason = { number?: number; episodes?: RawEpisode[] };
type RawNode = { title?: string; ids?: RawIds };
type RawEntry = {
  status?: string;
  movie?: RawNode;
  show?: RawNode;
  anime?: RawNode;
  seasons?: RawSeason[];
};
type RawAllItems = { movies?: RawEntry[]; shows?: RawEntry[]; anime?: RawEntry[] };

export type SimklProgress = {
  statuses: Map<string, WatchlistStatus>;
  watched: Map<string, Set<string>>;
  watchedAt: Map<string, Map<string, number>>;
  completedSeries: LibraryItem[];
};

function isStatus(s: string | undefined): s is WatchlistStatus {
  return (
    s === "watching" || s === "plantowatch" || s === "hold" || s === "completed" || s === "dropped"
  );
}

function idKeys(ids: RawIds | undefined, kind: "movie" | "show"): string[] {
  if (!ids) return [];
  const keys: string[] = [];
  if (ids.imdb) keys.push(ids.imdb);
  if (ids.tmdb != null)
    keys.push(kind === "movie" ? `tmdb:movie:${ids.tmdb}` : `tmdb:tv:${ids.tmdb}`);
  if (ids.mal != null) keys.push(`mal:${ids.mal}`);
  if (ids.kitsu != null) keys.push(`kitsu:${ids.kitsu}`);
  if (ids.anilist != null) keys.push(`anilist:${ids.anilist}`);
  if (ids.anidb != null) keys.push(`anidb:${ids.anidb}`);
  return keys;
}

function targetKeys(target: SimklTarget): string[] {
  const ids = simklTargetIds(target);
  return idKeys(ids as RawIds, target.kind === "movie" ? "movie" : "show");
}

let cache: Promise<SimklProgress> | null = null;
let cacheMarker: string | null = null;
let sessionGeneration = 0;

subscribeSession(() => {
  sessionGeneration += 1;
  cache = null;
  cacheMarker = null;
});

async function pull(): Promise<SimklProgress> {
  const data = await simklRequest<RawAllItems | null>(
    "/sync/all-items/all/all?extended=full_anime_seasons&episode_watched_at=yes",
  );
  const statuses = new Map<string, WatchlistStatus>();
  const watched = new Map<string, Set<string>>();
  const watchedAt = new Map<string, Map<string, number>>();
  const completedSeries: LibraryItem[] = [];
  const add = (entries: RawEntry[] | undefined, kind: "movie" | "show", isAnime = false) => {
    for (const e of entries ?? []) {
      const node = kind === "movie" ? e.movie : (e.show ?? e.anime);
      const keys = idKeys(node?.ids, kind);
      if (keys.length === 0) continue;
      if (isStatus(e.status)) for (const k of keys) statuses.set(k, e.status);
      if (kind === "show" && e.seasons) {
        const eps = new Set<string>();
        const times = new Map<string, number>();
        for (const s of e.seasons) {
          for (const ep of s.episodes ?? []) {
            if (ep.watched_at && s.number != null && ep.number != null) {
              const key = `${s.number}:${ep.number}`;
              eps.add(key);
              const at = Date.parse(ep.watched_at);
              if (Number.isFinite(at) && at > 0) times.set(key, at);
            }
          }
        }
        for (const k of keys) {
          // Anime provider IDs address a season; IMDb/TMDB address the franchise.
          // Only the explicit TVDB mapping can translate between those coordinates.
          const mapped = isAnime && !/^(mal|kitsu|anilist|anidb):/.test(k);
          const keyEps = mapped ? new Set<string>() : eps;
          const keyTimes = mapped ? new Map<string, number>() : times;
          if (mapped)
            for (const s of e.seasons)
              for (const ep of s.episodes ?? []) {
                if (!ep.watched_at || ep.tvdb?.season == null || ep.tvdb.episode == null) continue;
                const key = `${ep.tvdb.season}:${ep.tvdb.episode}`;
                keyEps.add(key);
                const at = Date.parse(ep.watched_at);
                if (Number.isFinite(at) && at > 0) keyTimes.set(key, at);
              }
          if (keyEps.size)
            watched.set(k, watched.has(k) ? new Set([...watched.get(k)!, ...keyEps]) : keyEps);
          if (keyTimes.size) {
            const merged = watchedAt.has(k) ? new Map(watchedAt.get(k)) : keyTimes;
            for (const [episode, at] of keyTimes)
              merged.set(episode, Math.max(merged.get(episode) ?? 0, at));
            watchedAt.set(k, merged);
          }
        }
        const latest = [...times]
          .filter(([key]) =>
            key.split(":").every((n) => Number.isInteger(Number(n)) && Number(n) > 0),
          )
          .sort((a, b) => b[1] - a[1])[0];
        const anchorId = isAnime ? keys.find((k) => /^(kitsu|mal|anilist):/.test(k)) : keys[0];
        if (
          anchorId &&
          latest &&
          node?.title &&
          (e.status === "watching" || e.status === "completed")
        ) {
          const [season, episode] = latest[0].split(":").map(Number);
          if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 1 || episode < 1)
            continue;
          const when = new Date(latest[1]).toISOString();
          completedSeries.push({
            _id: anchorId,
            type: "series",
            name: node.title,
            isAnime,
            state: {
              season,
              episode,
              video_id: `${anchorId}:${season}:${episode}`,
              timeOffset: 0,
              duration: 0,
              flaggedWatched: 1,
              lastWatched: when,
            },
            removed: false,
            temp: false,
            _ctime: when,
            _mtime: when,
            external: "simkl",
          });
        }
      }
    }
  };
  add(data?.movies, "movie");
  add(data?.shows, "show");
  add(data?.anime, "show", true);
  return { statuses, watched, watchedAt, completedSeries };
}

async function loadData(): Promise<SimklProgress> {
  const generation = sessionGeneration;
  const all = await currentActivitiesAll();
  if (generation !== sessionGeneration) throw new Error("SIMKL session changed");
  if (!cache || (all !== null && all !== cacheMarker)) {
    const request = pull()
      .then((data) => {
        if (generation !== sessionGeneration) throw new Error("SIMKL session changed");
        rememberSimklWatched(data.watched);
        return data;
      })
      .catch((error: unknown) => {
        // A failed pull is not an empty library. Retry it on the next read, without
        // allowing an older account's completion to clear a newer account's cache.
        if (cache === request) {
          cache = null;
          cacheMarker = null;
        }
        throw error;
      });
    cache = request;
    cacheMarker = all;
  }
  return cache;
}

export async function loadSimklProgress(): Promise<SimklProgress> {
  return loadData();
}

export async function loadSimklStatusMap(): Promise<Map<string, WatchlistStatus>> {
  return (await loadData()).statuses;
}

export async function loadSimklWatchedMap(): Promise<Map<string, Set<string>>> {
  return (await loadData()).watched;
}

function simklWatchedKey(): string {
  return `harbor.simkl.watched.v1.${activeProfileId()}`;
}

// Synchronous starting point for the first paint. The async load still runs and replaces
// this, so a stale copy can only delay a card, never leave it permanently wrong.
export function peekSimklWatchedMap(): Map<string, Set<string>> {
  if (typeof localStorage === "undefined") return new Map();
  try {
    const saved = JSON.parse(localStorage.getItem(simklWatchedKey()) ?? "null");
    if (
      !saved ||
      !saved.account ||
      saved.account !== getSession()?.username ||
      typeof saved.at !== "number" ||
      Date.now() - saved.at > 86400000
    )
      return new Map();
    const raw: unknown = saved.watched;
    if (!raw || typeof raw !== "object") return new Map();
    const map = new Map<string, Set<string>>();
    for (const [key, episodes] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(episodes)) {
        map.set(key, new Set(episodes.filter((e): e is string => typeof e === "string")));
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function rememberSimklWatched(watched: Map<string, Set<string>>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const flat: Record<string, string[]> = {};
    for (const [key, episodes] of watched) flat[key] = [...episodes];
    localStorage.setItem(
      simklWatchedKey(),
      JSON.stringify({ account: getSession()?.username, at: Date.now(), watched: flat }),
    );
  } catch {
    /* ignore quota */
  }
}

export function statusForId(map: Map<string, WatchlistStatus>, id: string): WatchlistStatus | null {
  return map.get(id) ?? null;
}

export function simklWatchedForId(
  map: Map<string, Set<string>>,
  ...ids: Array<string | null | undefined>
): Set<string> {
  for (const id of ids) {
    if (!id) continue;
    const set = map.get(id);
    if (set) return set;
  }
  return new Set();
}

export async function setSimklStatus(
  target: SimklTarget,
  status: WatchlistStatus,
): Promise<WatchlistStatus> {
  const ids = simklTargetIds(target);
  const bucket = target.kind === "movie" ? "movies" : "shows";
  const r = await simklRequest<{ added?: Record<string, Array<{ to?: string }>> }>(
    "/sync/add-to-list",
    { method: "POST", body: { to: status, [bucket]: [{ to: status, ids }] } },
  );
  const echoed = r?.added?.[bucket]?.[0]?.to;
  const final = isStatus(echoed) ? echoed : status;
  const statuses = await loadData()
    .then((data) => data.statuses)
    .catch(() => null);
  if (statuses) for (const k of targetKeys(target)) statuses.set(k, final);
  return final;
}

export async function clearSimklStatus(target: SimklTarget): Promise<void> {
  const ids = simklTargetIds(target);
  const bucket = target.kind === "movie" ? "movies" : "shows";
  await simklRequest("/sync/history/remove", { method: "POST", body: { [bucket]: [{ ids }] } });
  const statuses = await loadData()
    .then((data) => data.statuses)
    .catch(() => null);
  if (statuses) for (const k of targetKeys(target)) statuses.delete(k);
}
