import { useEffect, useState } from "react";
import { useAnilist } from "@/lib/anilist/provider";
import { fetchMangaListCollection, readCachedMangaCollection } from "@/lib/anilist/manga-lists";
import type { AnilistListGroup, AnilistMediaEntry, MediaListStatus } from "@/lib/anilist/types";
import type { MangaSummary } from "@/lib/manga/types";

export type MangaListRail = { key: string; title: string; items: MangaSummary[] };

const RAIL_ORDER: Array<{ key: string; title: string; statuses: MediaListStatus[] }> = [
  { key: "reading", title: "Reading", statuses: ["CURRENT", "REPEATING"] },
  { key: "planning", title: "Plan to Read", statuses: ["PLANNING"] },
  { key: "completed", title: "Completed", statuses: ["COMPLETED"] },
  { key: "paused", title: "On Hold", statuses: ["PAUSED"] },
  { key: "dropped", title: "Dropped", statuses: ["DROPPED"] },
];

function entryToSummary(entry: AnilistMediaEntry): MangaSummary | null {
  const m = entry.media;
  const title = m.title.english || m.title.userPreferred || m.title.romaji;
  if (!title) return null;
  return {
    id: `anilist:${m.id}`,
    title,
    cover: m.coverImage.extraLarge ?? m.coverImage.large ?? undefined,
    year: m.seasonYear ?? undefined,
    lastChapter: m.chapters != null ? String(m.chapters) : undefined,
  };
}

function buildRails(groups: AnilistListGroup[]): MangaListRail[] {
  const byStatus = new Map(groups.map((g) => [g.status, g.entries]));
  const out: MangaListRail[] = [];
  for (const rail of RAIL_ORDER) {
    const entries = rail.statuses.flatMap((s) => byStatus.get(s) ?? []);
    const items = entries.map(entryToSummary).filter((x): x is MangaSummary => x != null);
    if (items.length > 0) out.push({ key: rail.key, title: rail.title, items });
  }
  return out;
}

export function useAnilistMangaRails(): { rails: MangaListRail[]; loading: boolean } {
  const { isConnected, session } = useAnilist();
  const [rails, setRails] = useState<MangaListRail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !session) {
      setRails([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const userId = session.userId;
    const seed = readCachedMangaCollection(userId);
    if (seed) setRails(buildRails(seed));
    setLoading(!seed);
    (async () => {
      const groups = await fetchMangaListCollection(userId);
      if (!cancelled) {
        setRails(buildRails(groups));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, session?.userId]);

  return { rails, loading };
}
