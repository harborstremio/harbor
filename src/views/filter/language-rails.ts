import type { AnyRail } from "./rails-config";

type GenreRail = [label: string, id: string];

const MOVIE_GENRE_RAILS: GenreRail[] = [
  ["Action", "28"],
  ["Comedy", "35"],
  ["Drama", "18"],
  ["Thriller", "53"],
  ["Romance", "10749"],
  ["Horror", "27"],
  ["Crime", "80"],
  ["Sci-Fi", "878"],
  ["Adventure", "12"],
  ["Mystery", "9648"],
  ["Fantasy", "14"],
  ["Animation", "16"],
  ["Family", "10751"],
  ["Documentary", "99"],
  ["History", "36"],
  ["Music", "10402"],
  ["War", "10752"],
];

const TV_GENRE_RAILS: GenreRail[] = [
  ["Drama", "18"],
  ["Comedy", "35"],
  ["Crime", "80"],
  ["Action & Adventure", "10759"],
  ["Mystery", "9648"],
  ["Sci-Fi & Fantasy", "10765"],
  ["Animation", "16"],
  ["Documentary", "99"],
  ["Family", "10751"],
  ["Reality", "10764"],
];

const DECADES: Array<[label: string, gte: string, lte: string]> = [
  ["2020s", "2020-01-01", "2029-12-31"],
  ["2010s", "2010-01-01", "2019-12-31"],
  ["2000s", "2000-01-01", "2009-12-31"],
  ["The 90s", "1990-01-01", "1999-12-31"],
  ["The 80s", "1980-01-01", "1989-12-31"],
];

function recentDate(): string {
  return new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function languageRails(iso: string, name: string): AnyRail[] {
  const rails: AnyRail[] = [];
  const add = (
    id: string,
    title: string,
    kicker: string,
    mediaType: "movie" | "tv",
    params: Record<string, string>,
    noDedup?: boolean,
  ) => {
    rails.push({
      kind: "standard",
      id,
      title,
      kicker,
      mediaType,
      noDedup,
      params: { with_original_language: iso, ...params },
    });
  };

  add("pop-movies", `Popular ${name} Movies`, "Most watched right now", "movie", {
    sort_by: "popularity.desc",
    "vote_count.gte": "40",
  });
  add("pop-series", `Popular ${name} Series`, "Trending shows", "tv", {
    sort_by: "popularity.desc",
    "vote_count.gte": "25",
  });
  add("top-movies", `Top Rated ${name} Movies`, "Critic and audience favorites", "movie", {
    sort_by: "vote_average.desc",
    "vote_count.gte": "120",
  });
  add("top-series", `Top Rated ${name} Series`, "Acclaimed shows", "tv", {
    sort_by: "vote_average.desc",
    "vote_count.gte": "80",
  });
  add("new-movies", `New ${name} Movies`, "Fresh releases", "movie", {
    "primary_release_date.gte": recentDate(),
    sort_by: "popularity.desc",
    "vote_count.gte": "10",
  });
  add("new-series", `New ${name} Series`, "Just premiered", "tv", {
    "first_air_date.gte": recentDate(),
    sort_by: "popularity.desc",
    "vote_count.gte": "8",
  });

  for (const [label, gid] of MOVIE_GENRE_RAILS) {
    add(
      `mg-${gid}`,
      `${name} ${label}`,
      "Movies",
      "movie",
      {
        with_genres: gid,
        sort_by: "popularity.desc",
        "vote_count.gte": "20",
      },
      true,
    );
  }
  for (const [label, gid] of TV_GENRE_RAILS) {
    add(
      `tg-${gid}`,
      `${name} ${label}`,
      "Series",
      "tv",
      {
        with_genres: gid,
        sort_by: "popularity.desc",
        "vote_count.gte": "12",
      },
      true,
    );
  }
  for (const [label, gte, lte] of DECADES) {
    add(
      `dec-${gte}`,
      `${name} Movies: ${label}`,
      "By the decade",
      "movie",
      {
        "primary_release_date.gte": gte,
        "primary_release_date.lte": lte,
        sort_by: "vote_average.desc",
        "vote_count.gte": "20",
      },
      true,
    );
  }
  add(
    "gems",
    `Hidden ${name} Gems`,
    "Loved, lesser known",
    "movie",
    {
      sort_by: "vote_average.desc",
      "vote_count.gte": "30",
      "vote_count.lte": "1500",
      "vote_average.gte": "6.5",
    },
    true,
  );

  return rails;
}
