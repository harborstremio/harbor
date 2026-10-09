import { safeFetch } from "@/lib/safe-fetch";
import { artistIdentityKey } from "./artist-popularity";
import type { MusicArtistRef } from "./types";

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter((row): row is Row => !!row && typeof row === "object") : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const TIMEOUT_MS = 7000;
const LISTS_PER_SEED = 6;
const TRACKS_PER_LIST = 80;
const MIN_LIST_ARTISTS = 4;
// A grab-bag of a hundred artists says nothing about any one of them.
const MAX_LIST_ARTISTS = 60;
const MIN_SHARED_LISTS = 2;

const cache = new Map<string, MusicArtistRef[]>();

async function deezer(path: string, signal: AbortSignal): Promise<Row> {
  const response = await safeFetch(`https://api.deezer.com/${path}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Error("Playlist neighbours unavailable");
  const value = await response.json();
  const payload = (value && typeof value === "object" ? value : {}) as Row;
  if (payload.error) throw Error("Playlist neighbours unavailable");
  return payload;
}

/**
 * Artists the wider listening public files alongside this one. Each shared playlist counts
 * for less the longer it is, so a focused mixtape outweighs an everything bucket, and an
 * artist has to turn up on more than one list before it can reach the queue.
 */
export async function playlistNeighbours(name: string, signal: AbortSignal, limit = 12): Promise<MusicArtistRef[]> {
  const seed = artistIdentityKey(name);
  if (!seed) return [];
  const held = cache.get(seed);
  if (held) return held.slice(0, limit);
  const found = new Map<string, { ref: MusicArtistRef; lists: number; score: number }>();
  try {
    const search = await deezer(`search/playlist?q=${encodeURIComponent(name)}&limit=12`, signal);
    const lists = rows(search.data)
      .filter(row => count(row.nb_tracks) >= 15 && count(row.nb_tracks) <= 400)
      .slice(0, LISTS_PER_SEED);
    const details = await Promise.all(lists.map(list => {
      const id = count(list.id);
      return id ? deezer(`playlist/${id}?limit=${TRACKS_PER_LIST}`, signal).catch(() => null) : null;
    }));
    for (const detail of details) {
      if (signal.aborted) break;
      if (!detail) continue;
      const credits = new Map<string, MusicArtistRef>();
      for (const track of rows((detail.tracks as Row | undefined)?.data)) {
        const artist = (track.artist && typeof track.artist === "object" ? track.artist : {}) as Row;
        const artistId = count(artist.id), artistName = text(artist.name), key = artistIdentityKey(artistName);
        if (!artistId || !key || key === seed) continue;
        if (!credits.has(key)) credits.set(key, { id: `deezer:artist:${artistId}`, connectorId: "catalog", name: artistName, artwork: text(artist.picture_big) || undefined });
      }
      if (credits.size < MIN_LIST_ARTISTS || credits.size > MAX_LIST_ARTISTS) continue;
      const weight = 1 / Math.sqrt(credits.size);
      for (const [key, ref] of credits) {
        const entry = found.get(key) ?? { ref, lists: 0, score: 0 };
        entry.lists += 1;
        entry.score += weight;
        found.set(key, entry);
      }
    }
  } catch { /* A quiet lane is better than a failed mix. */ }
  const ranked = [...found.values()].filter(entry => entry.lists >= MIN_SHARED_LISTS)
    .sort((a, b) => b.score - a.score).map(entry => entry.ref);
  if (ranked.length) {
    cache.set(seed, ranked);
    while (cache.size > 80) cache.delete(cache.keys().next().value!);
  }
  return ranked.slice(0, limit);
}
