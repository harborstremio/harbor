import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { buildStreamIds } from "@/lib/streams/stream-ids";

export function useStreamIds(
  meta: Meta,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
  omitEpisode?: boolean,
): string[] | null {
  const [streamIds, setStreamIds] = useState<string[] | null>(null);
  useEffect(() => {
    const out = buildStreamIds(meta.id, episode, imdbId, meta.behaviorHints?.defaultVideoId, omitEpisode);
    setStreamIds(out.length > 0 ? out : null);
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
    omitEpisode,
  ]);
  return streamIds;
}
