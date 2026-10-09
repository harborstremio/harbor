import {
  loadMusicDiscoveryGenres,
  loadMusicDiscoveryPlaylists,
  loadMusicGenreSelection,
} from "./discovery";
import type { MusicDiscoveryGenre } from "./genre-catalog";
import { searchTyped } from "./catalog";
import { searchableMusicSources } from "./sources";
import type { MusicCatalogItem } from "./types";

export type TopPlaylistItem = Extract<MusicCatalogItem, { kind: "playlist" }>;
export type TopPlaylistLane = { id: string; load: () => Promise<TopPlaylistItem[]> };

const SEARCH_TERMS = ["top hits", "essentials", "best of", "this is", "radio mix"] as const;
const SKIP_SOURCES = new Set(["local", "catalog"]);
const PER_SEARCH = 30;

export function topPlaylistKey(item: TopPlaylistItem): string {
  return `${item.connectorId}:${item.id}`;
}

export function topPlaylistTitleKey(item: TopPlaylistItem): string {
  const name = item.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  const owner = (item.subtitle ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return `${name}|${owner}`;
}

function interleave(lanes: TopPlaylistLane[][]): TopPlaylistLane[] {
  const out: TopPlaylistLane[] = [];
  const depth = Math.max(0, ...lanes.map((lane) => lane.length));
  for (let index = 0; index < depth; index += 1) {
    for (const lane of lanes) {
      const entry = lane[index];
      if (entry) out.push(entry);
    }
  }
  return out;
}

function searchLane(source: string, query: string): TopPlaylistLane {
  return {
    id: `${source}:${query}`,
    load: () =>
      searchTyped(query, PER_SEARCH, source).then((results) =>
        results.playlists.map((playlist) => ({ ...playlist, kind: "playlist" as const })),
      ),
  };
}

export async function topPlaylistLanes(
  genre?: MusicDiscoveryGenre | null,
): Promise<TopPlaylistLane[]> {
  const [genres, sources] = await Promise.all([
    genre ? Promise.resolve([genre]) : loadMusicDiscoveryGenres().catch(() => []),
    searchableMusicSources().catch(() => [] as string[]),
  ]);
  const live = sources.filter((source) => !SKIP_SOURCES.has(source));
  const charted = genres.flatMap((entry) => (entry.deezerId ? [entry.deezerId] : []));
  const editorial: TopPlaylistLane[] = [...new Set(charted)].map((deezerId) => ({
    id: `chart:${deezerId}`,
    load: () => loadMusicDiscoveryPlaylists(deezerId),
  }));
  if (!genre) editorial.unshift({ id: "chart:0", load: () => loadMusicDiscoveryPlaylists(0) });
  if (genre && !genre.deezerId)
    editorial.push({
      id: `selection:${genre.id}`,
      load: () => loadMusicGenreSelection(genre.id).then((result) => result.playlists),
    });

  const terms = genre
    ? [genre.name, ...genre.aliases.slice(0, 1), `${genre.name} mix`, `best ${genre.name}`]
    : [...SEARCH_TERMS];
  const connected: TopPlaylistLane[] = [];
  for (const term of terms) for (const source of live) connected.push(searchLane(source, term));
  return interleave([editorial, connected]);
}
