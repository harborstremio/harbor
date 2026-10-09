export const SPOOKTOBER_PLAYLIST_EVENT = "harbor:spooktober-playlist";
export type SpooktoberPlaylistRequest = { id: string; trackId?: string };
export const SPOOKTOBER_PLAYLISTS = new Set([
  "party",
  "dark",
  "scores",
  "goth",
  "emo",
  "darkpop",
]);
let pending: SpooktoberPlaylistRequest | null = null;

export function requestSpooktoberPlaylist(id: string, trackId?: string): boolean {
  if (!id.startsWith("spooktober:")) return false;
  const playlist = id.slice("spooktober:".length);
  if (!SPOOKTOBER_PLAYLISTS.has(playlist)) return false;
  pending = { id: playlist, trackId };
  window.dispatchEvent(new Event(SPOOKTOBER_PLAYLIST_EVENT));
  return true;
}

export function takeSpooktoberPlaylistRequest(): SpooktoberPlaylistRequest | null {
  const request = pending;
  pending = null;
  return request;
}
