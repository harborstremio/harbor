import { useEffect, useMemo, useRef, useState } from "react";
import { useMal } from "@/lib/mal/provider";
import { fetchListEntry, resolveMalMediaId } from "@/lib/mal/mutations";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { airedOnly } from "@/lib/aired";

export type MalWatched = { watchedKeys: Set<string>; completed: boolean };

const EMPTY: MalWatched = { watchedKeys: new Set(), completed: false };

export function useMalWatched(harborId: string, episodes: KitsuEpisode[]): MalWatched {
  const { isConnected } = useMal();
  const [result, setResult] = useState<MalWatched>(EMPTY);
  const epSig = useMemo(
    () =>
      episodes.map((e) => `${e.id}:${e.seasonNumber ?? 1}:${e.number}:${e.airdate ?? ""}`).join("|"),
    [episodes],
  );
  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;

  useEffect(() => {
    if (!isConnected || !harborId) {
      setResult(EMPTY);
      return;
    }
    let cancelled = false;
    void (async () => {
      const malId = await resolveMalMediaId(harborId).catch(() => null);
      if (cancelled || malId == null) return;
      const info = await fetchListEntry(malId).catch(() => null);
      if (cancelled || !info) return;
      if (!info.entry) {
        setResult(EMPTY);
        return;
      }
      const { status, numEpisodesWatched } = info.entry;
      const sorted = airedOnly(
        [...episodesRef.current].sort(
          (a, b) => (a.seasonNumber ?? 1) - (b.seasonNumber ?? 1) || a.number - b.number,
        ),
        (e) => e.airdate,
      );
      const mediaTotal = info.numEpisodes;
      const cap =
        mediaTotal != null && mediaTotal > 0 ? Math.min(sorted.length, mediaTotal) : sorted.length;
      const watchedCount =
        status === "completed" ? cap : Math.max(0, Math.min(numEpisodesWatched, cap));
      const watchedKeys = new Set<string>();
      for (let i = 0; i < watchedCount; i++) {
        const ep = sorted[i];
        watchedKeys.add(`${ep.seasonNumber ?? 1}:${ep.number}`);
      }
      const completed = status === "completed" || (cap <= 1 && numEpisodesWatched >= 1);
      setResult({ watchedKeys, completed });
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, epSig]);

  return result;
}
