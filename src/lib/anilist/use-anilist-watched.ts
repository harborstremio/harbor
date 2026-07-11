import { fetchListEntry } from "@/lib/anilist/mutations";
import { useAnilist } from "@/lib/anilist/provider";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useEffect, useState } from "react";

export type AnilistWatched = { watchedKeys: Set<string>; completed: boolean };

const EMPTY: AnilistWatched = { watchedKeys: new Set(), completed: false };

export function useAnilistWatched(harborId: string, episodes: KitsuEpisode[]): AnilistWatched {
  const { isConnected } = useAnilist();
  const [result, setResult] = useState<AnilistWatched>(EMPTY);

  useEffect(() => {
    setResult(EMPTY);
    if (!isConnected || !harborId) return;
    let cancelled = false;
    void (async () => {
      const mediaId = await resolveAnilistMediaId(harborId).catch(() => null);
      if (cancelled || mediaId == null) return;
      const info = await fetchListEntry(mediaId).catch(() => null);
      if (cancelled || !info?.entry) return;
      const { status, progress } = info.entry;
      const sorted = [...episodes].sort((a, b) => (a.seasonNumber || 1) - (b.seasonNumber || 1) || a.number - b.number);
      const total = sorted.length;
      const watchedCount = status === "COMPLETED" ? total : Math.max(0, Math.min(progress, total));
      const watchedKeys = new Set<string>();
      for (let i = 0; i < watchedCount; i++) {
        const ep = sorted[i];
        watchedKeys.add(`${ep.seasonNumber || 1}:${ep.number}`);
      }
      const completed = status === "COMPLETED" || (total <= 1 && progress >= 1);
      setResult({ watchedKeys, completed });
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, episodes]);

  return result;
}
