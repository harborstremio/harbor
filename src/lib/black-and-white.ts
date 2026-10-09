import raw from "@/data/black-and-white.json";
import type { Meta } from "@/lib/cinemeta";

type BlackAndWhiteFilm = {
  imdb: string;
  title: string;
  year?: number;
  tmdb?: number;
};

type BlackAndWhiteIndex = {
  builtAt: string;
  minSitelinks: number;
  count: number;
  films: BlackAndWhiteFilm[];
};

const index = raw as BlackAndWhiteIndex;
const PAGE_SIZE = 40;

function toMeta(film: BlackAndWhiteFilm): Meta {
  return {
    id: film.imdb,
    type: "movie",
    name: film.title,
    poster: `https://images.metahub.space/poster/small/${film.imdb}/img`,
    background: `https://images.metahub.space/background/medium/${film.imdb}/img`,
    releaseInfo: film.year ? String(film.year) : undefined,
  };
}

export function blackAndWhitePage(page: number): Promise<Meta[]> {
  const start = (page - 1) * PAGE_SIZE;
  if (start < 0 || start >= index.films.length) return Promise.resolve([]);
  return Promise.resolve(index.films.slice(start, start + PAGE_SIZE).map(toMeta));
}
