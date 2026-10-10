import { useSyncExternalStore } from "react";
import { listMusicPlaylists } from "./library";
import { artistCreditParts } from "./search-artists";
import type { MusicPlaylist, MusicTrack } from "./types";

export type MusicArtistPresence = { trackCount: number; playlists: MusicPlaylist[] };

export type MusicPlaylistIndex = {
  ready: boolean;
  playlists: MusicPlaylist[];
  byTrack: Map<string, MusicPlaylist[]>;
  byArtist: Map<string, MusicArtistPresence>;
};

const EMPTY: MusicPlaylistIndex = {
  ready: false,
  playlists: [],
  byTrack: new Map(),
  byArtist: new Map(),
};

const NO_PLAYLISTS: MusicPlaylist[] = [];
const NO_PRESENCE: MusicArtistPresence = { trackCount: 0, playlists: NO_PLAYLISTS };

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function musicTrackKeys(
  track: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist">,
): string[] {
  const keys: string[] = [];
  if (track.connectorId && track.id) keys.push(`s:${track.connectorId}:${track.id}`);
  const title = normalize(track.title ?? "");
  const artist = normalize(track.artist ?? "");
  if (title && artist) keys.push(`t:${title}|${artist}`);
  return keys;
}

export function musicArtistKeys(artist: string): string[] {
  const full = normalize(artist ?? "");
  if (!full) return [];
  const keys = new Set([full]);
  for (const part of artistCreditParts(artist ?? "")) {
    const key = normalize(part);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function buildMusicPlaylistIndex(playlists: MusicPlaylist[]): MusicPlaylistIndex {
  const byTrack = new Map<string, MusicPlaylist[]>();
  const byArtist = new Map<string, MusicArtistPresence>();
  for (const playlist of playlists) {
    const countedArtists = new Set<string>();
    const countedTracks = new Set<string>();
    for (const track of playlist.tracks ?? []) {
      for (const key of musicTrackKeys(track)) {
        const holders = byTrack.get(key);
        if (!holders) byTrack.set(key, [playlist]);
        else if (!holders.includes(playlist)) holders.push(playlist);
      }
      const identity = musicTrackKeys(track)[0] ?? `${playlist.id}:${track.title}`;
      const fresh = !countedTracks.has(identity);
      countedTracks.add(identity);
      for (const key of musicArtistKeys(track.artist ?? "")) {
        let presence = byArtist.get(key);
        if (!presence) {
          presence = { trackCount: 0, playlists: [] };
          byArtist.set(key, presence);
        }
        if (fresh) presence.trackCount += 1;
        const marker = `${key}::${playlist.id}`;
        if (!countedArtists.has(marker)) {
          countedArtists.add(marker);
          presence.playlists.push(playlist);
        }
      }
    }
  }
  return { ready: true, playlists, byTrack, byArtist };
}

let snapshot: MusicPlaylistIndex = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  // Snapshot: listeners may subscribe or unsubscribe during notification.
  // eslint-disable-next-line unicorn/no-useless-spread
  for (const listener of [...listeners]) listener();
}

function load(): void {
  if (inflight) return;
  inflight = listMusicPlaylists()
    .then((playlists) => {
      snapshot = buildMusicPlaylistIndex(playlists);
      emit();
    })
    .catch(() => {
      snapshot = { ...EMPTY, ready: true };
      emit();
    })
    .finally(() => {
      inflight = null;
    });
}

export function refreshMusicPlaylistIndex(): void {
  inflight = null;
  load();
}

if (typeof window !== "undefined") {
  window.addEventListener("harbor:music-library-changed", refreshMusicPlaylistIndex);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!snapshot.ready) load();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MusicPlaylistIndex {
  return snapshot;
}

export function useMusicPlaylistIndex(): MusicPlaylistIndex {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function trackPlaylistsIn(
  index: MusicPlaylistIndex,
  track: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist"> | null | undefined,
): MusicPlaylist[] {
  if (!track || !index.ready) return NO_PLAYLISTS;
  const seen = new Set<string>();
  const found: MusicPlaylist[] = [];
  for (const key of musicTrackKeys(track)) {
    for (const playlist of index.byTrack.get(key) ?? NO_PLAYLISTS) {
      if (seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      found.push(playlist);
    }
  }
  return found;
}

export function artistPresenceIn(
  index: MusicPlaylistIndex,
  artist: string | null | undefined,
): MusicArtistPresence {
  if (!artist || !index.ready) return NO_PRESENCE;
  const exact = index.byArtist.get(normalize(artist));
  if (exact) return { trackCount: exact.trackCount, playlists: [...exact.playlists] };
  const seen = new Set<string>();
  const playlists: MusicPlaylist[] = [];
  let trackCount = 0;
  for (const key of musicArtistKeys(artist)) {
    const presence = index.byArtist.get(key);
    if (!presence) continue;
    trackCount = Math.max(trackCount, presence.trackCount);
    for (const playlist of presence.playlists) {
      if (seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      playlists.push(playlist);
    }
  }
  return trackCount ? { trackCount, playlists } : NO_PRESENCE;
}

export function useTrackPlaylists(
  track: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist"> | null | undefined,
): MusicPlaylist[] {
  return trackPlaylistsIn(useMusicPlaylistIndex(), track);
}

export function useArtistPlaylists(artist: string | null | undefined): MusicArtistPresence {
  return artistPresenceIn(useMusicPlaylistIndex(), artist);
}

/** The same per-playlist identities used by the artist's song count. */
export function artistPlaylistTracks(playlists: MusicPlaylist[], artist: string): MusicTrack[] {
  const wanted = normalize(artist);
  return playlists.flatMap((playlist) => {
    const seen = new Set<string>();
    return (playlist.tracks ?? []).filter((track) => {
      if (!musicArtistKeys(track.artist).includes(wanted)) return false;
      const key = musicTrackKeys(track)[0] ?? `${playlist.id}:${track.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}
