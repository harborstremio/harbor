import { MUSIC_GENRES, genreSearchKey } from "./genre-catalog";
import { genreMatchesTags } from "./genre-membership";
import { artistCreditParts } from "./search-artists";
import type { MusicTrack } from "./types";

export type PlaylistGenreIndex = ReadonlyMap<number, ReadonlySet<string>>;

/** One index per collection, built in small slices from known tags only. */
export async function indexPlaylistGenres(tracks: readonly MusicTrack[], known: ReadonlyMap<string, readonly string[]>, signal?: AbortSignal): Promise<PlaylistGenreIndex> {
  const result = new Map<number, Set<string>>();
  if (!known.size) return result;
  const credits = new Map<string, number[]>();
  const tagged = new Map<string, number[]>();
  let sliceStart = performance.now();
  for (let at = 0; at < tracks.length; at++) {
    if (signal?.aborted) return new Map();
    const track = tracks[at];
    let ids = credits.get(track.artist);
    if (!ids) {
      const key = genreSearchKey(artistCreditParts(track.artist)[0] ?? track.artist);
      ids = tagged.get(key);
      if (!ids) {
        const tags = known.get(key);
        ids = tags?.length ? MUSIC_GENRES.filter(genre => genreMatchesTags(genre, tags)).map(genre => genre.id) : [];
        tagged.set(key, ids);
      }
      credits.set(track.artist, ids);
    }
    for (const id of ids) {
      let matches = result.get(id);
      if (!matches) result.set(id, matches = new Set());
      matches.add(track.id);
    }
    if (performance.now() - sliceStart > 4) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
  return new Map([...result].sort((a, b) => b[1].size - a[1].size));
}
