import type { Meta } from "@/lib/cinemeta";
import { score as affinityScore } from "@/lib/discover/affinity";
import { profileFromMeta } from "@/lib/discover/profile";
import type { Affinity } from "@/lib/discover/types";
import { getVoteWithTs } from "@/lib/feed/preferences";
import { mixSeed, mulberry32 } from "@/lib/feed/tags";
import {
  HALF_LIFE_SUPP_MS,
  HALF_LIFE_TASTE_MS,
  SOURCE_BASE,
  SUPPRESS_MAX,
  WEIGHTS,
  type FeaturedItem,
} from "./types";

const AFF_CAP = 4;
const QUAL_FLOOR = 6.8;
const SOURCE_CONF: Record<string, number> = {
  awards: 12,
  acclaimed: 12,
  tmdb: 10,
  imdb: 12,
  streaming: 6,
  trending: 6,
  similar: 8,
  seed: 5,
};

const decay = (age: number, halfLife: number) => Math.exp((-Math.LN2 * age) / halfLife);

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function passesFloor(m: Meta, source: string): boolean {
  if (source === "awards" || source === "acclaimed" || source === "streaming") return true;
  return m.tmdbScore == null || m.tmdbScore >= QUAL_FLOOR;
}

export function scoreFeatured(
  item: FeaturedItem,
  affinity: Affinity,
  now: number,
  dayIndex: number,
): number {
  const m = item.meta;
  const AFF = Math.min(1, affinityScore(profileFromMeta(m), affinity) / AFF_CAP);
  const R = (m.tmdbScore ?? 0) / 10;
  const n = SOURCE_CONF[item.source] ?? 6;
  const QUAL = R > 0 ? (R * n + 0.62 * 8) / (n + 8) : 0.5;
  const PROM = SOURCE_BASE[item.source] / (1 + item.sourceRank);
  const SIM =
    item.source === "similar" && item.seedTs != null
      ? decay(now - item.seedTs, HALF_LIFE_TASTE_MS)
      : 0;
  const vote = getVoteWithTs(m.id);
  const SUPP = vote?.vote === "up" ? SUPPRESS_MAX * decay(now - vote.ts, HALF_LIFE_SUPP_MS) : 0;
  const jitter = mulberry32(mixSeed(hashId(m.id), dayIndex))() * 0.2;
  return (
    WEIGHTS.AFF * AFF +
    WEIGHTS.QUAL * QUAL +
    WEIGHTS.PROM * PROM +
    WEIGHTS.SIM * SIM -
    SUPP +
    jitter
  );
}
