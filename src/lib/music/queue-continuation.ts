import { queueTrackKey } from "./queue-order";
import { musicTrackIdentity } from "./track-identity";
import type { MusicPlaybackOrigin } from "./playback-origin";
import type { MusicCatalogItem, MusicTrack } from "./types";

export type MusicContinuationMode = "context" | "discover";
type CatalogItem = Exclude<MusicCatalogItem, { kind: "track" }>;
export type ContinuationDependencies = {
  playlist: (id: string) => Promise<MusicTrack[]>;
  catalog: (item: CatalogItem) => Promise<MusicTrack[]>;
  spotify: (kind: "playlist" | "liked", offset: number, id?: string) => Promise<{ tracks: MusicTrack[]; nextOffset: number | null }>;
  discover: (seed: MusicTrack, excluded: readonly MusicTrack[]) => Promise<MusicTrack[]>;
  source: (seed: MusicTrack, connector: string) => Promise<MusicTrack[]>;
};

const dependencies: ContinuationDependencies = {
  playlist: async (id) => {
    const { listMusicPlaylists } = await import("./library");
    const playlist = (await listMusicPlaylists()).find((entry) => entry.id === id);
    if (!playlist) throw new Error("Playlist unavailable");
    return playlist.tracks;
  },
  catalog: async (item) => {
    const api = await import("./catalog");
    return item.kind === "album" ? api.albumTracks(item)
      : item.kind === "playlist" ? api.catalogPlaylistTracks(item)
        : item.kind === "artist" ? api.artistTop(item) : api.stationTracks(item);
  },
  spotify: async (kind, offset, id) => (await import("./spotify-library")).loadSpotifyLibraryPage(kind, offset, id),
  discover: async (seed, excluded) => (await import("./radio")).loadUnheardMusic(seed, excluded),
  source: async (seed, connector) => (await (await import("./catalog")).searchTyped(seed.artist, 40, connector)).tracks,
};

/** Compare both provider identity (including resolved tracks) and recording identity. */
export function freshContinuationTracks(candidates: readonly MusicTrack[], excluded: readonly MusicTrack[], allowVideo = false): MusicTrack[] {
  const ids = new Set(excluded.map(queueTrackKey));
  const recordings = new Set(excluded.map(musicTrackIdentity));
  return candidates.filter((track) => {
    const id = queueTrackKey(track), recording = musicTrackIdentity(track);
    if ((track.mediaKind === "video" && !allowVideo) || ids.has(id) || recordings.has(recording)) return false;
    ids.add(id);
    recordings.add(recording);
    return true;
  });
}

export async function loadMusicContinuation({ mode, origin, current, queue, history }: {
  mode: MusicContinuationMode;
  origin: MusicPlaybackOrigin;
  current: MusicTrack;
  queue: readonly MusicTrack[];
  history: readonly MusicTrack[];
}, api = dependencies): Promise<{ tracks: MusicTrack[]; origin: MusicPlaybackOrigin; exhausted: boolean }> {
  const excluded = [current, ...queue, ...(mode === "discover" ? history : [])];
  const allowVideo = current.mediaKind === "video";
  if (mode === "discover" || origin?.kind === "similar") {
    const seed = mode === "context" && origin?.kind === "similar" ? origin.seed ?? current : current;
    const tracks = freshContinuationTracks(await api.discover(seed, excluded), excluded, allowVideo);
    return { tracks, origin, exhausted: tracks.length === 0 };
  }
  let from = origin;
  if (from?.kind === "catalog" && from.item.kind === "playlist" && from.item.connectorId === "spotify") {
    from = { kind: "spotify", id: from.item.id, name: from.name,
      collection: from.item.id === "spotify:liked" ? "liked" : "playlist", nextOffset: 0 };
  }
  if (from?.kind === "spotify") {
    let offset = from.nextOffset;
    // Bound requests if a playlist contains many already queued/unavailable entries.
    for (let page = 0; offset !== null && page < 4; page += 1) {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) throw new Error("Invalid music page");
      const result = await api.spotify(from.collection, offset, from.collection === "playlist" ? from.id : undefined);
      if (result.nextOffset !== null && (!Number.isSafeInteger(result.nextOffset) || result.nextOffset <= offset || result.nextOffset > 100_000)) {
        throw new Error("Invalid music pagination");
      }
      offset = result.nextOffset;
      const tracks = freshContinuationTracks(result.tracks, excluded, allowVideo);
      if (tracks.length) return { tracks, origin: { ...from, nextOffset: offset }, exhausted: offset === null };
    }
    return { tracks: [], origin: { ...from, nextOffset: offset }, exhausted: offset === null };
  }
  const connector = current.collectionOrigin?.connectorId ?? current.connectorId;
  const candidates = from?.kind === "playlist" ? await api.playlist(from.id)
    : from?.kind === "catalog" ? await api.catalog(from.item)
      : connector && connector !== "catalog" ? await api.source(current, connector) : [];
  const tracks = freshContinuationTracks(candidates, excluded, allowVideo);
  return { tracks, origin: from, exhausted: tracks.length === 0 };
}
