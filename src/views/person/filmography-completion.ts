import type { PersonCredit } from "@/lib/providers/tmdb";
import { tmdbImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { watchedOutright } from "@/lib/voyage/progress";

export type FilmographyCompletion = { seen: number; total: number };

const MIN_FILMS = 5;

export function filmographyCompletion(films: PersonCredit[]): FilmographyCompletion | null {
  if (films.length < MIN_FILMS) return null;
  let seen = 0;
  for (const film of films) {
    const metaId = `tmdb:movie:${film.id}`;
    const imdbId = tmdbImdbCached(metaId);
    if (watchedOutright(metaId) || (imdbId && watchedOutright(imdbId))) seen += 1;
  }
  return seen > 0 ? { seen, total: films.length } : null;
}
