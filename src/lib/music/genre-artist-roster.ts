import { safeFetch } from "@/lib/safe-fetch";
import { MUSICBRAINZ_HEADERS, scheduleMusicBrainzRequest } from "./recording-profile";
import { musicGenre, genreSearchKey } from "./genre-catalog";
import type { MusicArtistRef } from "./types";

type ArtistPage = { artists: MusicArtistRef[]; next: number | null };
const PAGE_SIZE = 24;
const cache = new Map<string, { until: number; request: Promise<ArtistPage> }>();
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

/** Chart credits can include crossover guests. Browse the genre's tagged artists directly. */
export function loadGenreArtistRoster(genreId: number, offset = 0): Promise<ArtistPage> {
  const genre = musicGenre(genreId);
  if (!genre || !Number.isSafeInteger(offset) || offset < 0) return Promise.reject(new Error("Unknown music genre"));
  const key = `${genreId}:${offset}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.request;
  const terms = [...new Set([genre.name, ...genre.aliases].flatMap(term => [term.toLowerCase(), genreSearchKey(term)]))];
  const query = `(${terms.map(term => `tag:"${term.replace(/"/g, "")}"`).join(" OR ")}) AND NOT type:other`;
  const request = scheduleMusicBrainzRequest(async () => {
    const response = await safeFetch(`https://musicbrainz.org/ws/2/artist?${new URLSearchParams({ query, offset: String(offset), limit: String(PAGE_SIZE), fmt: "json" })}`, {
      signal: AbortSignal.timeout(12000), headers: MUSICBRAINZ_HEADERS,
    });
    if (!response.ok) throw new Error("Genre artists unavailable");
    const body = await response.json() as { artists?: Array<{ id?: string; name?: string }>; count?: number };
    if (!Array.isArray(body.artists)) throw new Error("Genre artists unavailable");
    const artists: MusicArtistRef[] = body.artists.flatMap(artist => typeof artist.id === "string" && uuid.test(artist.id) && typeof artist.name === "string" && artist.name.trim()
      ? [{ id: `musicbrainz:artist:${artist.id}`, connectorId: "catalog", musicBrainzId: artist.id, name: artist.name.trim() }] : []);
    const following = offset + body.artists.length;
    const more = body.artists.length > 0 && (typeof body.count === "number" ? following < body.count : body.artists.length === PAGE_SIZE);
    return { artists, next: more ? following : null };
  });
  cache.set(key, { until: Date.now() + 30 * 60_000, request });
  while (cache.size > 100) cache.delete(cache.keys().next().value!);
  void request.catch(() => { if (cache.get(key)?.request === request) cache.delete(key); });
  return request;
}
