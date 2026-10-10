import { safeFetch } from "@/lib/safe-fetch";
import type { MusicTrack } from "./types";

export type LyricLine = { at: number; text: string };

type LrcRow = {
  instrumental?: unknown;
  duration?: unknown;
  syncedLyrics?: unknown;
  plainLyrics?: unknown;
};

const API = "https://lrclib.net/api";
const CACHE_MAX = 160;
const STAMP = /^\s*\[(\d{1,4}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/;

const cache = new Map<string, Promise<LyricLine[] | null>>();

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const seconds = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

function stampSeconds(minutes: string, secs: string, fraction: string | undefined): number {
  const base = Number(minutes) * 60 + Number(secs);
  if (!fraction) return base;
  const digits =
    fraction.length === 1 ? `${fraction}00` : fraction.length === 2 ? `${fraction}0` : fraction;
  return base + Number(digits) / 1000;
}

export function parseLrc(lrc: string): LyricLine[] {
  if (typeof lrc !== "string" || lrc.length === 0) return [];
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    let rest = raw;
    const stamps: number[] = [];
    for (;;) {
      const match = STAMP.exec(rest);
      if (!match) break;
      stamps.push(stampSeconds(match[1], match[2], match[3]));
      rest = rest.slice(match[0].length);
    }
    if (stamps.length === 0) continue;
    const body = rest.trim();
    for (const at of stamps) lines.push({ at, text: body });
  }
  lines.sort((a, b) => a.at - b.at);
  return lines;
}

export function lyricIndexAt(lines: LyricLine[], seconds: number): number {
  if (!Array.isArray(lines) || lines.length === 0) return -1;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return -1;
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].at <= seconds) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

function identity(track: MusicTrack): string {
  const source = `${track.connectorId ?? ""}:${track.id ?? ""}`;
  const named = `${track.artist ?? ""}|${track.title ?? ""}|${Math.round(seconds(track.durationSeconds))}`;
  return `${source}|${named}`.toLowerCase();
}

async function json(url: string): Promise<unknown> {
  try {
    const response = await safeFetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function rowsOf(value: unknown): LrcRow[] {
  if (Array.isArray(value))
    return value.filter((entry) => entry && typeof entry === "object") as LrcRow[];
  if (value && typeof value === "object") return [value as LrcRow];
  return [];
}

function nearest(rows: LrcRow[], target: number): LrcRow | null {
  let best: LrcRow | null = null;
  let bestGap = Infinity;
  for (const row of rows) {
    const gap = target > 0 ? Math.abs(seconds(row.duration) - target) : 0;
    if (gap < bestGap) {
      best = row;
      bestGap = gap;
    }
  }
  return best;
}

function chooseLyrics(rows: LrcRow[], target: number): LyricLine[] | null {
  if (rows.length === 0) return null;
  const closest = nearest(rows, target);
  if (!closest || closest.instrumental === true) return null;
  const synced = nearest(
    rows.filter((row) => text(row.syncedLyrics).trim().length > 0),
    target,
  );
  if (!synced) return null;
  const parsed = parseLrc(text(synced.syncedLyrics));
  return parsed.length > 0 ? parsed : null;
}

async function fetchLyrics(track: MusicTrack): Promise<LyricLine[] | null> {
  const artist = text(track.artist).trim();
  const title = text(track.title).trim();
  if (!artist || !title) return null;
  const duration = seconds(track.durationSeconds);
  const album = text(track.album).trim();
  const query = `artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  if (album && duration > 0) {
    const exact = `${API}/get?${query}&album_name=${encodeURIComponent(album)}&duration=${Math.round(duration)}`;
    const picked = chooseLyrics(rowsOf(await json(exact)), duration);
    if (picked) return picked;
  }
  return chooseLyrics(rowsOf(await json(`${API}/search?${query}`)), duration);
}

export function loadTrackLyrics(track: MusicTrack): Promise<LyricLine[] | null> {
  if (!track || typeof track !== "object") return Promise.resolve(null);
  const key = identity(track);
  const held = cache.get(key);
  if (held) return held;
  const pending = fetchLyrics(track).catch(() => null);
  cache.set(key, pending);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  return pending;
}
