export type RatingMediaType = "movie" | "series" | "anime" | "manga";

export type MyRating = {
  itemKey: string;
  mediaType: RatingMediaType;
  score: number;
  review?: string;
  spoiler?: boolean;
  title: string;
  poster?: string;
  updatedAt: number;
};

export type RatingTarget = {
  itemKey: string;
  mediaType: RatingMediaType;
  title: string;
  poster?: string;
};

export type PublicRating = {
  itemKey: string;
  mediaType: RatingMediaType;
  score: number;
  review?: string;
  spoiler?: boolean;
  title: string;
  posterUrl?: string;
  at: string;
};

export type RatingCounts = { movie: number; series: number; anime: number; manga: number; total: number };

export type RatingsSummary = {
  count: number;
  avg: number;
  counts: RatingCounts;
  recent: Array<{
    itemKey: string;
    mediaType: RatingMediaType;
    score: number;
    title: string;
    posterUrl?: string;
    spoiler?: boolean;
    hasReview?: boolean;
  }>;
};

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/i;

export function inferRatingMediaType(
  id: string,
  hint?: { isAnime?: boolean; isManga?: boolean; type?: string },
): RatingMediaType {
  if (hint?.isManga) return "manga";
  if (hint?.isAnime) return "anime";
  const t = String(hint?.type ?? "").toLowerCase();
  if (t === "manga") return "manga";
  if (t === "anime") return "anime";
  if (t === "movie") return "movie";
  if (t === "series" || t === "tv") return "series";
  if (ANIME_ID.test(id)) return "anime";
  return id.includes(":tv:") || id.includes(":series:") ? "series" : "movie";
}

export function ratingTarget(
  meta: { id: string; name?: string; title?: string; poster?: string },
  mediaType: RatingMediaType,
): RatingTarget {
  return {
    itemKey: meta.id,
    mediaType,
    title: (meta.name ?? meta.title ?? "").slice(0, 300),
    poster: meta.poster,
  };
}
