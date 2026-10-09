import type { MusicTrack } from "./types";

export type NowSearchMode = "songs" | "videos";

export const NOW_SEARCH_PAGE = 40;

export const NOW_SEARCH_CEILING = 240;

export function searchTrackKey(track: MusicTrack): string {
  return `${track.connectorId ?? ""}:${track.sourceId ?? track.id}`;
}

export function dedupeSearchTracks(tracks: MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  const kept: MusicTrack[] = [];
  for (const track of tracks) {
    const key = searchTrackKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(track);
  }
  return kept;
}

export function mergeSearchTracks(previous: MusicTrack[], incoming: MusicTrack[]): MusicTrack[] {
  return dedupeSearchTracks([...previous, ...incoming]);
}

export function filterSearchMode(tracks: MusicTrack[], mode: NowSearchMode): MusicTrack[] {
  return tracks.filter((track) =>
    mode === "videos" ? track.mediaKind === "video" : track.mediaKind !== "video",
  );
}

export function nextSearchLimit(current: number, received: number): number | null {
  if (!Number.isFinite(current) || current < NOW_SEARCH_PAGE) return null;
  if (received < current) return null;
  if (current >= NOW_SEARCH_CEILING) return null;
  return Math.min(current + NOW_SEARCH_PAGE, NOW_SEARCH_CEILING);
}

export function moveSearchCursor(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  const from = current < 0 ? (delta > 0 ? -1 : length) : current;
  const next = from + delta;
  if (next < 0) return 0;
  if (next > length - 1) return length - 1;
  return next;
}
