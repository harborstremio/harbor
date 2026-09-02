import { movieWatchedIds } from "@/lib/movie-watched";
import { watchedFlagIds } from "@/lib/watched-flag";
import { manualWatchedRawKeys } from "@/lib/manual-watched";
import { playbackHistoryRawKeys } from "@/lib/playback-history";
import { freshWatchedIds } from "@/lib/stremio-watched-sync";
import { library, type LibraryItem } from "@/lib/stremio";
import { stremioMovieWatched } from "@/lib/stremio-watched";

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

function episodeKey(metaId: string, season: number, episode: number): string {
  return `${metaId}:s${season}e${episode}`;
}

export async function computeWatchedBreakdown(
  authKey?: string | null,
): Promise<WatchedBreakdown | null> {
  const movieIds = new Set<string>();
  const episodeKeys = new Set<string>();
  const allWatchedIds = new Set<string>();
  const libraryTimedIds = new Set<string>();
  const playbackMetaIds = new Set<string>();
  let totalWatchMs = 0;

  // 1. Try Stremio Library if authKey is provided
  if (authKey) {
    try {
      const lib = await library(authKey);
      for (const i of lib) {
        if (!i._id) continue;
        const st = i.state as Record<string, unknown> | undefined;
        const watchTime =
          typeof st?.overallTimeWatched === "number"
            ? st.overallTimeWatched
            : typeof st?.timeWatched === "number"
              ? st.timeWatched
              : 0;
        if (watchTime > 0) {
          totalWatchMs += watchTime;
          libraryTimedIds.add(i._id);
        }

        if (!isWatchedItem(i)) continue;
        allWatchedIds.add(i._id);

        if (i.type === "movie" && stremioMovieWatched(i)) {
          movieIds.add(i._id);
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
    for (const key of manualWatchedRawKeys()) {
      const parts = key.split("|");
      const metaId = parts[0];
      if (!metaId) continue;
      allWatchedIds.add(metaId);
      if (parts.length > 1) {
        const season = Number(parts[1]);
        const episode = Number(parts[2]);
        if (Number.isFinite(season) && Number.isFinite(episode)) {
          episodeKeys.add(episodeKey(metaId, season, episode));
        }
      } else if (!movieIds.has(metaId)) {
        movieIds.add(metaId);
      }
    }
  } catch {
    // ignore
  }

  // 5. Include fresh watched episodes (harbor.stremio.freshwatched.v1)
  try {
    for (const id of freshWatchedIds()) {
      if (!id) continue;
      allWatchedIds.add(id);
    }
  } catch {
    // ignore
  }

  // 6. Include local playback history (harbor.playback-history.v1)
  try {
    for (const key of playbackHistoryRawKeys()) {
      const metaId = key.split("|")[0];
      if (!metaId) continue;
      playbackMetaIds.add(metaId);
      allWatchedIds.add(metaId);
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
        if (typeof entry?.ms !== "number" || entry.ms <= 0) continue;
        const metaId = key.split("|")[0];
        if (!metaId) continue;
        if (!playbackMetaIds.has(metaId)) continue;
        if (libraryTimedIds.has(metaId)) continue;
        totalWatchMs += entry.ms;
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
