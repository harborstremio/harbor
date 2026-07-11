import { fetchListEntry, resolveMalMediaId } from "@/lib/mal/mutations";
import { useMal } from "@/lib/mal/provider";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useEffect, useState } from "react";

export type MalWatched = { watchedKeys: Set<string>; completed: boolean };

const EMPTY: MalWatched = { watchedKeys: new Set(), completed: false };

export function useMalWatched(harborId: string, episodes: KitsuEpisode[]): MalWatched {
  const { isConnected } = useMal();
  const [result, setResult] = useState<MalWatched>(EMPTY);

  useEffect(() => {
    setResult(EMPTY);
    if (!isConnected || !harborId) return;
    let cancelled = false;
    void (async () => {
      const malId = await resolveMalMediaId(harborId).catch(() => null);
      if (cancelled || malId == null) return;
      const info = await fetchListEntry(malId).catch(() => null);
      if (cancelled || !info?.entry) return;
      const { status, numEpisodesWatched } = info.entry;
      const sorted = [...episodes].sort((a, b) => (a.seasonNumber || 1) - (b.seasonNumber || 1) || a.number - b.number);
      const total = sorted.length;
      const watchedCount = status === "completed" ? total : Math.max(0, Math.min(numEpisodesWatched, total));
      const watchedKeys = new Set<string>();
      for (let i = 0; i < watchedCount; i++) {
        const ep = sorted[i];
        watchedKeys.add(`${ep.seasonNumber || 1}:${ep.number}`);
      }
      const completed = status === "completed" || (total <= 1 && numEpisodesWatched >= 1);
      setResult({ watchedKeys, completed });
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, episodes]);

  return result;
}
