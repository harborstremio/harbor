import { tvdbSeasonTypes, tvdbSeriesByRemote, type TvdbSeasonTypeOption } from "@/lib/providers/tvdb";
import { useEffect, useState } from "react";

export function useTvdbSeasonTypes(
  imdbId: string | null,
  metaId: string,
  tvdbKey: string,
  enabled: boolean,
): TvdbSeasonTypeOption[] {
  const [types, setTypes] = useState<TvdbSeasonTypeOption[]>([]);
  const remoteId = imdbId && imdbId.startsWith("tt") ? imdbId : metaId.startsWith("tmdb:tv:") ? metaId.slice(8) : null;

  useEffect(() => {
    if (!enabled || !tvdbKey || !remoteId) {
      setTypes([]);
      return;
    }
    let cancelled = false;
    void tvdbSeriesByRemote(tvdbKey, remoteId).then((seriesId) => {
      if (cancelled || !seriesId) return;
      void tvdbSeasonTypes(tvdbKey, seriesId).then((t) => {
        if (!cancelled) setTypes(t);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, tvdbKey, remoteId]);

  return types;
}
