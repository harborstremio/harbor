import type { PersonCredit } from "@/lib/providers/tmdb";

export const MIN_VOTES_MOVIE = 200;
export const MIN_VOTES_TV = 100;

export const TOP_PERFORMANCE_COUNT = 12;
export const TOP_PERFORMANCE_MIN = 3;

export type FilmographySort = "popularity" | "rating" | "newest";

function voteFloor(credit: PersonCredit): number {
  return credit.mediaType === "tv" ? MIN_VOTES_TV : MIN_VOTES_MOVIE;
}

function meetsVoteFloor(credit: PersonCredit): boolean {
  return credit.voteAverage > 0 && credit.voteCount >= voteFloor(credit);
}

export function ratingPrior(credits: PersonCredit[]): number {
  const rated = credits.filter((c) => c.voteAverage > 0 && c.voteCount > 0);
  if (rated.length === 0) return 0;
  const votes = rated.reduce((sum, c) => sum + c.voteCount, 0);
  return rated.reduce((sum, c) => sum + c.voteAverage * c.voteCount, 0) / votes;
}

export function weightedRating(credit: PersonCredit, prior: number): number {
  const m = voteFloor(credit);
  const v = Math.max(0, credit.voteCount);
  if (v + m === 0) return prior;
  return (v / (v + m)) * credit.voteAverage + (m / (v + m)) * prior;
}

function creditYear(credit: PersonCredit): number {
  const raw = credit.releaseDate ?? credit.releaseInfo ?? "";
  const year = Number(raw.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : 0;
}

function byTitle(a: PersonCredit, b: PersonCredit): number {
  return a.title.localeCompare(b.title);
}

export function rankByRating(credits: PersonCredit[], limit: number): PersonCredit[] {
  const eligible = credits.filter(meetsVoteFloor);
  if (eligible.length === 0) return [];
  const prior = ratingPrior(eligible);
  return eligible
    .map((credit) => ({ credit, score: weightedRating(credit, prior) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.credit.voteCount - a.credit.voteCount ||
        byTitle(a.credit, b.credit),
    )
    .slice(0, limit)
    .map((entry) => entry.credit);
}

function ratingRank(credit: PersonCredit, prior: number): [number, number] {
  return meetsVoteFloor(credit) ? [1, weightedRating(credit, prior)] : [0, credit.voteAverage];
}

export function sortFilmography(
  credits: PersonCredit[],
  sort: FilmographySort,
): PersonCredit[] {
  const out = credits.slice();
  if (sort === "newest") {
    return out.sort((a, b) => creditYear(b) - creditYear(a) || b.popularity - a.popularity);
  }
  if (sort === "rating") {
    const prior = ratingPrior(out.filter(meetsVoteFloor));
    return out.sort((a, b) => {
      const [aTier, aScore] = ratingRank(a, prior);
      const [bTier, bScore] = ratingRank(b, prior);
      return bTier - aTier || bScore - aScore || b.popularity - a.popularity;
    });
  }
  return out.sort((a, b) => b.popularity - a.popularity);
}

export function applyMinRating(credits: PersonCredit[], min: number): PersonCredit[] {
  if (min <= 0) return credits;
  return credits.filter((c) => meetsVoteFloor(c) && c.voteAverage >= min);
}
