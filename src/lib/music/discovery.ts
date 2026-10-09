import { safeFetch } from "@/lib/safe-fetch";
import type { MusicCatalogItem, MusicTrack } from "./types";
import { MUSIC_GENRES, musicGenre, genreSearchKey } from "./genre-catalog";
import { EDITORIAL_SCENES } from "./genre-editorial";
import { loadEditorialRecordings } from "./genre-editorial-loader";
import { isPlaylistScene, loadGenrePlaylistPage } from "./genre-playlist-pool";
import type { MusicDiscoveryGenre } from "./genre-catalog";
export type { MusicDiscoveryGenre } from "./genre-catalog";

export type MusicDiscoveryChart = {
  tracks: MusicTrack[];
  positions: (number | null)[];
  artists: Extract<MusicCatalogItem, { kind: "artist" }>[];
  popularity?: Record<string, number>;
  albums?: Extract<MusicCatalogItem, { kind: "album" }>[];
};

type RecordValue = Record<string, unknown>;
const cache = new Map<string, { at: number; data: unknown[] }>();
const pending = new Map<string, Promise<unknown[]>>();
const CACHE_MS = 15 * 60 * 1000;

function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" ? (value as RecordValue) : {};
}

function label(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function image(...values: unknown[]): string {
  return values.map(label).find((value) => value.startsWith("https://")) ?? "";
}

async function entries(path: string): Promise<unknown[]> {
  const stored = cache.get(path);
  if (stored && Date.now() - stored.at < CACHE_MS) return stored.data;
  const active = pending.get(path);
  if (active) return active;
  const request = (async () => {
    const response = await safeFetch(`https://api.deezer.com/${path}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Deezer: ${response.status}`, {cause: {status: response.status}});
    const body = record(await response.json());
    if (body.error || !Array.isArray(body.data)) throw new Error("Deezer discovery unavailable", {cause: {deezerCode: record(body.error).code}});
    cache.set(path, { at: Date.now(), data: body.data });
    return body.data;
  })().finally(() => {
    pending.delete(path);
  });
  pending.set(path, request);
  return request;
}

export async function loadMusicDiscoveryGenres(): Promise<MusicDiscoveryGenre[]> {
  return MUSIC_GENRES;
}

export function parseMusicDiscoveryChart(data: unknown[]): MusicDiscoveryChart {
  const tracks: MusicTrack[] = [];
  const positions: (number | null)[] = [];
  const artists = new Map<string, Extract<MusicCatalogItem, { kind: "artist" }>>();
  const seen = new Set<number>();
  const popularity: Record<string, number> = {};
  const albums = new Map<number, Extract<MusicCatalogItem, { kind: "album" }>>();
  for (const value of data) {
    const entry = record(value);
    const credit = record(entry.artist);
    const album = record(entry.album);
    const id = Number(entry.id);
    const title = label(entry.title);
    const artist = label(credit.name);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || !title || !artist) continue;
    seen.add(id);
    if (typeof entry.rank === "number" && Number.isFinite(entry.rank) && entry.rank > 0) popularity[`deezer:track:${id}`] = entry.rank;
    const albumId = Number(album.id);
    if (Number.isSafeInteger(albumId) && albumId > 0 && label(album.title)) albums.set(albumId, {
      kind: "album", id: `deezer:album:${albumId}`, connectorId: "catalog", title: label(album.title), artist,
      artwork: image(album.cover_xl, album.cover_big, album.cover_medium),
    });
    const duration =
      typeof entry.duration === "number" && Number.isFinite(entry.duration)
        ? Math.max(0, Math.floor(entry.duration))
        : 0;
    tracks.push({
      id: `deezer:track:${id}`,
      sourceId: String(id),
      connectorId: "catalog",
      title,
      artist,
      album: label(album.title) || undefined,
      artwork: image(album.cover_xl, album.cover_big, album.cover_medium),
      durationSeconds: duration,
      durationLabel: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
          explicit: entry.explicit_lyrics === true || undefined,
    });
    positions.push(
      typeof entry.position === "number" &&
        Number.isSafeInteger(entry.position) &&
        entry.position > 0
        ? entry.position
        : null,
    );
    const artistId = Number(credit.id);
    if (Number.isSafeInteger(artistId) && artistId > 0 && !artists.has(String(artistId))) {
      artists.set(String(artistId), {
        kind: "artist",
        id: `deezer:artist:${artistId}`,
        connectorId: "catalog",
        name: artist,
        artwork: image(credit.picture_big, credit.picture_medium, credit.picture_xl),
      });
    }
  }
  return { tracks, positions, artists: [...artists.values()], albums: [...albums.values()], popularity };
}

