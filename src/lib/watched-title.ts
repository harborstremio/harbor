import { watchTitleKey, type WatchedSet } from "@/lib/playback-history";
import { tmdbFromImdbCached, tmdbImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";

type TitleRef = { id?: string; name?: string };

export function metaTitleKey(meta: { id?: string }): string | null {
  const id = meta.id;
  if (!id) return null;
  if (/^tt\d+$/.test(id)) return `imdb:${id}`;
  if (id.startsWith("tmdb:")) {
    const num = Number(id.split(":")[2]);
    if (Number.isFinite(num)) return `tmdb:${num}`;
  }
  return null;
}

// Trakt history is episode level (`imdb:tt123:1:2`); folding to `imdb:tt123`
// makes a show count as watched once any episode has been, matching catalog rows.
export function collapseWatchedKeys(watched: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const key of watched) {
    const parts = key.split(":");
    if (parts.length >= 2) out.add(`${parts[0]}:${parts[1]}`);
  }
  return out;
}

// Watch stores are keyed by raw meta id, so a title marked watched under `tt…`
// must still match a `tmdb:…` card (and the reverse) when the mapping is cached.
function watchedIdCandidates(meta: TitleRef): string[] {
  const id = meta.id;
  if (!id) return [];
  const out = [id];
  for (const alt of [tmdbImdbCached(id), tmdbFromImdbCached(id)]) {
    if (alt && !out.includes(alt)) out.push(alt);
  }
  return out;
}

export type WatchedLookup = {
  traktKeys?: Set<string>;
  localWatched?: WatchedSet;
  stremioWatched?: Set<string>;
  watchedFlags?: Set<string>;
  movieWatched?: Set<string>;
};

export function isTitleWatched(meta: TitleRef, lookup: WatchedLookup): boolean {
  const { traktKeys, localWatched, stremioWatched, watchedFlags, movieWatched } = lookup;
  const ids = watchedIdCandidates(meta);
  if (ids.some((id) => stremioWatched?.has(id))) return true;
  if (ids.some((id) => watchedFlags?.has(id) || movieWatched?.has(id))) return true;
  const key = metaTitleKey(meta);
  if (key && traktKeys?.has(key)) return true;
  if (localWatched) {
    if (ids.some((id) => localWatched.ids.has(id))) return true;
    const titleKey = watchTitleKey(meta.name);
    if (titleKey && localWatched.titles.has(titleKey)) return true;
  }
  return false;
}
