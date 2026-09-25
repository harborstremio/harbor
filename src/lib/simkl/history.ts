import { resolveForMeta } from "@/lib/tracker-resolve";
import { currentActivitiesAll } from "./activities/gate";
import { simklRequest } from "./client";
import { simklTargetIds } from "./ids";
import type { SimklIds, SimklTarget } from "./types";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

export type SimklHistoryItem = {
  id: number;
  watchedAt: string;
  type: "movie" | "episode";
  imdb?: string;
  tmdb?: number;
  title: string;
  year: number | null;
  showImdb?: string;
  showTmdb?: number;
  season?: number;
  number?: number;
};

type RawIds = { simkl?: number; imdb?: string; tmdb?: number | string };
type RawNode = { title?: string; year?: number | null; ids?: RawIds };
type RawEntry = { last_watched_at?: string; movie?: RawNode; show?: RawNode };
type RawAllItems = { movies?: RawEntry[]; shows?: RawEntry[]; anime?: RawEntry[] };

function num(v: number | string | undefined): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const HISTORY_TTL_MS = 25000;
let historyCache: { at: number; val: Promise<SimklHistoryItem[]> } | null = null;
let historyMarker: string | null = null;

export function invalidateHistoryCache(): void {
  historyCache = null;
}

async function loadHistory(): Promise<SimklHistoryItem[]> {
  const all = await currentActivitiesAll();
  if (historyCache) {
    if (all !== null && all === historyMarker) return historyCache.val;
    if (all === null && Date.now() - historyCache.at < HISTORY_TTL_MS) return historyCache.val;
  }
  const val = pullHistory();
  historyCache = { at: Date.now(), val };
  historyMarker = all;
  return val;
}

export async function fetchWatchedHistory(limit = 200): Promise<SimklHistoryItem[]> {
  return (await loadHistory()).slice(0, limit);
}

async function pullHistory(): Promise<SimklHistoryItem[]> {
  const data = await simklRequest<RawAllItems>(
    "/sync/all-items/all/completed?extended=full",
  ).catch(() => ({}) as RawAllItems);
  const out: SimklHistoryItem[] = [];
  for (const e of data.movies ?? []) {
    const m = e.movie;
    if (!m) continue;
    out.push({
      id: m.ids?.simkl ?? 0,
      watchedAt: e.last_watched_at ?? "",
      type: "movie",
      title: m.title ?? "",
      year: m.year ?? null,
      imdb: m.ids?.imdb,
      tmdb: num(m.ids?.tmdb),
    });
  }
  for (const e of [...(data.shows ?? []), ...(data.anime ?? [])]) {
    const s = e.show;
    if (!s) continue;
    out.push({
      id: s.ids?.simkl ?? 0,
      watchedAt: e.last_watched_at ?? "",
      type: "episode",
      title: s.title ?? "",
      year: s.year ?? null,
      showImdb: s.ids?.imdb,
      showTmdb: num(s.ids?.tmdb),
    });
  }
  out.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
  return out;
}

async function postHistory(target: SimklTarget): Promise<boolean> {
  const watchedAt = new Date().toISOString();
  try {
    invalidateHistoryCache();
    if (target.kind === "movie") {
      const r = await simklRequest<{ added?: { movies?: number } }>("/sync/history", {
        method: "POST",
        body: { movies: [{ ids: target.ids, watched_at: watchedAt }] },
      });
      return (r?.added?.movies ?? 0) > 0;
    }
    if (target.kind === "episode") {
      const r = await simklRequest<{ added?: { episodes?: number; shows?: number } }>(
        "/sync/history",
        {
          method: "POST",
          body: {
            shows: [
              {
                ids: target.show.ids,
                seasons: [
                  {
                    number: target.season,
                    episodes: [{ number: target.number, watched_at: watchedAt }],
                  },
                ],
              },
            ],
          },
        },
      );
      return (r?.added?.episodes ?? r?.added?.shows ?? 0) > 0;
    }
    const r = await simklRequest<{ added?: { shows?: number } }>("/sync/history", {
      method: "POST",
      body: { shows: [{ ids: simklTargetIds(target), watched_at: watchedAt }] },
    });
    return (r?.added?.shows ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function addToHistory(target: SimklTarget, metaId?: string): Promise<boolean> {
  if (await postHistory(target)) return true;
  if (!metaId || target.kind !== "episode" || ANIME_ID.test(metaId)) return false;
  const resolved = await resolveForMeta(metaId, target.season, target.number);
  if (!resolved.ok) return false;
  return postHistory({
    kind: "episode",
    show: { ids: resolved.episode.showIds },
    season: resolved.episode.season,
    number: resolved.episode.number,
  });
}

export async function markEpisodesWatched(
  show: SimklIds,
  season: number,
  episodes: number[],
): Promise<boolean> {
  if (episodes.length === 0) return false;
  const watchedAt = new Date().toISOString();
  try {
    invalidateHistoryCache();
    await simklRequest("/sync/history", {
      method: "POST",
      body: {
        shows: [
          {
            ids: show,
            seasons: [
              {
                number: season,
                episodes: episodes.map((n) => ({ number: n, watched_at: watchedAt })),
              },
            ],
          },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function unmarkEpisodeWatched(
  show: SimklIds,
  season: number,
  episode: number,
): Promise<boolean> {
  return unmarkEpisodesWatched(show, season, [episode]);
}

export async function unmarkEpisodesWatched(
  show: SimklIds,
  season: number,
  episodes: number[],
): Promise<boolean> {
  if (episodes.length === 0) return false;
  try {
    invalidateHistoryCache();
    await simklRequest("/sync/history/remove", {
      method: "POST",
      body: {
        shows: [
          { ids: show, seasons: [{ number: season, episodes: episodes.map((n) => ({ number: n })) }] },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}
