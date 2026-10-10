import { listMusicPlaylists } from "./library";
import { loadSpotifyLibraryPage } from "./spotify-library";
import { readLocalJson, writeLocalJson } from "./local-store";
import type { MusicPlaylist, MusicTrack } from "./types";

const STORE = "taste-pool";
const PAGES = 4;
const REFRESH_MS = 6 * 60 * 60_000;

export type TastePool = { tracks: MusicTrack[]; playlists: MusicPlaylist[] };

type Saved = { at: number; tracks: MusicTrack[] };

let held: TastePool = { tracks: [], playlists: [] };
let loading: Promise<TastePool> | null = null;

export function cachedTastePool(): TastePool {
  return held;
}

async function spotifyLiked(): Promise<MusicTrack[]> {
  const out: MusicTrack[] = [];
  let offset = 0;
  for (let page = 0; page < PAGES; page += 1) {
    const result = await loadSpotifyLibraryPage("liked", offset).catch(() => null);
    if (!result?.tracks?.length) break;
    out.push(...result.tracks);
    if (result.nextOffset == null) break;
    offset = result.nextOffset;
  }
  return out;
}

export function loadTastePool(): Promise<TastePool> {
  loading ??= (async () => {
    const saved = await readLocalJson<Saved>(STORE);
    const playlists = await listMusicPlaylists().catch(() => [] as MusicPlaylist[]);
    const fresh = saved && Date.now() - saved.at < REFRESH_MS;
    const tracks = fresh ? saved.tracks : await spotifyLiked();
    if (!fresh && tracks.length) writeLocalJson(STORE, { at: Date.now(), tracks });
    held = { tracks: tracks.length ? tracks : (saved?.tracks ?? []), playlists };
    return held;
  })();
  return loading;
}
