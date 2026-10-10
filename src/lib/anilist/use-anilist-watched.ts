import { useEffect, useMemo, useRef, useState } from "react";
import { useAnilist } from "@/lib/anilist/provider";
import { fetchListEntry } from "@/lib/anilist/mutations";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { airedOnly } from "@/lib/aired";

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
      const sorted = airedOnly(
        [...episodesRef.current].sort(
          (a, b) => (a.seasonNumber ?? 1) - (b.seasonNumber ?? 1) || a.number - b.number,
        ),
        (e) => e.airdate,
      );
      const mediaTotal = info.episodes;
      const cap =
        mediaTotal != null && mediaTotal > 0 ? Math.min(sorted.length, mediaTotal) : sorted.length;
      const watchedCount =
        status === "COMPLETED" ? cap : Math.max(0, Math.min(progress, cap));
      const watchedKeys = new Set<string>();
      for (let i = 0; i < watchedCount; i++) {
        const ep = sorted[i];
        watchedKeys.add(`${ep.seasonNumber ?? 1}:${ep.number}`);
      }
      const completed = status === "COMPLETED" || (cap <= 1 && progress >= 1);
      setResult({ watchedKeys, completed });
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, epSig]);

  return result;
}
