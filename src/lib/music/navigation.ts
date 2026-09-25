import type { MusicTrack, MusicAlbumRef, MusicArtistRef } from "./types";

export type MusicExploreRequest = {
  kind: "home" | "artist" | "album" | "videos" | "watch" | "similar";
  track: MusicTrack;
  queue?: MusicTrack[];
  album?: MusicAlbumRef;
  artist?: MusicArtistRef;
};
export const MUSIC_EXPLORE_EVENT = "harbor:music-explore";
let pending: MusicExploreRequest | null = null;
/** Keep requests made from the global dock until Music's lazy view has mounted. */
export function requestMusicExplore(request: MusicExploreRequest) {
  pending = request;
  window.dispatchEvent(new Event(MUSIC_EXPLORE_EVENT));
}
export function takeMusicExploreRequest(): MusicExploreRequest | null {
  const request = pending;
  pending = null;
  return request;
}

export const MUSIC_SEARCH_EVENT = "harbor:music-search";
let pendingSearch: string | null = null;
export function requestMusicSearch(query: string) {
  pendingSearch = query;
  window.dispatchEvent(new Event(MUSIC_SEARCH_EVENT));
}
export function takeMusicSearchRequest(): string | null {
  const query = pendingSearch;
  pendingSearch = null;
  return query;
}

export const MUSIC_GENRE_EVENT = "harbor:music-genre";
let pendingGenre: string | null = null;
export function requestMusicGenre(name: string) {
  pendingGenre = name;
  window.dispatchEvent(new Event(MUSIC_GENRE_EVENT));
}
export function takeMusicGenreRequest(): string | null {
  const name = pendingGenre;
  pendingGenre = null;
  return name;
}

export const MUSIC_PLAYLIST_EVENT = "harbor:music-playlist";
let pendingPlaylist: { id: string; trackId?: string } | null = null;
/** Open a playlist at a track, for the dock title when playback began in one. */
export function requestMusicPlaylist(id: string, trackId?: string) {
  pendingPlaylist = { id, trackId };
  window.dispatchEvent(new Event(MUSIC_PLAYLIST_EVENT));
}
export function takeMusicPlaylistRequest(): { id: string; trackId?: string } | null {
  const request = pendingPlaylist;
  pendingPlaylist = null;
  return request;
}

export const MUSIC_PANEL_EVENT = "harbor:music-panel";
export type MusicPanelRequest = "__audio" | "__speakers";
let pendingPanel: MusicPanelRequest | null = null;
/** Held until the Music view mounts, so one click always lands on the panel. */
export function requestMusicPanel(panel: MusicPanelRequest) {
  pendingPanel = panel;
  window.dispatchEvent(new Event(MUSIC_PANEL_EVENT));
}
export function takeMusicPanelRequest(): MusicPanelRequest | null {
  const panel = pendingPanel;
  pendingPanel = null;
  return panel;
}
