import type { Meta } from "@/lib/cinemeta";
import { getEpisodeProgress } from "@/lib/episode-progress";
import { manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import { resolveMeta } from "@/lib/meta-resource";
import { loadSimklWatchedMap, simklWatchedForId } from "@/lib/simkl/list-status";
import { useSimkl } from "@/lib/simkl/provider";
import { libraryGetOne } from "@/lib/stremio";
import { decodeWatchedEpisodes } from "@/lib/stremio-watched";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import type { PlayEpisode } from "@/lib/view";
import { useEffect, useState, useSyncExternalStore } from "react";

export function usePlayerWatched(params: {
  meta: Meta;
  authKey: string | null;
  imdbId: string | null;
  enabled: boolean;
}): { watchedFor: (ep: PlayEpisode) => boolean } {
  const { meta, authKey, imdbId, enabled } = params;
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const [traktWatched, setTraktWatched] = useState<Set<string>>(() => new Set());
  const [simklWatched, setSimklWatched] = useState<Set<string>>(() => new Set());
  const [stremioWatched, setStremioWatched] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!enabled || !traktConnected) return;
    let cancelled = false;
    fetchWatchedKeySet()
      .then((s) => {
        if (!cancelled) setTraktWatched(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, traktConnected, meta.id]);

  useEffect(() => {
    if (!enabled || !simklConnected) return;
    let cancelled = false;
    loadSimklWatchedMap()
      .then((m) => {
        if (!cancelled) setSimklWatched(simklWatchedForId(m, imdbId, meta.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, simklConnected, meta.id, imdbId]);

  useEffect(() => {
    if (!enabled || !authKey) return;
    let cancelled = false;
    void (async () => {
      const item = await libraryGetOne(authKey, meta.id).catch(() => null);
      const watched = item?.state?.watched;
      if (!watched || cancelled) return;
      const full = await resolveMeta(authKey, "series", meta.id).catch(() => null);
      const keys = await decodeWatchedEpisodes(watched, full?.videos);
      if (!cancelled) setStremioWatched(keys);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, authKey, meta.id]);

  const imdbKey = meta.id.startsWith("tt") ? meta.id : imdbId;
  const watchedFor = (ep: PlayEpisode): boolean =>
    getEpisodeProgress(
      meta.id,
      ep.season,
      ep.episode,
      null,
      imdbKey,
      traktWatched,
      stremioWatched,
      undefined,
      simklWatched,
    ).watched;

  return { watchedFor };
}
