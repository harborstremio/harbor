import { anilistSource } from "./sources/anilist";
import { imdbSource } from "./sources/imdb";
import { letterboxdSource } from "./sources/letterboxd";
import { malSource } from "./sources/mal";
import { mdblistSource } from "./sources/mdblist";
import { simklSource } from "./sources/simkl";
import { tmdbSource } from "./sources/tmdb";
import { traktSource } from "./sources/trakt";
import type { ImportSourceId, RatingsSource } from "./types";

export const IMPORT_SOURCES: RatingsSource[] = [
  traktSource,
  simklSource,
  anilistSource,
  malSource,
  letterboxdSource,
  imdbSource,
  tmdbSource,
  mdblistSource,
];

export function importSource(id: ImportSourceId): RatingsSource | undefined {
  return IMPORT_SOURCES.find((s) => s.id === id);
}
