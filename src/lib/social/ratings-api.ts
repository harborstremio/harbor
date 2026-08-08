import { socialGet, socialPost } from "./client";
import type { MyRating, PublicRating, RatingCounts, RatingTarget } from "@/lib/ratings/types";

export type RatingInput = RatingTarget & { score: number; review?: string; spoiler?: boolean };

export type UserRatingsPage = {
  items: PublicRating[];
  nextCursor?: string;
  counts: RatingCounts;
  avg: number;
};

function toMyRating(r: PublicRating): MyRating {
  const parsed = Date.parse(r.at);
  return {
    itemKey: r.itemKey,
    mediaType: r.mediaType,
    score: r.score,
    review: r.review || undefined,
    spoiler: r.spoiler || undefined,
    title: r.title || "",
    poster: r.posterUrl || undefined,
    updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
  };
}

export async function upsertRating(input: RatingInput): Promise<MyRating> {
  const r = await socialPost<PublicRating>("/social/ratings", {
    itemKey: input.itemKey,
    mediaType: input.mediaType,
    score: input.score,
    review: input.review ?? "",
    spoiler: input.spoiler ?? false,
    title: input.title,
    poster: input.poster,
  });
  return toMyRating(r);
}

export async function deleteRatingRemote(itemKey: string): Promise<void> {
  await socialPost("/social/ratings/delete", { itemKey });
}

export async function fetchMyRatings(signal?: AbortSignal): Promise<MyRating[]> {
  const d = await socialGet<{ ratings: PublicRating[] }>("/social/ratings/me", signal);
  return (d.ratings ?? []).map(toMyRating);
}

export async function fetchUserRatings(
  handle: string,
  opts: { type?: string; cursor?: string; query?: string } = {},
  signal?: AbortSignal,
): Promise<UserRatingsPage> {
  const q = new URLSearchParams();
  if (opts.type && opts.type !== "all") q.set("type", opts.type);
  if (opts.cursor) q.set("cursor", opts.cursor);
  if (opts.query) q.set("q", opts.query);
  const qs = q.toString();
  return socialGet<UserRatingsPage>(
    `/social/u/${encodeURIComponent(handle)}/ratings${qs ? `?${qs}` : ""}`,
    signal,
  );
}
