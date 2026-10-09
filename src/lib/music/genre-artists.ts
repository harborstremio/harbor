import { safeFetch } from "@/lib/safe-fetch";
import { matchesGenrePlaylist, parseMusicDiscoveryChart } from "./discovery";
import { musicGenre } from "./genre-catalog";
import type { MusicArtistRef } from "./types";

type Page = { data: unknown[]; next: number | null };
type PlaylistPage = { id: number; offset: number };
export type GenreArtistCursor = {
  chartOffset: number | null;
  chartPages: string[];
  term: number;
  searchOffset: number;
  playlists: PlaylistPage[];
  seenPlaylists: number[];
};
const PAGE_SIZE = 24;
const cache = new Map<string, { until: number; request: Promise<Page> }>();

async function page(path: string, offset: number, limit = PAGE_SIZE): Promise<Page> {
  const separator = path.includes("?") ? "&" : "?";
  const key = `${path}${separator}index=${offset}&limit=${limit}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.request;
  const request = (async () => {
    const response = await safeFetch(`https://api.deezer.com/${key}`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Genre artists unavailable");
    const body = await response.json();
    if (body.error || !Array.isArray(body.data)) throw new Error("Genre artists unavailable");
    // Charts omit `next` and report the page size as `total`; track pages still accept index.
    let next: number | null = null;
    if (path.startsWith("chart/")) next = body.data.length === limit ? offset + limit : null;
    else if (typeof body.next === "string") {
      const value = Number(new URL(body.next, "https://api.deezer.com").searchParams.get("index"));
      if (Number.isSafeInteger(value) && value > offset) next = value;
    }
    return { data: body.data, next };
  })();
  cache.set(key, { until: Date.now() + 15 * 60_000, request });
  while (cache.size > 100) cache.delete(cache.keys().next().value!);
  void request.catch(() => { if (cache.get(key)?.request === request) cache.delete(key); });
  return request;
}

export function firstGenreArtistCursor(genreId: number): GenreArtistCursor {
  const genre = musicGenre(genreId);
  if (!genre) throw new Error("Unknown music genre");
  return { chartOffset: genre.deezerId ? 24 : null, chartPages: [], term: 0, searchOffset: 0, playlists: [], seenPlaylists: [] };
}

/** Continue through genre charts, then genre-matched playlists, without a total artist cap. */
export async function loadGenreArtistPage(
  genreId: number,
  previous: GenreArtistCursor,
  excluded: readonly string[] = [],
): Promise<{ artists: MusicArtistRef[]; next: GenreArtistCursor | null }> {
  const genre = musicGenre(genreId);
  if (!genre) throw new Error("Unknown music genre");
  const cursor: GenreArtistCursor = {
    ...previous, chartPages: [...previous.chartPages], playlists: previous.playlists.map(item => ({ ...item })),
    seenPlaylists: [...previous.seenPlaylists],
  };
  const terms = [...new Set([genre.name, ...genre.aliases])];
  const seen = new Set(excluded);
  const artists: MusicArtistRef[] = [];
  const collect = (entries: unknown[]) => {
    for (const artist of parseMusicDiscoveryChart(entries).artists) {
      if (seen.has(artist.id)) continue;
      seen.add(artist.id);
      artists.push(artist);
    }
  };
  const available = () => cursor.chartOffset !== null || cursor.playlists.length > 0 || cursor.term < terms.length;
  // A duplicate-only page can advance, but one gesture never launches an unbounded crawl.
  for (let requests = 0; requests < 4 && artists.length < 12 && available(); requests++) {
    if (cursor.chartOffset !== null) {
      const result = await page(`chart/${genre.deezerId}/tracks`, cursor.chartOffset);
      const signature = JSON.stringify(result.data.map(item => (item as { id?: unknown })?.id));
      if (cursor.chartPages.includes(signature)) cursor.chartOffset = null;
      else {
        cursor.chartPages.push(signature);
        cursor.chartOffset = result.next;
        collect(result.data);
      }
    } else if (cursor.playlists.length) {
      const playlist = cursor.playlists.shift()!;
      const result = await page(`playlist/${playlist.id}/tracks`, playlist.offset);
      collect(result.data);
      if (result.next !== null) cursor.playlists.push({ ...playlist, offset: result.next });
    } else {
      const result = await page(`search/playlist?q=${encodeURIComponent(terms[cursor.term])}`, cursor.searchOffset, 12);
      for (const value of result.data) {
        if (!value || typeof value !== "object") continue;
        const item = value as { id?: number; title?: string };
        if (!Number.isSafeInteger(item.id) || item.id! <= 0 || typeof item.title !== "string"
          || cursor.seenPlaylists.includes(item.id!) || !matchesGenrePlaylist(item.title, terms)) continue;
        cursor.seenPlaylists.push(item.id!);
        cursor.playlists.push({ id: item.id!, offset: 0 });
      }
      if (result.next === null) { cursor.term++; cursor.searchOffset = 0; }
      else cursor.searchOffset = result.next;
    }
  }
  return { artists, next: available() ? cursor : null };
}
