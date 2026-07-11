import { fetchTvdbProxyImages, type TvdbImageMap } from "@/lib/providers/tvdb-proxy";
import { useEffect, useState } from "react";

const LONG_SEASON_MIN = 60;

export function useSeriesTvdbStills(imdbId: string | null, seasonEpisodeCount: number, type: string): TvdbImageMap {
  const [map, setMap] = useState<TvdbImageMap>({});
  const isLong = seasonEpisodeCount > LONG_SEASON_MIN;
  useEffect(() => {
    if (!isLong || !imdbId) {
      setMap({});
      return;
    }
    let cancel = false;
    void fetchTvdbProxyImages({ imdb: imdbId, type }).then((m) => {
      if (!cancel) setMap(m);
    });
    return () => {
      cancel = true;
    };
  }, [imdbId, type, isLong]);
  return map;
}
