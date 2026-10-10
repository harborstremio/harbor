import type { MusicTrack, MusicAlbumRef, MusicArtistRef } from "./types";
import { requestSpooktoberPlaylist } from "../spooktober-navigation";

export type MusicExploreRequest = {
  kind: "home" | "artist" | "album" | "videos" | "watch" | "similar";
  track: MusicTrack;
  queue?: MusicTrack[];
  album?: MusicAlbumRef;
  artist?: MusicArtistRef;
  label?: string;
  contextId?: string;
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

export const MUSIC_LABEL_EVENT = "harbor:music-label";
let pendingLabel: { id: string; name: string } | null = null;
export function requestMusicLabel(id: string, name: string) {
  pendingLabel = { id, name };
  window.dispatchEvent(new Event(MUSIC_LABEL_EVENT));
}
export function takeMusicLabelRequest(): { id: string; name: string } | null {
  const label = pendingLabel;
  pendingLabel = null;
  return label;
}

export const MUSIC_PLAYLIST_EVENT = "harbor:music-playlist";
let pendingPlaylist: { id: string; trackId?: string } | null = null;
/** Open a playlist at a track, for the dock title when playback began in one. */
export function requestMusicPlaylist(id: string, trackId?: string) {
  if (requestSpooktoberPlaylist(id, trackId)) return;
  pendingPlaylist = { id, trackId };
  window.dispatchEvent(new Event(MUSIC_PLAYLIST_EVENT));
}
export function takeMusicPlaylistRequest(): { id: string; trackId?: string } | null {
  const request = pendingPlaylist;
  pendingPlaylist = null;
  return request;
}

export const MUSIC_PLAY_EVENT = "harbor:music-play";
let pendingPlay: { track: MusicTrack; queue: MusicTrack[] } | null = null;
/** The quick dock lives outside the Music view, where the source picker context does not exist. */
export function requestMusicPlay(track: MusicTrack, queue: MusicTrack[] = []) {
  pendingPlay = { track, queue };
  window.dispatchEvent(new Event(MUSIC_PLAY_EVENT));
}
export function takeMusicPlayRequest(): { track: MusicTrack; queue: MusicTrack[] } | null {
  const request = pendingPlay;
  pendingPlay = null;
  return request;
}

export const MUSIC_LIBRARY_EVENT = "harbor:music-library";
export type MusicLibraryRequest = {
  view?: string;
  playlistId?: string;
  spotifyKind?: "playlists" | "liked";
};
let pendingLibrary: MusicLibraryRequest | null = null;
/** Open a library view, for the dock menu when playback began in Saved or a connected account. */
export function requestMusicLibrary(target: MusicLibraryRequest) {
  pendingLibrary = target;
  window.dispatchEvent(new Event(MUSIC_LIBRARY_EVENT));
}
export function takeMusicLibraryRequest(): MusicLibraryRequest | null {
  const request = pendingLibrary;
  pendingLibrary = null;
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
