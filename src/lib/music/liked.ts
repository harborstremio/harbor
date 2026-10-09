import type { MusicTrack } from "./types";

export function likedIdsFor(track: MusicTrack | null | undefined): string[] {
  if (!track) return [];
  const out = [track.id];
  const origin = track.collectionOrigin?.id;
  if (origin && origin !== track.id) out.push(origin);
  return out.filter(Boolean);
}

export function isMusicLiked(
  likedIds: readonly string[],
  track: MusicTrack | null | undefined,
): boolean {
  if (!track || likedIds.length === 0) return false;
  const ids = new Set(likedIds);
  return likedIdsFor(track).some((id) => ids.has(id));
}

export function withoutLiked(likedIds: readonly string[], track: MusicTrack): string[] {
  const drop = new Set(likedIdsFor(track));
  return likedIds.filter((id) => !drop.has(id));
}
