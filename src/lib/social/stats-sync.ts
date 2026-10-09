import { useEffect, useState } from "react";
import { authToken } from "@/lib/theme-auth";
import { socialPost } from "./client";
import {
  computeWatchedBreakdown,
  isWatchedItem,
  type WatchedBreakdown,
} from "./watched-breakdown";

export { computeWatchedBreakdown, isWatchedItem };
export type { WatchedBreakdown };

export async function computeWatchedCount(authKey?: string | null): Promise<number | null> {
  const bd = await computeWatchedBreakdown(authKey);
  return bd ? bd.watched : null;
}

export async function pushStats(
  watched: number | null,
  mangaRead: number | null,
  moviesWatched?: number | null,
  episodesWatched?: number | null,
  minutesWatched?: number | null,
): Promise<void> {
  if (!authToken()) return;
  const body: Record<string, number | boolean> = {};
  if (typeof watched === "number" && watched >= 0) body.watched = watched;
  if (typeof mangaRead === "number" && mangaRead >= 0) body.mangaRead = mangaRead;
  if (typeof moviesWatched === "number" && moviesWatched >= 0) body.moviesWatched = moviesWatched;
  if (typeof episodesWatched === "number" && episodesWatched >= 0)
    body.episodesWatched = episodesWatched;
  if (typeof minutesWatched === "number" && minutesWatched >= 0)
    body.minutesWatched = minutesWatched;
  if (!Object.keys(body).length) return;
  body.authoritative = true;
  try {
    await socialPost("/social/u/me/stats", body);
  } catch {
    return;
  }
}

export async function syncProfileStats(
  authKey: string | null | undefined,
  mangaRead: number,
): Promise<void> {
  const bd = await computeWatchedBreakdown(authKey);
  const watched = bd ? bd.watched : null;
  const movies = bd ? bd.moviesWatched : null;
  const episodes = bd ? bd.episodesWatched : null;
  const minutes = bd ? bd.minutesWatched : null;

  await pushStats(watched, mangaRead, movies, episodes, minutes);
}

export function useLibraryWatchedCount(
  authKey: string | null | undefined,
  enabled: boolean,
): number {
  const bd = useLibraryWatchedBreakdown(authKey, enabled);
  return bd.watched;
}

export function useLibraryWatchedBreakdown(
  authKey: string | null | undefined,
  enabled: boolean,
): WatchedBreakdown & { ready: boolean } {
  const [breakdown, setBreakdown] = useState<WatchedBreakdown & { ready: boolean }>({
    watched: 0,
    moviesWatched: 0,
    episodesWatched: 0,
    minutesWatched: 0,
    ready: false,
  });

  useEffect(() => {
    if (!enabled) {
      setBreakdown({
        watched: 0,
        moviesWatched: 0,
        episodesWatched: 0,
        minutesWatched: 0,
        ready: false,
      });
      return;
    }
    let alive = true;
    computeWatchedBreakdown(authKey).then((res) => {
      if (alive && res) setBreakdown({ ...res, ready: true });
    });
    return () => {
      alive = false;
    };
  }, [authKey, enabled]);

  return breakdown;
}
