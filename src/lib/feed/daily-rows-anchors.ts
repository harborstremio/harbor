import { MOVIE_GENRES } from "./tags";
import { relax, type CatalogEntry, type RowEndpoint } from "./daily-rows-types";

function recentWindow(floor: Record<string, string>): Record<string, string> {
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  return {
    "primary_release_date.gte": fmt(Date.now() - 90 * 86_400_000),
    "primary_release_date.lte": fmt(Date.now()),
    ...floor,
  };
}

function anchor(
  id: string,
  title: string,
  kicker: string,
  endpoint: RowEndpoint,
  floor: Record<string, string>,
): CatalogEntry {
  return {
    id,
    dimension: "anchor",
    eligible: () => true,
    expand: () => {
      const floorPrimary = id === "recently_released" ? recentWindow(floor) : floor;
      return [
        {
          key: `${id}:_`,
          title,
          kicker,
          mediaType: "movie",
          endpoint,
          floorPrimary,
          floorRelaxed: endpoint === "trending" ? floorPrimary : relax(floorPrimary),
        },
      ];
    },
  };
}

export const ANCHOR_TRENDING = "trending";
export const ANCHOR_TOP_RATED = "critically_loved";
export const ANCHOR_AWARDS = "award_winning";
export const ROTATING_ANCHORS = ["documentaries", "hidden_gems_anchor", "cult"];

export const ANCHORS: CatalogEntry[] = [
  anchor("trending", "Trending This Week", "What people are watching", "trending", {
    sort_by: "popularity.desc",
  }),
  anchor("award_winning", "Award Winning", "Best Picture winners", "awards", {}),
  anchor("critically_loved", "Top Rated", "Critically acclaimed, all time", "discover", {
    "vote_average.gte": "8.0",
    "vote_count.gte": "1000",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
  }),
  anchor(
    "hidden_gems_anchor",
    "Highly Rated, Quietly Loved",
    "High score, low fanfare",
    "discover",
    {
      "vote_average.gte": "7.2",
      "vote_count.gte": "300",
      "vote_count.lte": "3500",
      "with_runtime.gte": "70",
      sort_by: "vote_average.desc",
    },
  ),
  anchor("cult", "Cult Classics", "Beloved, slightly forgotten", "discover", {
    "primary_release_date.lte": "1999-12-31",
    "vote_average.gte": "7.4",
    "vote_count.gte": "300",
    "vote_count.lte": "5000",
    sort_by: "vote_average.desc",
  }),
  anchor("animated", "Animated, For Grown-Ups", "Beyond the kids' shelf", "discover", {
    with_genres: String(MOVIE_GENRES.Animation),
    "vote_average.gte": "7.4",
    "vote_count.gte": "500",
    sort_by: "vote_average.desc",
  }),
  anchor("documentaries", "Documentaries Worth Your Night", "Highly rated, real life", "discover", {
    with_genres: String(MOVIE_GENRES.Documentary),
    "vote_average.gte": "7.5",
    "vote_count.gte": "200",
    sort_by: "vote_average.desc",
  }),
  anchor("recently_released", "Recently Released", "Last 90 days", "discover", {
    "vote_count.gte": "50",
    "with_runtime.gte": "70",
    sort_by: "popularity.desc",
  }),
];
