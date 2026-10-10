import { useEffect, useState } from "react";
import { loadSimklWatchedMap, simklWatchedForId } from "@/lib/simkl/list-status";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import { fetchPmdbWatchedKeySet } from "@/lib/publicmetadb/history";
import { stremioIdToPmdbTarget } from "@/lib/publicmetadb/ids";

export function useWatchedSets({
  traktConnected,
  simklConnected,
  pmdbConnected,
  imdbId,
  metaId,
}: {
  traktConnected: boolean;
  simklConnected: boolean;
  pmdbConnected?: boolean;
  imdbId: string | null;
  metaId: string;
}): { traktWatched: Set<string>; simklWatched: Set<string>; pmdbWatched: Set<string> } {
  const [traktWatched, setTraktWatched] = useState<Set<string>>(() => new Set());
  const [simklWatched, setSimklWatched] = useState<Set<string>>(() => new Set());
  const [pmdbWatched, setPmdbWatched] = useState<Set<string>>(() => new Set());

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

  useEffect(() => {
    if (!pmdbConnected) {
      setPmdbWatched(new Set());
      return;
    }
    let cancelled = false;
    const target = stremioIdToPmdbTarget(metaId, undefined, "series");
    fetchPmdbWatchedKeySet(target ?? undefined)
      .then((set) => {
        if (!cancelled) setPmdbWatched(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pmdbConnected, metaId]);

  return { traktWatched, simklWatched, pmdbWatched };
}
