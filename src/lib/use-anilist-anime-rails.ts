import { fetchMediaListCollection, readCachedCollection } from "@/lib/anilist/lists";
import { useAnilist } from "@/lib/anilist/provider";
import { fetchAnilistRecommendations } from "@/lib/anilist/recommendations";
import { anilistEntryToMeta } from "@/lib/anilist/to-meta";
import type { AnilistListGroup, MediaListStatus } from "@/lib/anilist/types";
import type { Meta } from "@/lib/cinemeta";
import { useEffect, useState } from "react";

export type AnilistRail = { key: string; title: string; metas: Meta[] };

export const RAIL_ORDER: Array<{ key: string; title: string; statuses: MediaListStatus[] }> = [
  { key: "watching", title: "Watching", statuses: ["CURRENT", "REPEATING"] },
  { key: "planning", title: "Plan to Watch", statuses: ["PLANNING"] },
  { key: "completed", title: "Completed", statuses: ["COMPLETED"] },
  { key: "paused", title: "On Hold", statuses: ["PAUSED"] },
  { key: "dropped", title: "Dropped", statuses: ["DROPPED"] },
];

const SEED_STATUSES: MediaListStatus[] = ["COMPLETED", "CURRENT", "REPEATING"];
const MIN_PER_RAIL = 1;
const MIN_RECS = 4;

function buildStatusRails(groups: AnilistListGroup[]): AnilistRail[] {
  const entriesByStatus = new Map(groups.map((g) => [g.status, g.entries]));
  const out: AnilistRail[] = [];
  for (const rail of RAIL_ORDER) {
    const entries = rail.statuses.flatMap((s) => entriesByStatus.get(s) ?? []);
    const metas = entries.map(anilistEntryToMeta).filter((m): m is Meta => m != null);
    if (metas.length >= MIN_PER_RAIL) out.push({ key: rail.key, title: rail.title, metas });
  }
  return out;
}

export function useAnilistAnimeRails(): AnilistRail[] {
  const { isConnected, session } = useAnilist();
  const [rails, setRails] = useState<AnilistRail[]>([]);

  useEffect(() => {
    if (!isConnected || !session) {
      setRails([]);
      return;
    }
    let cancelled = false;
    const userId = session.userId;
    const seed = readCachedCollection(userId);
    if (seed) setRails(buildStatusRails(seed));
    (async () => {
      const groups = await fetchMediaListCollection(userId);
      if (cancelled) return;
      const out = buildStatusRails(groups);
      const entriesByStatus = new Map(groups.map((g) => [g.status, g.entries]));
      const excludeIds = new Set<number>();
      for (const g of groups) for (const e of g.entries) excludeIds.add(e.media.id);

      const seedIds = SEED_STATUSES.flatMap((s) => (entriesByStatus.get(s) ?? []).map((e) => e.media.id));
      const recs = seedIds.length > 0 ? await fetchAnilistRecommendations(seedIds, excludeIds) : [];
      if (cancelled) return;
      setRails(
        recs.length >= MIN_RECS
          ? [{ key: "recommended", title: "Recommended for you", metas: recs.slice(0, 40) }, ...out]
          : out,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, session?.userId]);

  return rails;
}
