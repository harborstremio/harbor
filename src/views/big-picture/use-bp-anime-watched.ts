import { useCallback, useEffect, useMemo, useState } from "react";
import { loadAnilistWatchedMap } from "@/lib/anilist/watched-map";
import {
  loadSimklStatusMap,
  loadSimklWatchedMap,
  simklWatchedForId,
  statusForId,
  type WatchlistStatus,
} from "@/lib/simkl/list-status";
import { useSimkl } from "@/lib/simkl/provider";

const ANIME_ID = /^(kitsu|mal|anilist):/;

const NO_IDS: string[] = [];

export type BpAnimeWatched = {
  simklWatched: Map<string, Set<string>>;
  simklStatus: Map<string, WatchlistStatus>;
  anilistWatched: Map<string, Set<string>>;
  isAnimeWatched: (id: string) => boolean;
  simklConnected: boolean;
};

export function useBpAnimeWatched(ids: string[]): BpAnimeWatched {
  const { isConnected: simklConnected } = useSimkl();
  const [simklWatched, setSimklWatched] = useState<Map<string, Set<string>>>(() => new Map());
  const [simklStatus, setSimklStatus] = useState<Map<string, WatchlistStatus>>(() => new Map());
  const [anilistWatched, setAnilistWatched] = useState<Map<string, Set<string>>>(() => new Map());

  useEffect(() => {
    if (!simklConnected) {
      setSimklWatched(new Map());
      setSimklStatus(new Map());
      return;
    }
    let cancelled = false;
    loadSimklWatchedMap()
      .then((m) => {
        if (!cancelled) setSimklWatched(m);
      })
      .catch(() => {});
    loadSimklStatusMap()
      .then((m) => {
        if (!cancelled) setSimklStatus(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);

  // The caller grows this list as hero, picks and trending land, and most of
  // those passes add no anime id at all. Keying on the joined anime subset keeps
  // `wanted` identical across them, so the map is not rewalked for nothing.
  const wantedKey = useMemo(() => {
    const out = new Set<string>();
    for (const id of ids) if (ANIME_ID.test(id)) out.add(id);
    return [...out].sort().join("|");
  }, [ids.join("|")]);

  const wanted = useMemo(
    () => (wantedKey === "" ? NO_IDS : wantedKey.split("|")),
    [wantedKey],
  );

  useEffect(() => {
    if (wanted.length === 0) return;
    let cancelled = false;
    loadAnilistWatchedMap(wanted)
      .then((m) => {
        if (!cancelled) setAnilistWatched(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  const isAnimeWatched = useCallback(
    (id: string): boolean =>
      statusForId(simklStatus, id) === "completed" ||
      simklWatchedForId(simklWatched, id).size > 0 ||
      (anilistWatched.get(id)?.size ?? 0) > 0,
    [simklStatus, simklWatched, anilistWatched],
  );

  return { simklWatched, simklStatus, anilistWatched, isAnimeWatched, simklConnected };
}
