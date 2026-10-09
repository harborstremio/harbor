import { safeFetch, safeFetchBytes } from "@/lib/safe-fetch";
import { loadRecordingProfile } from "./recording-profile";
import { loadArtistProfile } from "./artist-profile";
import { MUSIC_GENRES } from "./genre-catalog";
import { genreMatchesTags } from "./genre-membership";
import { compatibleVocalVersion } from "./source-version";
import { decodeSnippetEnergy, type SnippetEnergy } from "./snippet-energy";
import type { MusicArtistRef, MusicTrack } from "./types";

export const SNIPPET_SECONDS = 30;
export type MusicSnippet = { track: MusicTrack; url: string | null; artist?: MusicArtistRef; genres: number[] };
const cache = new Map<string, { until: number; value: MusicSnippet }>();
const snippetKey = (track: MusicTrack) => `${track.connectorId}:${track.id}:${track.title}:${track.artist}`;

function rememberSnippet(value: MusicSnippet): void {
  cache.set(snippetKey(value.track), { until: Date.now() + (value.url ? 5 * 60_000 : 30_000), value });
  while (cache.size > 160) cache.delete(cache.keys().next().value!);
}

/** Catalog recommendations already contain preview URLs; reuse them without a per-track lookup. */
export function snippetTracksFromCatalog(value: unknown): MusicTrack[] {
  if (!Array.isArray(value)) return [];
  const tracks: MusicTrack[] = [];
  for (const row of value.slice(0, 100)) {
    const url = validSnippetUrl(row?.preview);
    if (!url || !Number.isSafeInteger(row?.id) || row.id <= 0 || typeof row.title !== "string" || typeof row.artist?.name !== "string") continue;
    const duration = typeof row.duration === "number" && Number.isFinite(row.duration) ? Math.max(0, Math.floor(row.duration)) : 0;
    const artwork = [row.album?.cover_xl, row.album?.cover_big, row.album?.cover_medium].find(value => typeof value === "string" && value.startsWith("https://")) ?? "";
    const track: MusicTrack = {
      id: `deezer:track:${row.id}`, sourceId: String(row.id), connectorId: "catalog", mediaKind: "audio",
      title: row.title, artist: row.artist.name, album: typeof row.album?.title === "string" ? row.album.title : undefined,
      artwork, durationSeconds: duration, durationLabel: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
      explicit: typeof row.explicit_lyrics === "boolean" ? row.explicit_lyrics : undefined,
    };
    rememberSnippet({ track, url, genres: [], artist: Number.isSafeInteger(row.artist.id) && row.artist.id > 0
      ? { id: `deezer:artist:${row.artist.id}`, name: row.artist.name, artwork: typeof row.artist.picture_big === "string" ? row.artist.picture_big : "", connectorId: "catalog" } : undefined });
    tracks.push(track);
  }
  return tracks;
}

/** Preview URLs are kept separate: they must never be mistaken for a full playback source. */
export function validSnippetUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && /(^|\.)dzcdn\.net$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

export async function loadMusicSnippet(track: MusicTrack, signal?: AbortSignal): Promise<MusicSnippet> {
  const key = snippetKey(track);
  signal?.throwIfAborted();
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.value;
  // Radio results already have an exact catalog ID; don't run artist-credit discovery first.
  const profile = /^deezer:track:\d+$/.test(track.id) ? null : await loadRecordingProfile(track, signal);
  signal?.throwIfAborted();
  const catalogTrack = profile?.catalogTrack;
  const id = /^deezer:track:(\d+)$/.exec(catalogTrack?.id ?? track.id)?.[1];
  const result: MusicSnippet = { track, url: null, artist: profile?.primaryArtist, genres: [] };
  if (id && (!catalogTrack || compatibleVocalVersion(track, catalogTrack))) {
    const response = await safeFetch(`https://api.deezer.com/track/${id}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
    if (response.ok) {
      const data = await response.json() as { id?: number; preview?: string; explicit_lyrics?: boolean; artist?: { id?: number; name?: string; picture_big?: string } };
      if (String(data.id) === id) {
        result.url = validSnippetUrl(data.preview);
        if (!result.artist && data.artist?.id && data.artist.name) result.artist = { id: `deezer:artist:${data.artist.id}`, name: data.artist.name, artwork: data.artist.picture_big ?? "", connectorId: "catalog" };
        result.track = { ...track, ...(catalogTrack ? { title: catalogTrack.title, artist: catalogTrack.artist, album: catalogTrack.album, artwork: catalogTrack.artwork || track.artwork } : {}), explicit: typeof data.explicit_lyrics === "boolean" ? data.explicit_lyrics : track.explicit };
      }
    }
  }
  signal?.throwIfAborted();
  rememberSnippet(result);
  return result;
}

export type PreparedMusicSnippet = MusicSnippet & { url: string; energy: Promise<SnippetEnergy | null>; dispose: () => void };

/** Admit only decoded audio. Playing the same buffered bytes avoids a second CDN request. */
export async function prepareMusicSnippet(track: MusicTrack, signal: AbortSignal): Promise<PreparedMusicSnippet | null> {
  const snippet = await loadMusicSnippet(track, signal);
  signal.throwIfAborted();
  if (!snippet.url) return null;
  const maxBytes = 4 * 1024 * 1024;
  // The desktop text bridge decodes bytes as UTF-8; audio must use its binary transport.
  const response = await safeFetchBytes(snippet.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }, 8000, maxBytes).catch(error => { cache.delete(snippetKey(track)); throw error; });
  if (!response.ok) { cache.delete(snippetKey(track)); return null; }
  if (Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); return null; }
  const type = response.headers.get("content-type")?.split(";")[0] ?? "audio/mpeg";
  if (!type.startsWith("audio/") && type !== "application/octet-stream") { await response.body?.cancel(); return null; }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) return null;
      parts.push(new Uint8Array(value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!size) return null;
  signal.throwIfAborted();
  const blob = new Blob(parts, { type: type === "application/octet-stream" ? "audio/mpeg" : type });
  const url = URL.createObjectURL(blob);
  const probe = new Audio();
  probe.preload = "auto";
  const decoded = await new Promise<boolean>(resolve => {
    const finish = (valid: boolean) => {
      clearTimeout(timer); signal.removeEventListener("abort", abort);
      probe.oncanplay = probe.onerror = null; resolve(valid);
    };
    const abort = () => finish(false);
    const timer = setTimeout(abort, 8000);
    probe.oncanplay = () => finish(Number.isFinite(probe.duration) && probe.duration > 1);
    probe.onerror = abort;
    signal.addEventListener("abort", abort, { once: true });
    probe.src = url; probe.load();
  });
  probe.removeAttribute("src"); probe.load();
  if (!decoded || signal.aborted) { URL.revokeObjectURL(url); if (!signal.aborted) cache.delete(snippetKey(track)); return null; }
  // Analyze in the background: the first playable card never waits for visual processing.
  return { ...snippet, url, energy: decodeSnippetEnergy(blob, signal), dispose: () => URL.revokeObjectURL(url) };
}

export async function loadSnippetGenres(artist: MusicArtistRef, signal?: AbortSignal): Promise<number[]> {
  const profile = await loadArtistProfile(artist, "en", signal, false);
  return MUSIC_GENRES.filter(genre => genreMatchesTags(genre, profile?.genres ?? [])).slice(0, 4).map(genre => genre.id);
}
