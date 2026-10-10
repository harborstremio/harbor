import { getRating, setRatingLocal, removeRatingLocal } from "./store";
import { upsertRating, deleteRatingRemote } from "@/lib/social/ratings-api";
import type { MyRating, RatingTarget } from "./types";

function statusOf(e: unknown): number | undefined {
  return (e as { status?: number })?.status;
}

export async function rate(
  target: RatingTarget,
  score: number,
  extra?: { review?: string; spoiler?: boolean },
): Promise<void> {
  const prev = getRating(target.itemKey);
  const review = extra?.review?.trim() || undefined;
  const spoiler = extra?.spoiler || undefined;
  const optimistic: MyRating = {
    itemKey: target.itemKey,
    mediaType: target.mediaType,
    score,
    review,
    spoiler,
    title: target.title,
    poster: target.poster,
    updatedAt: Date.now(),
  };
  setRatingLocal(optimistic);
  try {
    const saved = await upsertRating({ ...target, score, review, spoiler });
    setRatingLocal(saved);
  } catch (e) {
    const status = statusOf(e);
    if (status && status >= 400 && status < 500 && status !== 429) {
      if (prev) setRatingLocal(prev);
      else removeRatingLocal(target.itemKey);
    }
    throw e;
  }
}

export async function unrate(itemKey: string): Promise<void> {
  const prev = getRating(itemKey);
  removeRatingLocal(itemKey);
  try {
    await deleteRatingRemote(itemKey);
  } catch (e) {
    if (prev) setRatingLocal(prev);
    throw e;
  }
}
