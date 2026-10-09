import { invoke } from "@tauri-apps/api/core";
import { musicVideoIdentity, musicVideoResults, searchMusicVideos } from "./video-discovery";
import type { MusicTrack } from "./types";

export type MusicVideoPage = { tracks: MusicTrack[]; next: string | null };
const cache = new Map<string, { until: number; request: Promise<MusicVideoPage> }>();

export function appendMusicVideos(previous: MusicTrack[], incoming: MusicTrack[]): MusicTrack[] {
  const ids = new Set(previous.map(track => track.sourceId));
  const songs = new Set(previous.map(track => musicVideoIdentity(track.title, track.artist)));
  return [...previous, ...incoming.filter(track => {
    const song = musicVideoIdentity(track.title, track.artist);
    if (ids.has(track.sourceId) || songs.has(song)) return false;
    ids.add(track.sourceId); songs.add(song); return true;
  })];
}

export function searchMusicVideoPage(query: string, regular: boolean, cursor: string | null = null, refresh = false, subject = ""): Promise<MusicVideoPage> {
  const clean = query.trim().slice(0, 200), key = JSON.stringify([clean, regular, cursor, subject]);
  const hit = cache.get(key);
  if (!refresh && hit && hit.until > Date.now()) return hit.request;
  const request = invoke<MusicVideoPage>("music_search_video_page", { query: clean, regular, cursor })
    .then(page => ({ tracks: musicVideoResults(page.tracks, Number.MAX_SAFE_INTEGER, subject), next: typeof page.next === "string" && page.next !== cursor ? page.next : null }))
    .catch(async error => {
      // HMR can update the UI before the native app restarts with the new command.
      if (!cursor && /command.*music_search_video_page.*not found/i.test(String(error))) {
        return { tracks: await searchMusicVideos(clean, refresh, regular, 40, subject), next: null };
      }
      throw error;
    });
  cache.set(key, { until: Date.now() + 10 * 60_000, request });
  while (cache.size > 60) cache.delete(cache.keys().next().value!);
  void request.catch(() => { if (cache.get(key)?.request === request) cache.delete(key); });
  return request;
}
