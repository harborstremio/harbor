import { useEffect, useMemo, useRef, useState } from "react";
import { useMal } from "@/lib/mal/provider";
import { fetchListEntry, resolveMalMediaId } from "@/lib/mal/mutations";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { airedOnly } from "@/lib/aired";
import { trackerWatchedKeys } from "@/lib/tracker-watched-keys";

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
      const eps = episodesRef.current;
      const cap = airedOnly(eps, (e) => e.airdate).length;
      const watchedKeys = await trackerWatchedKeys(
        harborId,
        eps,
        numEpisodesWatched,
        status === "completed",
        info.numEpisodes,
      );
      if (cancelled) return;
      const completed = status === "completed" || (cap <= 1 && numEpisodesWatched >= 1);
      setResult({ watchedKeys, completed });
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, epSig]);

  return result;
}
