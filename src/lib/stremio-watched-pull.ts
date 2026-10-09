import { meta as fetchCinemetaMeta } from "@/lib/cinemeta";
import type { LibraryItem } from "@/lib/stremio";
import { decodeWatchedEpisodes } from "@/lib/stremio-watched";
import {
  applyRemoteWatched,
  manualWatchedState,
  remoteWatchedKeys,
  unwatchedAt,
} from "@/lib/manual-watched";
import { isMovieWatchedLocal, setMovieWatchedLocal } from "@/lib/movie-watched";
import { detectAnimeForCw, isDetectedAnime } from "@/lib/anime-detect";

const reconciled = new Set<string>();
const lastPullMtime = new Map<string, number>();
const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

function isSeries(i: LibraryItem): boolean {
  return i.type === "series" || i.type === "tv" || i.type === "channel";
}

export function reconcileRemoteWatched(items: LibraryItem[]): void {
  for (const i of items) {
    if (i.removed && !i.temp) continue;
    if (ANIME_ID.test(i._id) || i.isAnime === true || isDetectedAnime(i._id)) continue;
    const key = `${i._id}|${String(i._mtime ?? "")}`;
    if (reconciled.has(key)) continue;
    reconciled.add(key);
    if (!isSeries(i)) {
      const remoteWatched = (i.state?.flaggedWatched ?? 0) > 0 || (i.state?.timesWatched ?? 0) > 0;
      if (remoteWatched && !isMovieWatchedLocal(i._id)) {
        setMovieWatchedLocal(i._id, true);
      }
      continue;
    }
    const watched = i.state?.watched;
    if (typeof watched === "string" && watched.length > 0) {
      const rawMt = i._mtime as unknown;
      const mtime = typeof rawMt === "number" ? rawMt : Date.parse(String(rawMt ?? ""));
      void applySeries(i._id, watched, Number.isFinite(mtime) ? mtime : 0);
    }
  }
}

async function applySeries(id: string, watched: string, remoteMtime: number): Promise<void> {
  if (!id.startsWith("tt")) return;
  if (!isDetectedAnime(id)) await detectAnimeForCw([{ _id: id, type: "series" }]);
  if (isDetectedAnime(id)) return;
  const full = await fetchCinemetaMeta("series", id).catch(() => null);
  const videos = full?.videos;
  if (!videos?.length) return;
  const keys = await decodeWatchedEpisodes(watched, videos).catch(() => new Set<string>());
  if (keys.size === 0) return;
  const add: Array<{ season: number; episode: number }> = [];
  for (const k of keys) {
    const parts = k.split(":");
    const season = Number(parts[0]);
    const episode = Number(parts[1]);
    if (!Number.isInteger(season) || !Number.isInteger(episode)) continue;
    const st = manualWatchedState(id, season, episode);
    if (st === undefined) add.push({ season, episode });
    else if (st === false && remoteMtime > (unwatchedAt(id, season, episode) ?? 0)) {
      add.push({ season, episode });
    }
  }
  const unset: Array<{ season: number; episode: number }> = [];
  const canUnset = remoteMtime > (lastPullMtime.get(id) ?? 0);
  if (canUnset) {
    for (const rk of remoteWatchedKeys(id)) {
      if (keys.has(rk)) continue;
      const parts = rk.split(":");
      const season = Number(parts[0]);
      const episode = Number(parts[1]);
      if (!Number.isInteger(season) || !Number.isInteger(episode)) continue;
      if (manualWatchedState(id, season, episode) === true) unset.push({ season, episode });
    }
  }
  applyRemoteWatched(id, add, unset);
  if (canUnset) lastPullMtime.set(id, remoteMtime);
}