export async function loadMusicDiscoveryChart(genreId = 0): Promise<MusicDiscoveryChart> {
  if (!Number.isSafeInteger(genreId) || genreId < 0) throw new Error("Invalid music genre");
  const genre = musicGenre(genreId);
  if (genre && !genre.deezerId) return loadMusicGenreSelection(genreId);
  if (genreId !== 0 && !genre) throw new Error("Unknown music genre");
  // The genre artist endpoint currently ignores its filter. Credits from these genre charts
  // keep artist browsing relevant and avoid a second provider request.
  return parseMusicDiscoveryChart(await entries(`chart/${genreId}/tracks?limit=24`));
}

type DiscoveryPlaylist = Extract<MusicCatalogItem, { kind: "playlist" }>;
export type MusicGenreSelection = MusicDiscoveryChart & { playlists: DiscoveryPlaylist[] };

/** Match whole genre terms: a search hit alone is not evidence of genre membership. */
export function matchesGenrePlaylist(title: string, terms: readonly string[]): boolean {
  const name = ` ${genreSearchKey(title)} `;
  return terms.some(term => name.includes(` ${genreSearchKey(term)} `));
}

export async function loadMusicGenreSelection(genreId: number): Promise<MusicGenreSelection> {
  const genre = musicGenre(genreId);
  if (!genre) throw new Error("Unknown music genre");
  if (genre.deezerId) return { ...await loadMusicDiscoveryChart(genre.deezerId), playlists: [] };
  if (isPlaylistScene(genre.slug)) {
    const page = await loadGenrePlaylistPage(genre, 0, entries);
    const playlists: DiscoveryPlaylist[] = page.playlists.map(value => {
      const entry = record(value), artwork = image(entry.picture_xl, entry.picture_big, entry.picture_medium);
      return {kind: "playlist", id: `deezer:playlist:${entry.id}`, connectorId: "catalog", name: label(entry.title),
        artwork: artwork ? [artwork] : [], trackCount: typeof entry.nb_tracks === "number" ? entry.nb_tracks : undefined,
        subtitle: label(record(entry.user).name) || "Deezer"};
    });
    return {...parseMusicDiscoveryChart(page.data), playlists};
  }
  if (EDITORIAL_SCENES[genre.slug]) {
    const page = await loadEditorialRecordings(genre.slug, 0, entries);
    return {...parseMusicDiscoveryChart(page.data), playlists: []};
  }
  const query = genre.aliases[0] && ["hardcore", "regional-mexican"].includes(genre.slug)
    ? genre.aliases[0] : genre.name;
  const results = await entries(`search/playlist?q=${encodeURIComponent(query)}&limit=50`);
  const playlists: DiscoveryPlaylist[] = results.flatMap(value => {
    const entry = record(value), id = Number(entry.id), name = label(entry.title);
    if (!Number.isSafeInteger(id) || id <= 0 || !matchesGenrePlaylist(name, [genre.name, ...genre.aliases])) return [];
    const artwork = image(entry.picture_xl, entry.picture_big, entry.picture_medium);
    return [{ kind: "playlist" as const, id: `deezer:playlist:${id}`, connectorId: "catalog", name,
      artwork: artwork ? [artwork] : [], trackCount: typeof entry.nb_tracks === "number" ? entry.nb_tracks : undefined,
      subtitle: label(record(entry.user).name) || "Deezer" }];
  }).slice(0, 24);
  // Two playlists give breadth without fan-out for every genre tile or artist.
  const pages = await Promise.allSettled(playlists.slice(0, 2).map(playlist =>
    entries(`playlist/${playlist.id.split(":").at(-1)}/tracks?limit=24`)));
  if (pages.length && pages.every(page => page.status === "rejected")) throw new Error("Genre selections unavailable");
  const lanes = pages.flatMap(page => page.status === "fulfilled" ? [page.value] : []);
  const mixed: unknown[] = [];
  for (let index = 0; index < 24; index++) for (const lane of lanes) if (lane[index]) mixed.push(lane[index]);
  const parsed = parseMusicDiscoveryChart(mixed);
  return { ...parsed, tracks: parsed.tracks.slice(0, 30), positions: parsed.tracks.slice(0, 30).map(() => null), playlists };
}

const DEEP_LIMIT = 50;
const DEEP_CHART_START = 24;
const DEEP_LIST_START = 2;
const DEEP_LIST_STEP = 3;

export type MusicGenreTracksPage = MusicDiscoveryChart & { done: boolean };

