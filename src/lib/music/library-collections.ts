import type { MusicCatalogItem, MusicPlaylist, MusicTrack } from "./types";

export type MusicCollectionKind = "liked" | "recent" | "playlist" | "album" | "artist";
export type MusicCollectionFilter = "all" | "playlists" | "albums" | "artists" | "tracks";
export type MusicCollectionSort = "recent" | "name" | "size";

export type MusicCollectionEntry = {
  key: string;
  kind: MusicCollectionKind;
  id: string;
  name: string;
  subtitle: string;
  artwork: string[];
  count: number;
  stamp: number;
  pinned: boolean;
  round: boolean;
  item?: MusicCatalogItem;
  playlist?: MusicPlaylist;
};

const artworkOf = (tracks: MusicTrack[]) =>
  tracks
    .map((track) => track.artwork)
    .filter((art): art is string => Boolean(art))
    .slice(0, 4);

const stampOf = (value: string | undefined) => {
  const at = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) ? at : 0;
};

export function likedEntry(tracks: MusicTrack[], name: string, subtitle: string) {
  return {
    key: "liked",
    kind: "liked",
    id: "liked",
    name,
    subtitle,
    artwork: artworkOf(tracks),
    count: tracks.length,
    stamp: Number.MAX_SAFE_INTEGER,
    pinned: true,
    round: false,
  } satisfies MusicCollectionEntry;
}

export function recentEntry(tracks: MusicTrack[], name: string, subtitle: string) {
  return {
    key: "recent",
    kind: "recent",
    id: "recent",
    name,
    subtitle,
    artwork: artworkOf(tracks),
    count: tracks.length,
    stamp: Number.MAX_SAFE_INTEGER - 1,
    pinned: true,
    round: false,
  } satisfies MusicCollectionEntry;
}

export function playlistEntry(playlist: MusicPlaylist, subtitle: string) {
  return {
    key: `playlist:${playlist.id}`,
    kind: "playlist",
    id: playlist.id,
    name: playlist.name,
    subtitle,
    artwork: artworkOf(playlist.tracks),
    count: playlist.tracks.length,
    stamp: stampOf(playlist.updatedAt || playlist.createdAt),
    pinned: false,
    round: false,
    playlist,
  } satisfies MusicCollectionEntry;
}

export function catalogEntry(item: MusicCatalogItem, subtitle: string) {
  if (item.kind === "album")
    return {
      key: `album:${item.connectorId}:${item.id}`,
      kind: "album",
      id: item.id,
      name: item.title,
      subtitle: item.artist || subtitle,
      artwork: item.artwork ? [item.artwork] : [],
      count: item.trackCount ?? 0,
      stamp: 0,
      pinned: false,
      round: false,
      item,
    } satisfies MusicCollectionEntry;
  if (item.kind === "artist")
    return {
      key: `artist:${item.connectorId}:${item.id}`,
      kind: "artist",
      id: item.id,
      name: item.name,
      subtitle: item.subtitle || subtitle,
      artwork: item.artwork ? [item.artwork] : [],
      count: 0,
      stamp: 0,
      pinned: false,
      round: true,
      item,
    } satisfies MusicCollectionEntry;
  return null;
}

const MATCHES: Record<MusicCollectionFilter, (entry: MusicCollectionEntry) => boolean> = {
  all: () => true,
  playlists: (entry) => entry.kind === "playlist" || entry.kind === "liked",
  albums: (entry) => entry.kind === "album",
  artists: (entry) => entry.kind === "artist",
  tracks: () => false,
};

/**
 * Pinned collections stay at the head under every sort. Liked Songs is where people go
 * most and a name sort that buried it under an album would cost more than it gains.
 */
export function arrangeCollections(
  entries: MusicCollectionEntry[],
  filter: MusicCollectionFilter,
  sort: MusicCollectionSort,
  query: string,
): MusicCollectionEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  const kept = entries.filter(
    (entry) =>
      MATCHES[filter](entry) &&
      (!needle ||
        entry.name.toLocaleLowerCase().includes(needle) ||
        entry.subtitle.toLocaleLowerCase().includes(needle)),
  );
  const ranked = [...kept].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) return b.stamp - a.stamp;
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "size") return b.count - a.count;
    return b.stamp - a.stamp || a.name.localeCompare(b.name);
  });
  return ranked;
}
