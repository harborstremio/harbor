import { simklRequest } from "./client";
import { simklTargetIds } from "./ids";
import type { SimklIds, SimklTarget } from "./types";

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

export async function fetchWatchedHistory(limit = 200): Promise<SimklHistoryItem[]> {
  const data = await simklRequest<RawAllItems>("/sync/all-items/all/completed?extended=full").catch(
    () => ({}) as RawAllItems,
  );
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
  return out.slice(0, limit);
}

export async function addToHistory(target: SimklTarget): Promise<boolean> {
  const watchedAt = new Date().toISOString();
  try {
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

export async function markEpisodesWatched(
  show: SimklIds,
  season: number,
  episodes: number[],
): Promise<boolean> {
  if (episodes.length === 0) return false;
  const watchedAt = new Date().toISOString();
  try {
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
  try {
    await simklRequest("/sync/history/remove", {
      method: "POST",
      body: {
        shows: [{ ids: show, seasons: [{ number: season, episodes: [{ number: episode }] }] }],
      },
    });
    return true;
  } catch {
    return false;
  }
}
