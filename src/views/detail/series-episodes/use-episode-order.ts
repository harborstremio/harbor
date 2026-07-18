import { useEffect, useState } from "react";
import { kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { tvdbLangFromIso1 } from "@/lib/providers/tvdb";
import {
  fetchTvdbOrder,
  fetchTvdbOrderBySeriesId,
  type TvdbOrder,
} from "@/lib/providers/tvdb-order";

export function useEpisodeOrder(
  imdbId: string | null,
  metaId: string,
  provider: "default" | "tmdb" | "tvdb",
  seasonType: string,
  tvdbKey: string,
): TvdbOrder | null {
  const [order, setOrder] = useState<TvdbOrder | null>(null);
  const remoteId =
    imdbId && imdbId.startsWith("tt")
      ? imdbId
      : metaId.startsWith("tmdb:tv:")
        ? metaId.slice(8)
        : null;
  const kitsuId = /^(kitsu|mal|anilist|anidb):/.test(metaId) ? parseKitsuId(metaId) : null;
  const active = provider === "tvdb" && (!!remoteId || kitsuId != null);

  useEffect(() => {
    if (!active) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    const lang = tvdbLangFromIso1(tmdbLanguageIso());
    void (async () => {
      let o: TvdbOrder | null = null;
      if (kitsuId != null) {
        const sid = await kitsuToTvdb(kitsuId).catch(() => null);
        if (sid != null)
          o = await fetchTvdbOrderBySeriesId(tvdbKey, sid, seasonType, lang).catch(() => null);
      }
      if (!o && remoteId)
        o = await fetchTvdbOrder(tvdbKey, remoteId, seasonType, lang).catch(() => null);
      if (!cancelled) setOrder(o);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, remoteId, kitsuId, tvdbKey, seasonType]);

  return active ? order : null;
}
