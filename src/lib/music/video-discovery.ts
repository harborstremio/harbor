import { invoke } from "@tauri-apps/api/core";
import type { MusicTrack } from "./types";

const TTL = 10 * 60_000;
const cache = new Map<string, { expires: number; tracks: MusicTrack[] }>();
const pending = new Map<string, Promise<MusicTrack[]>>();

const VIDEO_RESULT_CAP = 12;

const NOISE =
  /(official|video|audio|music|lyric|lyrics|visualizer|hd|hq|explicit|clean|edit|version|mv|m\/v|prod|dir)/g;

/** Re-uploads of one song differ only by marketing words, so they collapse to a single entry. */
export function musicVideoIdentity(title: string, artist: string): string {
  const strip = (value: string) =>
    value
      .toLowerCase()
      .replace(/[\(\[][^\)\]]*[\)\]]/g, " ")
      .replace(/(feat|ft|featuring|with)[^-]*/g, " ")
      .replace(NOISE, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return `${strip(title)}|${strip(artist)}`;
}

/** Only accepts exact YouTube identities returned by the native video-only endpoint. */
export function musicVideoResults(value: unknown, cap = VIDEO_RESULT_CAP): MusicTrack[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const songs = new Set<string>();
  return value
    .filter((track): track is MusicTrack => {
      if (
        !track ||
        typeof track !== "object" ||
        track.connectorId !== "youtube" ||
        typeof track.sourceId !== "string" ||
        !/^[\w-]{11}$/.test(track.sourceId) ||
        typeof track.id !== "string" ||
        typeof track.title !== "string" ||
        !track.title.trim() ||
        typeof track.artist !== "string" ||
        typeof track.artwork !== "string" ||
        typeof track.durationSeconds !== "number" ||
        typeof track.durationLabel !== "string" ||
        seen.has(track.sourceId)
      )
        return false;
      const identity = musicVideoIdentity(track.title, track.artist);
      if (identity.length > 1 && songs.has(identity)) return false;
      seen.add(track.sourceId);
      songs.add(identity);
      return true;
    })
    .slice(0, cap)
    .map((track) => ({ ...track, mediaKind: "video" }));
}

export type MusicVideoKind = "videos" | "concerts" | "interviews";

export const MUSIC_VIDEO_KIND_LABELS: Record<MusicVideoKind, string> = {
  videos: "music.videos.title",
  concerts: "music.videos.concerts",
  interviews: "music.videos.interviews",
};

export function musicVideoQuery(kind: MusicVideoKind, subject: string): string {
  const name = subject.trim();
  if (!name)
    return kind === "concerts"
      ? "full concert"
      : kind === "interviews"
        ? "music interview"
        : "music videos";
  if (kind === "concerts") return `${name} full concert`;
  if (kind === "interviews") return `${name} interview`;
  return `${name} music videos`;
}

export function musicVideoUsesYoutube(kind: MusicVideoKind): boolean {
  return kind === "concerts" || kind === "interviews";
}

const VIDEO_SEARCH_LIMIT = 40;

export const MUSIC_VIDEO_MAX = VIDEO_SEARCH_LIMIT;

export function searchMusicVideos(
  query: string,
  refresh = false,
  interviews = false,
  limit = VIDEO_RESULT_CAP,
): Promise<MusicTrack[]> {
  const clean = query.trim().slice(0, 200);
  if (!clean) return Promise.resolve([]);
  const take = Math.max(1, Math.min(Math.trunc(limit) || VIDEO_RESULT_CAP, VIDEO_SEARCH_LIMIT));
  const key = `${interviews ? "interviews" : "videos"}:${clean.toLocaleLowerCase()}`;
  const hit = cache.get(key);
  // Reinsert on a hit, because eviction takes the oldest entry and the list being watched is
  // read over and over without ever being written again.
  if (!refresh && hit && hit.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit.tracks.slice(0, take));
  }
  const request = pending.get(key);
  if (request) return request.then((tracks) => tracks.slice(0, take));
  const next: Promise<MusicTrack[]> = invoke<unknown>("music_search_videos", {
    query: clean,
    limit: VIDEO_SEARCH_LIMIT,
    interviews,
  })
    .then((value) => {
      const tracks = musicVideoResults(value, VIDEO_SEARCH_LIMIT);
      cache.delete(key);
      cache.set(key, { expires: Date.now() + TTL, tracks });
      while (cache.size > 12) cache.delete(cache.keys().next().value!);
      return tracks;
    })
    .finally(() => {
      // A refresh started while this one was still running owns the slot now: clearing it
      // blindly would send the next caller to the native search a third time.
      if (pending.get(key) === next) pending.delete(key);
    });
  pending.set(key, next);
  return next.then((tracks) => tracks.slice(0, take));
}
