import { normalizeTitle, normalizeName } from "./search-normalize";
import type { MusicTrack } from "./types";

/** Names alone cannot distinguish namesakes; require two shared recordings. */
export function sharesArtistRecordings(left: MusicTrack[], right: MusicTrack[]): boolean {
  const matches = new Set<string>();
  for (const track of left) {
    const title = normalizeTitle(track.title);
    if (!title || !normalizeName(track.artist)) continue;
    if (right.some((other) => normalizeTitle(other.title) === title
      && normalizeName(other.artist) === normalizeName(track.artist)
      && track.durationSeconds > 0 && other.durationSeconds > 0
      && Math.abs(track.durationSeconds - other.durationSeconds) <= 8)) matches.add(title);
  }
  return matches.size >= 2;
}
