import { useEffect, useMemo, useRef, useState } from "react";
import { useAnilist } from "@/lib/anilist/provider";
import { fetchListEntry } from "@/lib/anilist/mutations";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { airedOnly } from "@/lib/aired";
import { trackerWatchedKeys } from "@/lib/tracker-watched-keys";

export type AnilistWatched = { watchedKeys: Set<string>; completed: boolean };

const EMPTY: AnilistWatched = { watchedKeys: new Set(), completed: false };

export function useAnilistWatched(harborId: string, episodes: KitsuEpisode[]): AnilistWatched {
  const { isConnected } = useAnilist();
  const [result, setResult] = useState<AnilistWatched>(EMPTY);
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
      const mediaId = await resolveAnilistMediaId(harborId).catch(() => null);
      if (cancelled || mediaId == null) return;
      const info = await fetchListEntry(mediaId).catch(() => null);
      if (cancelled || !info) return;
      if (!info.entry) {
        setResult(EMPTY);
        return;
      }
      const { status, progress } = info.entry;
      const eps = episodesRef.current;
      const cap = airedOnly(eps, (e) => e.airdate).length;
      const watchedKeys = await trackerWatchedKeys(
        harborId,
        eps,
        progress,
        status === "COMPLETED",
        info.episodes,
      );
      if (cancelled) return;
      const completed = status === "COMPLETED" || (cap <= 1 && progress >= 1);
      setResult({ watchedKeys, completed });
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, epSig]);

  return result;
}