/** Deezer serves chart tracks by index and playlist tracks per list, so depth pages differently per genre kind. */
export async function loadMusicGenreTracksPage(
  genreId: number,
  page: number,
): Promise<MusicGenreTracksPage> {
  const genre = musicGenre(genreId);
  if (!genre) throw new Error("Unknown music genre");
  if (isPlaylistScene(genre.slug)) {
    const result = await loadGenrePlaylistPage(genre, page + 1, entries);
    return {...parseMusicDiscoveryChart(result.data), done: result.done};
  }
  if (EDITORIAL_SCENES[genre.slug]) {
    const result = await loadEditorialRecordings(genre.slug, page + 1, entries);
    return {...parseMusicDiscoveryChart(result.data), done: result.done};
  }
  if (genre.deezerId) {
    const index = DEEP_CHART_START + page * DEEP_LIMIT;
    const parsed = parseMusicDiscoveryChart(
      await entries(`chart/${genre.deezerId}/tracks?limit=${DEEP_LIMIT}&index=${index}`),
    );
    return { ...parsed, done: parsed.tracks.length < DEEP_LIMIT };
  }
  const { playlists } = await loadMusicGenreSelection(genreId);
  const from = DEEP_LIST_START + page * DEEP_LIST_STEP;
  const slice = playlists.slice(from, from + DEEP_LIST_STEP);
  if (slice.length === 0)
    return { tracks: [], positions: [], artists: [], albums: [], popularity: {}, done: true };
  const pages = await Promise.allSettled(
    slice.map((playlist) => entries(`playlist/${playlist.id.split(":").at(-1)}/tracks?limit=${DEEP_LIMIT}`)),
  );
  const lanes = pages.flatMap((page) => (page.status === "fulfilled" ? [page.value] : []));
  const mixed: unknown[] = [];
  for (let index = 0; index < DEEP_LIMIT; index++)
    for (const lane of lanes) if (lane[index]) mixed.push(lane[index]);
  const parsed = parseMusicDiscoveryChart(mixed);
  return { ...parsed, done: from + DEEP_LIST_STEP >= playlists.length };
}

export type MusicGenreArtist = { id: string; name: string; artwork: string; fans: number; score: number };

const fanIndexes = new Map<number, Promise<Record<string, number>>>();

/** Deezer's chart artist endpoint ignores the genre filter, so it is only good as a fan lookup. */
function genreFanIndex(genreId: number): Promise<Record<string, number>> {
  let held = fanIndexes.get(genreId);
  if (held) return held;
  held = entries(`chart/${genreId}/artists?limit=100`)
    .then((rows) => {
      const out: Record<string, number> = {};
      for (const value of rows) {
        const entry = record(value);
        const id = Number(entry.id);
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        if (typeof entry.nb_fan === "number" && Number.isFinite(entry.nb_fan))
          out[`deezer:artist:${id}`] = entry.nb_fan;
      }
      return out;
    })
    .catch(() => ({}));
  fanIndexes.set(genreId, held);
  return held;
}

/** The artist list comes from this genre's own track credits; only the fan count is borrowed. */
export async function loadMusicGenreArtistsPage(
  genreId: number,
  page: number,
): Promise<{ artists: MusicGenreArtist[]; done: boolean }> {
  const genre = musicGenre(genreId);
  if (!genre) throw new Error("Unknown music genre");
  const [deep, fans] = await Promise.all([
    loadMusicGenreTracksPage(genreId, page),
    genreFanIndex(genre.deezerId || 0),
  ]);
  const peak = new Map<string, number>();
  for (const track of deep.tracks) {
    const key = track.artist.trim().toLocaleLowerCase();
    if (!key) continue;
    const rank = deep.popularity?.[track.id] ?? 0;
    peak.set(key, Math.max(peak.get(key) ?? 0, rank));
  }
  return {
    artists: (deep.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      artwork: typeof artist.artwork === "string" ? artist.artwork : (artist.artwork?.[0] ?? ""),
      fans: fans[artist.id] ?? 0,
      score: peak.get(artist.name.trim().toLocaleLowerCase()) ?? 0,
    })),
    done: deep.done,
  };
}

export async function loadMusicDiscoveryPlaylists(
  genreId = 0,
  limit = 50,
): Promise<Extract<MusicCatalogItem, { kind: "playlist" }>[]> {
  return (await entries(`chart/${genreId}/playlists?limit=${limit}`)).flatMap((value) => {
    const entry = record(value);
    const id = Number(entry.id);
    if (!Number.isSafeInteger(id) || id <= 0 || !label(entry.title)) return [];
    const artwork = image(entry.picture_xl, entry.picture_big, entry.picture_medium);
    return [
      {
        kind: "playlist" as const,
        id: `deezer:playlist:${id}`,
        connectorId: "catalog",
        name: label(entry.title),
        artwork: artwork ? [artwork] : [],
        trackCount: typeof entry.nb_tracks === "number" ? entry.nb_tracks : undefined,
        subtitle: label(record(entry.user).name) || "Deezer",
      },
    ];
  });
}
