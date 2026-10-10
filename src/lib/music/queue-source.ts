import type { MusicSourceCandidate, MusicTrack } from "./types";

/**
 * A substitute supplies the audio, never the credit. An upload titles itself
 * "Artist - Song" and carries the uploader as its artist, so the requested
 * recording keeps naming itself; only timings come from where it plays.
 */
export function adoptRequestedIdentity(selected: MusicTrack, original: MusicTrack): MusicTrack {
  return {
    ...selected,
    title: original.title || selected.title,
    artist: original.artist || selected.artist,
    album: original.album ?? selected.album,
    artwork: original.artwork || selected.artwork,
    explicit: original.explicit ?? selected.explicit,
    collectionOrigin: {
      id: original.collectionOrigin?.id ?? original.id,
      connectorId: original.collectionOrigin?.connectorId ?? original.connectorId,
      title: original.collectionOrigin?.title ?? original.title ?? undefined,
      artist: original.collectionOrigin?.artist ?? original.artist ?? undefined,
      artwork: original.collectionOrigin?.artwork ?? original.artwork ?? undefined,
    },
  };
}

export function replaceQueueTrack(
  queue: MusicTrack[],
  index: number,
  selected: MusicTrack,
): MusicTrack[] {
  const original = queue[index];
  if (!original || index < 0 || index >= queue.length) return queue;
  if (selected.connectorId === original.connectorId && selected.id === original.id) return queue;
  return queue.map((item, at) => (at === index ? adoptRequestedIdentity(selected, original) : item));
}

export function selectableSources(
  candidates: MusicSourceCandidate[],
  track: MusicTrack,
): MusicSourceCandidate[] {
  // Candidates arrive best-scoring first, so the first row for a service is the one to keep.
  // The track already playing is dropped before a service is claimed, or it would take the one
  // slot its service gets and hide every alternative behind it.
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (candidate.health === "offline") return false;
    if (candidate.connectorId === track.connectorId && candidate.track.id === track.id) {
      return false;
    }
    if (seen.has(candidate.connectorId)) return false;
    seen.add(candidate.connectorId);
    return true;
  });
}
