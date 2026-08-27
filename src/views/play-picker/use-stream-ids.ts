import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { buildStreamIdsWithIdentity } from "@/lib/streams/anime-identity";

export function useStreamIds(
  meta: Meta,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
): string[] | null {
  const [streamIds, setStreamIds] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out = await buildStreamIdsWithIdentity(
        meta.id,
        episode,
        imdbId,
        meta.behaviorHints?.defaultVideoId,
      );
      if (cancelled) return;
      setStreamIds((prev) => {
        // Preserve reference when unchanged: pipeline effects refire on new arrays.
        if (prev && prev.join("|") === out.join("|")) return prev;
        return out.length > 0 ? out : null;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    meta.id,
    meta.behaviorHints?.defaultVideoId,
    imdbId,
    episode?.kitsuStreamId,
    episode?.videoId,
    episode?.imdbId,
    episode?.imdbSeason,
    episode?.imdbEpisode,
    episode?.season,
    episode?.episode,
  ]);
  return streamIds;
}
