import { useEffect, useState } from "react";
import { movieWatchedIds } from "@/lib/movie-watched";
import { watchedFlagIds } from "@/lib/watched-flag";
import { library, type LibraryItem } from "@/lib/stremio";
import { authToken } from "@/lib/theme-auth";
import { socialPost } from "./client";

export function isWatchedItem(i: LibraryItem): boolean {
  const s = i.state;
  if (!s) return false;
  if ((s.flaggedWatched ?? 0) >= 1) return true;
  if ((s.timesWatched ?? 0) >= 1) return true;
  if (s.watched) return true;
  if (s.lastWatched && Number.isFinite(Date.parse(s.lastWatched))) return true;
  return false;
}

export type WatchedBreakdown = {
  watched: number;
  moviesWatched: number;
  episodesWatched: number;
  minutesWatched: number;
};

export async function computeWatchedCount(authKey?: string | null): Promise<number | null> {
  const bd = await computeWatchedBreakdown(authKey);
  return bd ? bd.watched : null;
}

export async function computeWatchedBreakdown(authKey?: string | null): Promise<WatchedBreakdown | null> {
  const movieIds = new Set<string>();
  const episodeKeys = new Set<string>();
  const allWatchedIds = new Set<string>();
  let totalWatchMs = 0;

  // 1. Try Stremio Library if authKey is provided
  if (authKey) {
    try {
      const lib = await library(authKey);
      for (const i of lib) {
        if (!i._id) continue;
        const st = i.state as Record<string, unknown> | undefined;
        const watchTime = typeof st?.overallTimeWatched === "number" ? st.overallTimeWatched : typeof st?.timeWatched === "number" ? st.timeWatched : 0;
        if (watchTime > 0) {
          totalWatchMs += watchTime;
        }

        if (!isWatchedItem(i)) continue;
        allWatchedIds.add(i._id);

        if (i.type === "movie") {
          movieIds.add(i._id);
        } else {
          const watchedStr = i.state?.watched ?? "";
          if (typeof watchedStr === "string" && watchedStr.trim().length > 0) {
            const parts = watchedStr.split(",").filter((p) => p.trim().length > 0);
            for (const p of parts) {
              episodeKeys.add(`${i._id}:${p.trim()}`);
            }
          } else if (i.state?.video_id) {
            episodeKeys.add(`${i._id}:${i.state.video_id}`);
          } else {
            episodeKeys.add(`${i._id}:default`);
          }
        }
      }
    } catch {
      // ignore network/auth errors for cloud library
    }
  }

  // 2. Include local movie watched flags (harbor.moviewatched.v1)
  try {
    for (const id of movieWatchedIds()) {
      allWatchedIds.add(id);
      movieIds.add(id);
    }
  } catch {
    // ignore
  }

  // 3. Include local watched flags (harbor.watchedFlag.v1)
  try {
    for (const id of watchedFlagIds()) {
      allWatchedIds.add(id);
    }
  } catch {
    // ignore
  }

  // 4. Include manual watched episodes (harbor.manualwatched.v1)
  try {
    const raw = localStorage.getItem("harbor.manualwatched.v1");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const key of arr) {
          if (typeof key !== "string") continue;
          const parts = key.split(":");
          const metaId = parts[0];
          if (!metaId) continue;
          allWatchedIds.add(metaId);
          if (parts.length > 1) {
            episodeKeys.add(key);
          } else if (!movieIds.has(metaId)) {
            movieIds.add(metaId);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 5. Include fresh watched episodes (harbor.stremio.freshwatched.v1)
  try {
    const raw = localStorage.getItem("harbor.stremio.freshwatched.v1");
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, { watched?: string | null }>;
      if (obj && typeof obj === "object") {
        for (const [id, v] of Object.entries(obj)) {
          if (!id) continue;
          allWatchedIds.add(id);
          if (typeof v?.watched === "string" && v.watched.trim().length > 0) {
            const parts = v.watched.split(",").filter((p) => p.trim().length > 0);
            for (const p of parts) {
              episodeKeys.add(`${id}:${p.trim()}`);
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 6. Include local playback history (harbor.playback-history.v1)
  try {
    const raw = localStorage.getItem("harbor.playback-history.v1");
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const key of Object.keys(parsed)) {
        const parts = key.split("|");
        const metaId = parts[0];
        if (!metaId) continue;
        allWatchedIds.add(metaId);
        if (parts.length > 1) {
          episodeKeys.add(`${metaId}:${parts[1]}`);
        } else if (!episodeKeys.has(metaId)) {
          movieIds.add(metaId);
        }
      }
    }
  } catch {
    // ignore
  }

  // 7. Include local resume times (harbor.resume) for watch time calculation
  try {
    const raw = localStorage.getItem("harbor.resume");
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { ms?: number }>;
      for (const [key, entry] of Object.entries(parsed)) {
        if (typeof entry?.ms === "number" && entry.ms > 0) {
          totalWatchMs += entry.ms;
        }
        const parts = key.split("|");
        const metaId = parts[0];
        if (!metaId) continue;
        allWatchedIds.add(metaId);
        if (parts.length > 1) {
          episodeKeys.add(`${metaId}:${parts[1]}`);
        }
      }
    }
  } catch {
    // ignore
  }

  const minutesWatched = Math.floor(totalWatchMs / 60000);

  return {
    watched: allWatchedIds.size,
    moviesWatched: movieIds.size,
    episodesWatched: episodeKeys.size,
    minutesWatched,
  };
}

export async function pushStats(
  watched: number | null,
  mangaRead: number | null,
  moviesWatched?: number | null,
  episodesWatched?: number | null,
  minutesWatched?: number | null,
): Promise<void> {
  if (!authToken()) return;
  const body: Record<string, number> = {};
  if (typeof watched === "number" && watched >= 0) body.watched = watched;
  if (typeof mangaRead === "number" && mangaRead >= 0) body.mangaRead = mangaRead;
  if (typeof moviesWatched === "number" && moviesWatched >= 0) body.moviesWatched = moviesWatched;
  if (typeof episodesWatched === "number" && episodesWatched >= 0) body.episodesWatched = episodesWatched;
  if (typeof minutesWatched === "number" && minutesWatched >= 0) body.minutesWatched = minutesWatched;
  if (!Object.keys(body).length) return;
  try {
    await socialPost("/social/u/me/stats", body);
  } catch {
    return;
  }
}

export async function syncProfileStats(authKey: string | null | undefined, mangaRead: number): Promise<void> {
  const bd = await computeWatchedBreakdown(authKey);
  const watched = bd ? bd.watched : null;
  const movies = bd ? bd.moviesWatched : null;
  const episodes = bd ? bd.episodesWatched : null;
  const minutes = bd ? bd.minutesWatched : null;

  await pushStats(watched, mangaRead, movies, episodes, minutes);
}

export function useLibraryWatchedCount(authKey: string | null | undefined, enabled: boolean): number {
  const bd = useLibraryWatchedBreakdown(authKey, enabled);
  return bd.watched;
}

export function useLibraryWatchedBreakdown(
  authKey: string | null | undefined,
  enabled: boolean,
): WatchedBreakdown {
  const [breakdown, setBreakdown] = useState<WatchedBreakdown>({
    watched: 0,
    moviesWatched: 0,
    episodesWatched: 0,
    minutesWatched: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setBreakdown({ watched: 0, moviesWatched: 0, episodesWatched: 0, minutesWatched: 0 });
      return;
    }
    let alive = true;
    computeWatchedBreakdown(authKey).then((res) => {
      if (alive && res) setBreakdown(res);
    });
    return () => {
      alive = false;
    };
  }, [authKey, enabled]);

  return breakdown;
}
