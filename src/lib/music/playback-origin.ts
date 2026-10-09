import { useSyncExternalStore } from "react";
import {
  musicContextArtwork,
  recordMusicRecentContext,
  rememberMusicContextTracks,
} from "./recent-context";
import { queueTrackKey } from "./queue-order";
import type { MusicCatalogItem, MusicTrack } from "./types";

export type MusicPlaybackOrigin =
  | { kind: "library"; id: "liked" | "recent"; name: string }
  | { kind: "playlist"; id: string; name: string }
  | { kind: "similar"; id: string; name: string; seed?: MusicTrack }
  | { kind: "catalog"; id: string; name: string; item: Exclude<MusicCatalogItem, { kind: "track" }> }
  | { kind: "spotify"; id: string; name: string; collection: "playlist" | "liked"; nextOffset: number | null }
  | null;

/**
 * Where the current queue came from, as opposed to where a track can be found. A track's
 * collectionOrigin is its source-resolution identity and says nothing about the playlist
 * the listener started from, so clicking the title in the dock had nowhere to go and fell
 * back to a search for the song name.
 */
let origin: MusicPlaybackOrigin = null;
const listeners = new Set<() => void>();
const queues = new Map<string, MusicPlaybackOrigin>();
let queueRevision = 0;
const queueKey = (tracks: readonly MusicTrack[]) => JSON.stringify(tracks.map(queueTrackKey));

/** Register before source selection; collectionOrigin survives resolution to another provider. */
export function registerMusicQueueOrigin(tracks: readonly MusicTrack[], from: MusicPlaybackOrigin): void {
  queues.set(queueKey(tracks), from);
  while (queues.size > 40) queues.delete(queues.keys().next().value!);
}

export function beginMusicQueue(tracks: readonly MusicTrack[], previous: readonly MusicTrack[]): void {
  const key = queueKey(tracks);
  if (queues.has(key)) {
    queueRevision += 1;
    setMusicPlaybackOrigin(queues.get(key) ?? null);
    queues.delete(key);
  } else if (key !== queueKey(previous)) {
    queueRevision += 1;
    setMusicPlaybackOrigin(null);
  }
}

export const getMusicQueueRevision = () => queueRevision;

export function registerMusicCatalogOrigin(item: MusicCatalogItem, tracks: readonly MusicTrack[]): void {
  registerMusicQueueOrigin(tracks, item.kind === "track" ? null : {
    kind: "catalog", id: `${item.connectorId}:${item.kind}:${item.id}`,
    name: item.kind === "album" ? item.title : item.name, item,
  });
}

export function setMusicPlaybackOrigin(next: MusicPlaybackOrigin): void {
  if (origin === next) return;
  origin = next;
  for (const listener of listeners) listener();
}

/** Used at boot from the saved checkpoint; does not notify, nothing is listening yet. */
export function restoreMusicPlaybackOrigin(next: MusicPlaybackOrigin): void {
  origin = next;
}

export function getMusicPlaybackOrigin(): MusicPlaybackOrigin {
  return origin;
}

export function recordMusicPlaylistPlayback(
  playlist: { id: string; name: string; tracks?: readonly MusicTrack[] } | null | undefined,
  queue = playlist?.tracks ?? [],
): void {
  registerMusicQueueOrigin(queue, playlist?.id ? { kind: "playlist", id: playlist.id, name: playlist.name } : null);
  setMusicPlaybackOrigin(
    playlist && playlist.id ? { kind: "playlist", id: playlist.id, name: playlist.name } : null,
  );
  if (!playlist?.id) return;
  const tracks = playlist.tracks ?? [];
  recordMusicRecentContext(
    {
      kind: "playlist",
      id: playlist.id,
      name: playlist.name,
      artwork: musicContextArtwork(tracks),
    },
    tracks,
  );
}

export type MusicTitleTarget =
  | { kind: "playlist"; playlistId: string }
  | { kind: "similar"; seedId: string; name: string }
  | { kind: "library"; view: "liked" | "recent" }
  | { kind: "catalog"; item: Exclude<MusicCatalogItem, { kind: "track" }> }
  | { kind: "spotify"; collection: "playlist" | "liked"; id: string }
  | { kind: "album" };

export function musicTitleTarget(from: MusicPlaybackOrigin): MusicTitleTarget {
  if (from?.kind === "playlist" && from.id) return { kind: "playlist", playlistId: from.id };
  if (from?.kind === "similar" && from.id)
    return { kind: "similar", seedId: from.id, name: from.name };
  if (from?.kind === "library") return { kind: "library", view: from.id };
  if (from?.kind === "catalog") return { kind: "catalog", item: from.item };
  if (from?.kind === "spotify") return { kind: "spotify", collection: from.collection, id: from.id };
  return { kind: "album" };
}

/** The name to put on the menu entry, empty when there is nowhere to go back to. */
export function musicOriginName(from: MusicPlaybackOrigin): string {
  return from?.name?.trim() ?? "";
}

export function recordMusicSimilarPlayback(
  seed: MusicTrack,
  mix: readonly MusicTrack[] = [],
  identity?: { id: string; name: string },
): void {
  const id = identity?.id ?? seed.id;
  const name = identity?.name ?? seed.title;
  const from: MusicPlaybackOrigin = { kind: "similar", id, name, seed };
  registerMusicQueueOrigin(mix, from);
  setMusicPlaybackOrigin(from);
  rememberMusicContextTracks("similar", id, mix);
  recordMusicRecentContext(
    {
      kind: "similar",
      id,
      name,
      artwork: musicContextArtwork([seed, ...mix]),
      seed,
    },
    mix,
  );
}

export function useMusicPlaybackOrigin(): MusicPlaybackOrigin {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getMusicPlaybackOrigin,
    getMusicPlaybackOrigin,
  );
}

export function recordMusicLibraryPlayback(id: "liked" | "recent", name: string, tracks: readonly MusicTrack[]): void {
  const from: MusicPlaybackOrigin = { kind: "library", id, name };
  registerMusicQueueOrigin(tracks, from);
  setMusicPlaybackOrigin(from);
}
