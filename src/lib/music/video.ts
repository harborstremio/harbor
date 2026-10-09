import { invoke } from "@tauri-apps/api/core";
import type { MusicTrack } from "./types";

export type MusicVideoStream = {
  url: string;
  audioUrl: string | null;
  httpHeaders?: Record<string, string>;
};

const STREAM_TTL = 8 * 60_000;
const STREAM_LIMIT = 12;
/** Stop trusting a signed URL well before it lapses, so a start never races the expiry. */
const STREAM_MARGIN = 30_000;
const EXPIRE_PATTERNS = [/[?&]expire=(\d{10,})/, /\/expire\/(\d{10,})[/?&]/];
const PREFETCH_LIMIT = 2;
const PREFETCH_QUEUE_LIMIT = 4;

const MUSIC_VIDEO_UNAVAILABLE = "music.video.unavailable";
const MUSIC_VIDEO_RESOLVE_TIMEOUT = 25_000;

type CachedStream = { expires: number; stream: MusicVideoStream };
const streamCache = new Map<string, CachedStream>();
const streamRequests = new Map<string, Promise<MusicVideoStream>>();
const prefetchQueue: MusicTrack[] = [];
let prefetchKey = "";

export type MusicVideoIdentity = Pick<MusicTrack, "id" | "connectorId" | "sourceId">;

/** The identity the native side resolves from: its connector plus that connector's own id. */
export function musicVideoStreamKey(track: MusicVideoIdentity): string {
  return `${track.connectorId ?? ""}:${track.sourceId ?? track.id}`;
}

/**
 * When a resolved stream stops being usable. Provider URLs are signed with their own lapse
 * time, so the cache follows that rather than a guess, and never holds one longer than the TTL.
 */
export function streamExpiry(stream: MusicVideoStream, now = Date.now()): number {
  let signed = Number.POSITIVE_INFINITY;
  for (const url of [stream.url, stream.audioUrl]) {
    if (!url) continue;
    for (const pattern of EXPIRE_PATTERNS) {
      const found = pattern.exec(url);
      if (found) signed = Math.min(signed, Number(found[1]) * 1000);
    }
  }
  const ceiling = now + STREAM_TTL;
  return Number.isFinite(signed) ? Math.min(ceiling, signed - STREAM_MARGIN) : ceiling;
}

function boundedResolve(track: MusicTrack, timeoutMs: number): Promise<MusicVideoStream> {
  const native = invoke<MusicVideoStream>("music_video_stream", { track });
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return native;
  return new Promise<MusicVideoStream>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(MUSIC_VIDEO_UNAVAILABLE)), timeoutMs);
    native.then(
      (stream) => {
        clearTimeout(timer);
        resolve(stream);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Resolution runs yt-dlp on the native side and costs seconds, so the answer is held for as
 * long as its URLs stay valid. Replaying a video, moving it between surfaces and playing one
 * the hero already previewed then cost nothing.
 */
export function musicVideoStream(
  track: MusicTrack,
  refresh = false,
  timeoutMs = MUSIC_VIDEO_RESOLVE_TIMEOUT,
): Promise<MusicVideoStream> {
  const key = musicVideoStreamKey(track);
  if (!refresh) {
    const hit = streamCache.get(key);
    // Reinsert on a hit. Eviction takes the oldest entry, and without this the video being
    // watched is the oldest one of all, so a few warmed neighbours would push it out.
    if (hit && hit.expires > Date.now()) {
      streamCache.delete(key);
      streamCache.set(key, hit);
      return Promise.resolve(hit.stream);
    }
    const running = streamRequests.get(key);
    if (running) return running;
  }
  forgetMusicVideoStreamKey(key);
  const request: Promise<MusicVideoStream> = boundedResolve(track, timeoutMs)
    .then((stream) => {
      const expires = streamExpiry(stream);
      if (expires > Date.now()) {
        streamCache.set(key, { expires, stream });
        while (streamCache.size > STREAM_LIMIT)
          streamCache.delete(streamCache.keys().next().value!);
      }
      return stream;
    })
    .finally(() => {
      if (streamRequests.get(key) === request) streamRequests.delete(key);
      runPrefetch();
    });
  streamRequests.set(key, request);
  return request;
}

/** A resolution somebody is waiting on. A warmed neighbour must never compete with one. */
function foregroundResolving(): boolean {
  for (const key of streamRequests.keys()) if (key !== prefetchKey) return true;
  return false;
}

function runPrefetch(): void {
  if (prefetchKey || foregroundResolving()) return;
  const next = prefetchQueue.shift();
  if (!next) return;
  prefetchKey = musicVideoStreamKey(next);
  void musicVideoStream(next)
    .catch(() => {})
    .finally(() => {
      prefetchKey = "";
      runPrefetch();
    });
}

/**
 * Warm what the viewer is most likely to open next, so that click costs no resolution at all.
 * Each one spawns yt-dlp natively, so they run one at a time, never alongside a resolution the
 * viewer is already waiting on, and only a couple deep so the bounded cache keeps what is playing.
 */
export function prefetchMusicVideoStreams(tracks: MusicTrack[], limit = PREFETCH_LIMIT): void {
  for (const track of tracks.slice(0, Math.max(0, limit))) {
    if (prefetchQueue.length >= PREFETCH_QUEUE_LIMIT) break;
    const key = musicVideoStreamKey(track);
    const hit = streamCache.get(key);
    if ((hit && hit.expires > Date.now()) || streamRequests.has(key)) continue;
    if (prefetchQueue.some((queued) => musicVideoStreamKey(queued) === key)) continue;
    prefetchQueue.push(track);
  }
  runPrefetch();
}

/**
 * Drop everything a retry would otherwise short circuit on: the cached answer and the promise
 * of a resolution already running. A timed-out resolution leaves its request behind, and
 * without this a retry would simply attach to the same wedged call and hang again.
 */
function forgetMusicVideoStreamKey(key: string): void {
  streamCache.delete(key);
  streamRequests.delete(key);
}
