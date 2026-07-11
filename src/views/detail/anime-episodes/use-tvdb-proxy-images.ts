import { fetchTvdbProxyImages, type TvdbImageMap } from "@/lib/providers/tvdb-proxy";
import { useEffect, useState } from "react";

const LONG_SHOW_MIN = 100;

export function useTvdbProxyImages(
  kitsuId: number | null,
  imdbId: string | null,
  episodeCount: number,
  seasonType: string,
): TvdbImageMap {
  const [map, setMap] = useState<TvdbImageMap>({});
  const isLong = episodeCount > LONG_SHOW_MIN;
  useEffect(() => {
    if (!isLong) {
      setMap({});
      return;
    }
    let cancel = false;
    void fetchTvdbProxyImages({ kitsuId, imdb: imdbId, type: seasonType }).then((m) => {
      if (!cancel) setMap(m);
    });
    return () => {
      cancel = true;
    };
  }, [kitsuId, imdbId, seasonType, isLong]);
  return map;
}
