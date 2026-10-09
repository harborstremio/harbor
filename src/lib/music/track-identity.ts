import { normalizeName } from "./search-normalize";
import { artistCreditParts } from "./search-artists";
import type { MusicTrack } from "./types";

/** An upload names itself "Artist - Song"; provenance says who the recording is really by. */
export function musicTrackCredit(
  track: Pick<MusicTrack, "title" | "artist"> & { collectionOrigin?: { title?: string; artist?: string } },
): { title: string; artist: string } {
  return {
    title: track.collectionOrigin?.title?.trim() || track.title || "",
    artist: track.collectionOrigin?.artist?.trim() || track.artist || "",
  };
}

export function musicTrackIdentity(
  track: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist"> & {
    collectionOrigin?: { title?: string; artist?: string };
  },
): string {
  const credit = musicTrackCredit(track);
  const title = normalizeName(credit.title);
  const lead = normalizeName(artistCreditParts(credit.artist)[0] ?? credit.artist);
  if (!title || !lead) return `${track.connectorId ?? ""}:${track.id}`;
  return `${title}::${lead}`;
}

export function sameMusicTrack(
  left: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist">,
  right: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist">,
): boolean {
  return left.id === right.id || musicTrackIdentity(left) === musicTrackIdentity(right);
}

export function dedupeMusicTracks<T extends Pick<MusicTrack, "id" | "connectorId" | "title" | "artist">>(
  tracks: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const track of tracks) {
    const key = musicTrackIdentity(track);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
  }
  return out;
}
