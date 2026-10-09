import type { MusicTrack } from "./types";
import type { PlaylistGenreIndex } from "./playlist-genre-index";

export type PlaylistSort = "default" | "added" | "title" | "artist" | "album" | "duration";
export type PlaylistView = "list" | "compact";
export type PlaylistFilters = {
  query: string; genre: number | null; source: string; content: "all" | "clean" | "explicit";
  sort: PlaylistSort; descending: boolean; view: PlaylistView;
};
export const DEFAULT_PLAYLIST_FILTERS: PlaylistFilters = {
  query: "", genre: null, source: "all", content: "all", sort: "default", descending: false, view: "list",
};
export type PlaylistMetadata = { genreTracks?: PlaylistGenreIndex; addedAt?: Readonly<Record<string, string>>; recentFirst?: boolean };
export const playlistSource = (track: MusicTrack) => {
  const source = (track.connectorId ?? track.id.split(":")[0]).toLowerCase();
  return ["youtube", "youtubemusic", "youtube-music", "youtube_music"].includes(source) ? "youtube"
    : source === "direct" ? "local" : source;
};
const searchKey = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
const textOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const timestamp = (value?: string) => {
  if (!value) return 0;
  const number = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
  return Number.isFinite(number) ? number : 0;
};

/** Sorting changes the listening view, never the stored playlist order. */
export function filterPlaylist(tracks: readonly MusicTrack[], filters: PlaylistFilters, metadata: PlaylistMetadata = {}): MusicTrack[] {
  const terms = searchKey(filters.query).trim().split(/\s+/).filter(Boolean);
  const genreTracks = filters.genre === null ? null : metadata.genreTracks?.get(filters.genre);
  const matches = tracks.filter(track => {
    if (filters.genre !== null && !genreTracks?.has(track.id)) return false;
    if (filters.source !== "all" && playlistSource(track) !== filters.source) return false;
    if (filters.content !== "all" && track.explicit !== (filters.content === "explicit")) return false;
    if (!terms.length) return true;
    const text = searchKey(`${track.title} ${track.artist} ${track.album ?? ""}`);
    return terms.every(term => text.includes(term));
  });
  const direction = filters.descending ? -1 : 1;
  if (filters.sort === "added" && metadata.recentFirst) return filters.descending ? matches.reverse() : matches;
  if (filters.sort === "added") return matches.sort((a, b) => {
    const left = timestamp(metadata.addedAt?.[a.id]), right = timestamp(metadata.addedAt?.[b.id]);
    // Unknown historic dates stay at the end in either direction.
    if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1;
    return (right - left) * direction;
  });
  if (filters.sort === "duration") return matches.sort((a, b) => {
    if (!a.durationSeconds || !b.durationSeconds) return !a.durationSeconds && !b.durationSeconds ? 0 : !a.durationSeconds ? 1 : -1;
    return (a.durationSeconds - b.durationSeconds) * direction;
  });
  const field = filters.sort;
  if (field === "title" || field === "artist" || field === "album") matches.sort((a, b) => {
    const left = a[field] ?? "", right = b[field] ?? "";
    if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1;
    return textOrder.compare(left, right) * direction;
  });
  return matches;
}
