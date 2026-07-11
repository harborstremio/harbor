import { loadSimklWatchedMap, simklWatchedForId } from "@/lib/simkl/list-status";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import { useEffect, useState } from "react";

export function useWatchedSets({
  traktConnected,
  simklConnected,
  imdbId,
  metaId,
}: {
  traktConnected: boolean;
  simklConnected: boolean;
  imdbId: string | null;
  metaId: string;
}): { traktWatched: Set<string>; simklWatched: Set<string> } {
  const [traktWatched, setTraktWatched] = useState<Set<string>>(() => new Set());
  const [simklWatched, setSimklWatched] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!traktConnected) {
      setTraktWatched(new Set());
      return;
    }
    let cancelled = false;
    fetchWatchedKeySet()
      .then((set) => {
        if (!cancelled) setTraktWatched(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [traktConnected]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklWatched(new Set());
      return;
    }
    let cancelled = false;
    loadSimklWatchedMap()
      .then((map) => {
        if (!cancelled) setSimklWatched(simklWatchedForId(map, imdbId, metaId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected, imdbId, metaId]);

  return { traktWatched, simklWatched };
}
