import { invoke } from "@tauri-apps/api/core";
import { withTimeout } from "@/lib/progressive-rows";
import { invalidateMusicHealth, lanePool, mergeMusicSearchLanes, searchAcrossMusicSources } from "./sources";
import type { RankedMusicSearchResults } from "./sources";
import type {
  MusicAlbumRef,
  MusicArtistRef,
  MusicCatalogRow,
  MusicCatalogItem,
  MusicCatalogKind,
  MusicCatalogPage,
  MusicConnection,
  MusicPlaylistRef,
  MusicSearchResults,
  MusicStationRef,
  MusicTrack,
} from "./types";

export type { MusicSourceRanked, RankedMusicSearchResults } from "./sources";
export { sourceConnectorIdsOf, sourceCountOf, sourceRankOf } from "./sources";

export function loadHomeRows(refresh = false): Promise<MusicCatalogRow[]> {
  return invoke<MusicCatalogRow[]>("music_home_rows", { refresh });
}

export function browseConnector(connector: string): Promise<MusicCatalogRow[]> {
  return invoke<MusicCatalogRow[]>("music_browse_connector", { connector });
}

export function albumTracks(album: MusicAlbumRef): Promise<MusicTrack[]> {
  return invoke<MusicTrack[]>("music_album_tracks", { album });
}

export function artistTop(artist: MusicArtistRef): Promise<MusicTrack[]> {
  return invoke<MusicTrack[]>("music_artist_top", { artist });
}

export function artistRows(artist: MusicArtistRef): Promise<MusicCatalogRow[]> {
  return invoke<MusicCatalogRow[]>("music_artist_rows", { artist });
}

/** Cursor belongs to this exact provider artist and collection; pass it through unchanged. */
export function artistCatalog(
  artist: MusicArtistRef,
  kind: MusicCatalogKind,
  cursor?: string | null,
): Promise<MusicCatalogPage> {
  return invoke<MusicCatalogPage>("music_artist_catalog", { artist, kind, cursor: cursor ?? null });
}

export function catalogPlaylistTracks(playlist: MusicPlaylistRef): Promise<MusicTrack[]> {
  return invoke<MusicTrack[]>("music_catalog_playlist_tracks", { playlist });
}

export function stationTracks(station: MusicStationRef): Promise<MusicTrack[]> {
  return invoke<MusicTrack[]>("music_station_tracks", { station });
}

const SINGLE_SOURCE_TIMEOUT_MS = 12_000;

/**
 * Without a connector this fans out one request per searchable source and merges what comes back,
 * so a source that is slow, failing or repeating itself cannot empty or hold the whole result set.
 * Every returned item carries sourceRank, sourceCount and sourceConnectorIds on both paths.
 */
export async function searchTyped(
  query: string,
  limit = 24,
  connector?: string,
): Promise<RankedMusicSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return { tracks: [], albums: [], artists: [], playlists: [] };
  if (!connector) return searchAcrossMusicSources(trimmed, limit);
  const results = await withTimeout(
    invoke<MusicSearchResults>("music_search_typed", { query: trimmed, limit: lanePool(limit), connector }),
    SINGLE_SOURCE_TIMEOUT_MS,
  );
  return mergeMusicSearchLanes([{ id: connector, results }], limit);
}

export function loadConnections(): Promise<MusicConnection[]> {
  return invoke<MusicConnection[]>("music_connections");
}

export async function connectSource(
  id: string,
  fields: Record<string, string> = {},
): Promise<MusicConnection> {
  const connection = await invoke<MusicConnection>("music_connect", { id, fields });
  invalidateMusicHealth();
  return connection;
}

export async function disconnectSource(id: string): Promise<void> {
  await invoke("music_disconnect", { id });
  invalidateMusicHealth();
}

export function scanLocalFolder(folder: string): Promise<number> {
  return invoke<number>("music_local_scan", { folder });
}

export type LocalMusicPage = { items: MusicCatalogItem[]; nextOffset: number | null };
export function localCollection(
  kind: "albums" | "artists" | "tracks",
  query = "",
  offset = 0,
  artistKey?: string,
): Promise<LocalMusicPage> {
  return invoke("music_local_collection", { kind, query, offset, limit: 48, artistKey });
}
