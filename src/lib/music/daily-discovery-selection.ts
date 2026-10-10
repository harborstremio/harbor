import { artistIdentityKey } from "./artist-popularity";
import { artistCreditParts } from "./search-artists";
import { musicTrackCredit, musicTrackIdentity } from "./track-identity";
import { isMixRecording } from "./mix-quality";
import type { MusicTrack } from "./types";

export const DAILY_MIN_ARTISTS = 5;
export const DAILY_MIN_TRACKS = 15;
export const DAILY_ARTIST_LIMIT = 3;
export const DAILY_TRACK_LIMIT = 30;

export function dailyDayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function dailySeed(value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

/** Stable within a calendar day, with a different starting point the following day. */
export function dailyRotation<T>(values: readonly T[], day: string, seed: string, key: (value: T) => string): T[] {
  const out = [...values].sort((a, b) => key(a).localeCompare(key(b)));
  let state = parseInt(dailySeed(seed), 36);
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (!out.length) return out;
  const offset = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000) % out.length;
  return [...out.slice(offset), ...out.slice(0, offset)];
}

export function dailyArtistName(track: MusicTrack): string {
  const credit = musicTrackCredit(track).artist;
  return artistCreditParts(credit, true)[0] ?? credit;
}

export function dailyArtistKey(track: MusicTrack): string {
  return artistIdentityKey(dailyArtistName(track));
}

export function dailyMixHasVariety(tracks: readonly MusicTrack[]): boolean {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const track of tracks) {
    const artist = dailyArtistKey(track);
    const recording = musicTrackIdentity(track);
    if (!artist || seen.has(recording) || !isMixRecording(track)) return false;
    seen.add(recording);
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  return tracks.length >= DAILY_MIN_TRACKS && tracks.length <= DAILY_TRACK_LIMIT
    && counts.size >= DAILY_MIN_ARTISTS && [...counts.values()].every(count => count <= DAILY_ARTIST_LIMIT);
}

/** Round-robin actual recordings, not provider spellings of the same artist. */
export function selectDailyTracks(pool: readonly MusicTrack[], day: string, seed: string): MusicTrack[] {
  const artists = new Map<string, MusicTrack[]>();
  const seen = new Set<string>();
  for (const track of pool) {
    const artist = dailyArtistKey(track);
    const recording = musicTrackIdentity(track);
    if (!artist || seen.has(recording) || !isMixRecording(track)) continue;
    seen.add(recording);
    const lane = artists.get(artist) ?? [];
    lane.push(track);
    artists.set(artist, lane);
  }
  const lanes = dailyRotation([...artists], day, seed, ([key]) => key)
    .map(([key, tracks]) => dailyRotation(tracks, day, `${seed}:${key}`, musicTrackIdentity).slice(0, DAILY_ARTIST_LIMIT));
  const result: MusicTrack[] = [];
  for (let round = 0; round < DAILY_ARTIST_LIMIT; round++) {
    for (const lane of lanes) {
      if (lane[round]) result.push(lane[round]);
      if (result.length === DAILY_TRACK_LIMIT) break;
    }
    if (result.length === DAILY_TRACK_LIMIT) break;
  }
  return dailyMixHasVariety(result) ? result : [];
}
