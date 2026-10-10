import { withTimeout } from "@/lib/progressive-rows";
import { listMusicPlaylists } from "./library";
import { loadSpotifyLibraryPage } from "./spotify-library";
import { cachedTastePool, loadTastePool } from "./taste-pool";
import { mixRecordings } from "./mix-quality";
import { shuffleSurprise } from "./surprise-selection";
import type { MusicTrack } from "./types";

/** Sample different playlists/pages each run without crawling the account before playback. */
async function spotifyPlaylistTaste(signal: AbortSignal): Promise<MusicTrack[]> {
  const tracks: MusicTrack[] = [];
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(6_000)]);
  const work = async () => {
    const page = await loadSpotifyLibraryPage("playlists");
    if (deadline.aborted) return;
    const playlists = shuffleSurprise(page.playlists.filter(playlist => playlist.canRead)).slice(0, 4);
    const worker = async () => {
      while (playlists.length && !deadline.aborted) {
        const playlist = playlists.shift()!;
        const first = await loadSpotifyLibraryPage("playlist", 0, playlist.id).catch(() => null);
        if (deadline.aborted) return;
        if (!first) continue;
        tracks.push(...first.tracks);
        // Include deeper cuts instead of always using the first fifty songs.
        const pages = Math.ceil(Math.min(first.total ?? 0, 100_000) / 50);
        if (pages > 1) {
          const offset = (1 + Math.floor(Math.random() * (pages - 1))) * 50;
          const older = await loadSpotifyLibraryPage("playlist", offset, playlist.id).catch(() => null);
          if (deadline.aborted) return;
          if (older) tracks.push(...older.tracks);
        }
      }
    };
    await Promise.all([worker(), worker()]);
  };
  await withTimeout(work(), 6_000).catch(() => {});
  return signal.aborted ? [] : tracks;
}

export async function loadSurpriseLibrary(primary: boolean, spotifyConnected: boolean, signal: AbortSignal): Promise<MusicTrack[]> {
  if (signal.aborted) return [];
  const [playlists, saved, spotify] = await Promise.all([
    // Read the active profile's current playlists even when Saved and recents are populated.
    withTimeout(listMusicPlaylists(), 6_000).catch(() => []),
    primary && spotifyConnected
      ? withTimeout(loadTastePool(), 6_000).catch(() => cachedTastePool())
      : Promise.resolve({ tracks: [] }),
    primary && spotifyConnected ? spotifyPlaylistTaste(signal) : Promise.resolve([]),
  ]);
  if (signal.aborted) return [];
  return mixRecordings([...playlists.flatMap(playlist => playlist.tracks), ...saved.tracks, ...spotify]);
}
