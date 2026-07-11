import type { Meta } from "@/lib/cinemeta";

import { anilistRequest } from "./client";
import { anilistMediaToMeta } from "./to-meta";
import type { AnilistMedia } from "./types";

const RECS_QUERY = `query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      recommendations(sort: RATING_DESC, perPage: 6) {
        nodes {
          rating
          mediaRecommendation {
            id
            idMal
            title { romaji english native userPreferred }
            coverImage { extraLarge large medium }
            bannerImage
            format
            episodes
            averageScore
            seasonYear
          }
        }
      }
    }
  }
}`;

type RecNode = { rating: number | null; mediaRecommendation: AnilistMedia | null };
type RecsResponse = {
  Page: { media: Array<{ id: number; recommendations: { nodes: RecNode[] } | null }> } | null;
};

export async function fetchAnilistRecommendations(seedIds: number[], excludeIds: Set<number>): Promise<Meta[]> {
  if (seedIds.length === 0) return [];
  const ids = seedIds.slice(0, 40);
  const data = await anilistRequest<RecsResponse>(RECS_QUERY, { ids }).catch(() => null);
  const media = data?.Page?.media ?? [];
  const scored = new Map<number, { weight: number; media: AnilistMedia }>();
  for (const src of media) {
    for (const node of src.recommendations?.nodes ?? []) {
      const rec = node.mediaRecommendation;
      if (!rec || excludeIds.has(rec.id)) continue;
      const weight = Math.max(0, node.rating ?? 0) + 1;
      const prev = scored.get(rec.id);
      if (prev) prev.weight += weight;
      else scored.set(rec.id, { weight, media: rec });
    }
  }
  return Array.from(scored.values())
    .sort((a, b) => b.weight - a.weight)
    .map((x) => anilistMediaToMeta(x.media))
    .filter((m): m is Meta => m != null);
}
