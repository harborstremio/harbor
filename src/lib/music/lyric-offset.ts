import { readMusicPreference, writeMusicPreference } from "./preferences";
import type { MusicTrack } from "./types";

const KEY = "harbor.music.lyric-offset.v1";
const LIMIT = 200;
export const LYRIC_OFFSET_STEP = 0.25;
export const LYRIC_OFFSET_LIMIT = 8;

export function lyricOffsetKey(track: MusicTrack | null | undefined): string {
  if (!track) return "";
  return `${track.connectorId ?? ""}:${track.sourceId ?? track.id}`;
}

export function clampLyricOffset(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  const bounded = Math.max(-LYRIC_OFFSET_LIMIT, Math.min(LYRIC_OFFSET_LIMIT, seconds));
  return Math.round(bounded / LYRIC_OFFSET_STEP) * LYRIC_OFFSET_STEP;
}

export function parseOffsets(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [key, at] of Object.entries(value as Record<string, unknown>)) {
      if (typeof at === "number" && Number.isFinite(at) && at !== 0)
        out[key] = clampLyricOffset(at);
    }
    return out;
  } catch {
    return {};
  }
}

export function trimOffsets(
  offsets: Record<string, number>,
  limit = LIMIT,
): Record<string, number> {
  const keys = Object.keys(offsets);
  if (keys.length <= limit) return offsets;
  const out: Record<string, number> = {};
  for (const key of keys.slice(keys.length - limit)) out[key] = offsets[key];
  return out;
}

export function getLyricOffset(track: MusicTrack | null | undefined): number {
  const key = lyricOffsetKey(track);
  if (!key) return 0;
  return parseOffsets(readMusicPreference(KEY))[key] ?? 0;
}

export function setLyricOffset(track: MusicTrack | null | undefined, seconds: number): number {
  const key = lyricOffsetKey(track);
  if (!key) return 0;
  const next = clampLyricOffset(seconds);
  const offsets = parseOffsets(readMusicPreference(KEY));
  if (next === 0) delete offsets[key];
  else {
    delete offsets[key];
    offsets[key] = next;
  }
  writeMusicPreference(KEY, JSON.stringify(trimOffsets(offsets)));
  return next;
}

/** Lyrics running ahead need a positive offset, which looks the timeline up earlier. */
export function shiftedLyricTime(currentTime: number, offset: number): number {
  if (!Number.isFinite(currentTime)) return 0;
  return Math.max(0, currentTime - (Number.isFinite(offset) ? offset : 0));
}
