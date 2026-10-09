import { searchTyped } from "./catalog";
import { artistIdentityKey } from "./artist-authority";
import type { RankedMusicSearchResults } from "./sources";
import type { MusicAlbumRef, MusicArtistRef, MusicTrack } from "./types";

const PER_SEED = 8;
const SHELF = 36;

const EMPTY: RankedMusicSearchResults = { tracks: [], albums: [], artists: [], playlists: [] };

function interleave<T>(lanes: T[][], cap: number, keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const depth = Math.max(0, ...lanes.map((lane) => lane.length));
  for (let index = 0; index < depth && out.length < cap; index += 1) {
    for (const lane of lanes) {
      const item = lane[index];
      if (!item) continue;
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= cap) break;
    }
  }
  return out;
}

export async function resolveRoster(names: readonly string[]): Promise<RankedMusicSearchResults> {
  if (names.length === 0) return EMPTY;
  const lanes = await Promise.all(
    names.map((name) => searchTyped(name, PER_SEED).catch(() => EMPTY)),
  );

  const wanted = new Set(names.map(artistIdentityKey));
  const artists: MusicArtistRef[] = [];
  const claimed = new Set<string>();
  for (const lane of lanes) {
    for (const artist of lane.artists) {
      const id = artistIdentityKey(artist.name);
      if (!wanted.has(id) || claimed.has(id)) continue;
      claimed.add(id);
      artists.push(artist);
      break;
    }
  }

  const trackKey = (track: MusicTrack) => `${track.connectorId ?? ""}:${track.id}`;
  const albumKey = (album: MusicAlbumRef) => `${album.connectorId}:${album.id}`;
  return {
    tracks: interleave(
      lanes.map((lane) => lane.tracks),
      SHELF,
      trackKey,
    ),
    albums: interleave(
      lanes.map((lane) => lane.albums),
      SHELF,
      albumKey,
    ),
    artists,
    playlists: [],
  };
}
