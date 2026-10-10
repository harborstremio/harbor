import { invoke } from "@tauri-apps/api/core";
import type { MusicAlbum, MusicArtist, MusicPlaylist, MusicTrack } from "./types";

export type MusicLibrarySnapshot = {
  albums: MusicAlbum[];
  artists: MusicArtist[];
  playlists: MusicPlaylist[];
};

export async function loadMusicLibrary(): Promise<MusicLibrarySnapshot> {
  const [albums, artists, playlists] = await Promise.all([
    invoke<MusicAlbum[]>("music_list_albums"),
    invoke<MusicArtist[]>("music_list_artists"),
    invoke<MusicPlaylist[]>("music_list_playlists"),
  ]);
  return { albums, artists, playlists };
}

export async function createMusicPlaylist(name: string): Promise<MusicPlaylist> {
  const base = name.trim();
  let candidate = base;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await invoke<MusicPlaylist>("music_create_playlist", { name: candidate });
    } catch (error) {
      // Keep the database's uniqueness guarantee, including concurrent creations.
      if (attempt >= 4 || !/UNIQUE constraint failed:\s*playlists\.name/i.test(String(error))) {
        throw error;
      }
      const playlists = await listMusicPlaylists();
      const names = new Set(playlists.map((playlist) => playlist.name.trim().toLocaleLowerCase()));
      let suffix = 1;
      do {
        candidate = `${base} (${suffix++})`;
      } while (names.has(candidate.toLocaleLowerCase()));
    }
  }
}

export function renameMusicPlaylist(playlistId: string, name: string): Promise<MusicPlaylist> {
  return invoke<MusicPlaylist>("music_rename_playlist", { playlistId, name });
}

export function deleteMusicPlaylist(playlistId: string): Promise<void> {
  return invoke("music_delete_playlist", { playlistId });
}

export function listMusicPlaylists(): Promise<MusicPlaylist[]> {
  return invoke<MusicPlaylist[]>("music_list_playlists");
}

export function addTrackToMusicPlaylist(
  playlistId: string,
  track: MusicTrack,
): Promise<MusicPlaylist> {
  return invoke<MusicPlaylist>("music_add_to_playlist", { playlistId, track });
}

export function addTracksToMusicPlaylist(
  playlistId: string,
  tracks: MusicTrack[],
): Promise<MusicPlaylist> {
  return invoke<MusicPlaylist>("music_add_tracks_to_playlist", { playlistId, tracks });
}

export function reorderMusicPlaylist(
  playlistId: string,
  trackId: string,
  toIndex: number,
): Promise<MusicPlaylist> {
  return invoke<MusicPlaylist>("music_reorder_playlist", { playlistId, trackId, toIndex });
}

export function removeTrackFromMusicPlaylist(
  playlistId: string,
  trackId: string,
): Promise<MusicPlaylist> {
  return invoke<MusicPlaylist>("music_remove_from_playlist", { playlistId, trackId });
}

export function importMusicM3u(path: string): Promise<MusicTrack[]> {
  return invoke<MusicTrack[]>("music_import_m3u", { path });
}

export function exportMusicM3u(playlistId: string, path: string): Promise<void> {
  return invoke("music_export_m3u", { playlistId, path });
}
