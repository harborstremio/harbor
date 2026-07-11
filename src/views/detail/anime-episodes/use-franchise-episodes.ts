import type { FranchiseEntry } from "@/lib/providers/anime-detail";
import { fetchEntryEpisodes } from "@/lib/providers/anime-franchise-episodes";
import { parseKitsuId, type KitsuEpisode } from "@/lib/providers/kitsu";
import { useEffect, useMemo, useState } from "react";

export function useFranchiseEpisodes(
  franchise: FranchiseEntry[],
  currentId: string,
  currentEpisodes: KitsuEpisode[],
  enabled: boolean,
): KitsuEpisode[] {
  const otherIds = useMemo(() => {
    if (!enabled || franchise.length <= 1) return [] as number[];
    const ids: number[] = [];
    for (const f of franchise) {
      if (f.meta.id === currentId) continue;
      const id = parseKitsuId(f.meta.id);
      if (id != null && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [enabled, franchise, currentId]);

  const sig = otherIds.join(",");
  const [extra, setExtra] = useState<KitsuEpisode[]>([]);
  useEffect(() => {
    if (otherIds.length === 0) {
      setExtra([]);
      return;
    }
    let cancelled = false;
    void Promise.all(otherIds.map((id) => fetchEntryEpisodes(id).catch(() => [] as KitsuEpisode[]))).then((lists) => {
      if (!cancelled) setExtra(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [sig]);

  return useMemo(() => {
    if (!enabled || otherIds.length === 0 || extra.length === 0) return currentEpisodes;
    const seen = new Set<number>();
    const combined: KitsuEpisode[] = [];
    for (const ep of currentEpisodes) {
      if (seen.has(ep.id)) continue;
      seen.add(ep.id);
      combined.push(ep);
    }
    for (const ep of extra) {
      if (seen.has(ep.id)) continue;
      seen.add(ep.id);
      combined.push(ep);
    }
    combined.sort(
      (a, b) =>
        (a.imdbSeason ?? 0) - (b.imdbSeason ?? 0) ||
        (a.imdbEpisode ?? a.number) - (b.imdbEpisode ?? b.number) ||
        (a.absoluteNumber ?? a.number) - (b.absoluteNumber ?? b.number),
    );
    return combined;
  }, [enabled, otherIds.length, currentEpisodes, extra]);
}
