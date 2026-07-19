import type { SearchResults } from "./search.ts";
import { normalizeSearchQuery } from "./search-query.ts";

export type SearchDisplayState = {
  currentResults: SearchResults | null;
  hasResults: boolean;
  noResults: boolean;
  tmdbUnavailable: boolean;
};

export function getSearchDisplayState(
  results: SearchResults | null,
  query: string,
  status: "idle" | "typing" | "loading" | "done",
): SearchDisplayState {
  const normalizedQuery = normalizeSearchQuery(query);
  const currentResults =
    normalizedQuery && results && normalizeSearchQuery(results.query) === normalizedQuery
      ? results
      : null;
  const hasResults = !!(
    currentResults &&
    (currentResults.topMatch ||
      currentResults.people.length ||
      currentResults.movies.length ||
      currentResults.series.length ||
      currentResults.liveTv.length ||
      currentResults.anime.length ||
      currentResults.addons.length ||
      currentResults.addonGroups.length)
  );
  const tmdbUnavailable = !!currentResults?.tmdbUnavailable;

  return {
    currentResults,
    hasResults,
    noResults: !!currentResults && status === "done" && !hasResults && !tmdbUnavailable,
    tmdbUnavailable,
  };
}
