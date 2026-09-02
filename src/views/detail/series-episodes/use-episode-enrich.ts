import { useEffect, useMemo, useState } from "react";
import { pickLocalizedText } from "@/lib/localized-text";
import {
  PREFERRED_TEXT_SCORE,
  preferredMeta,
  preferredVideoMap,
  preferredVideoName,
  preferredVideoOverview,
  type PreferredVideo,
} from "@/lib/meta-resource";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import { omdbSeasonRatings } from "@/lib/providers/omdb";
import type { Episode } from "@/lib/providers/tmdb";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { tvdbEpisodes, tvdbLangFromIso1, tvdbSeriesByImdb, type TvdbEpisode } from "@/lib/providers/tvdb";

export function useEpisodeEnrich({
  episodes,
  active,
  imdbId,
  tvdbKey,
  omdbKey,
  metaId,
  preferCustomMeta,
}: {
  episodes: Episode[];
  active: number;
  imdbId: string | null;
  tvdbKey: string;
  omdbKey: string;
  metaId: string;
  preferCustomMeta: boolean;
}): {
  episodes: Episode[];
  imdbRatings: Map<string, number>;
  preferredVideos: Map<string, PreferredVideo>;
} {
  const [tvdbBySeason, setTvdbBySeason] = useState<Map<number, Map<number, TvdbEpisode>>>(new Map());
  const [omdbBySeason, setOmdbBySeason] = useState<Map<number, Map<number, number>>>(new Map());
  const [harborImdb, setHarborImdb] = useState<Map<string, number>>(new Map());
  const [preferredVideos, setPreferredVideos] = useState<Map<string, PreferredVideo>>(new Map());

  useEffect(() => {
    setPreferredVideos((prev) => (prev.size === 0 ? prev : new Map<string, PreferredVideo>()));
    if (!preferCustomMeta || !metaId) return;
    let cancelled = false;
    void preferredMeta("series", metaId).then((full) => {
      if (cancelled) return;
      const map = preferredVideoMap(full?.videos);
      if (map.size > 0) setPreferredVideos(map);
    });
    return () => {
      cancelled = true;
    };
  }, [metaId, preferCustomMeta]);

  useEffect(() => {
    if (!tvdbKey || !imdbId) return;
    if (tvdbBySeason.has(active)) return;
    let cancelled = false;
    void (async () => {
      const seriesId = await tvdbSeriesByImdb(tvdbKey, imdbId);
      if (!seriesId || cancelled) return;
      const eps = await tvdbEpisodes(tvdbKey, seriesId, active, tvdbLangFromIso1(tmdbLanguageIso()));
      if (cancelled) return;
      const map = new Map<number, TvdbEpisode>();
      for (const e of eps) map.set(e.number, e);
      setTvdbBySeason((prev) => new Map(prev).set(active, map));
    })();
    return () => {
      cancelled = true;
    };
  }, [imdbId, active, tvdbKey, tvdbBySeason]);

  useEffect(() => {
    if (!omdbKey || !imdbId) return;
    if (omdbBySeason.has(active)) return;
    let cancelled = false;
    void (async () => {
      const map = await omdbSeasonRatings(omdbKey, imdbId, active);
      if (cancelled || map.size === 0) return;
      setOmdbBySeason((prev) => new Map(prev).set(active, map));
    })();
    return () => {
      cancelled = true;
    };
  }, [imdbId, active, omdbKey, omdbBySeason]);

  useEffect(() => {
    if (!imdbId) return;
    let cancelled = false;
    void harborImdbEpisodes(imdbId).then((map) => {
      if (!cancelled && map.size > 0) setHarborImdb(map);
    });
    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  const tvdbForSeason = tvdbBySeason.get(active);
  const omdbForSeason = omdbBySeason.get(active);
  const enriched = useMemo<Episode[]>(() => {
    if (!tvdbForSeason && !omdbForSeason && harborImdb.size === 0 && preferredVideos.size === 0)
      return episodes;
    return episodes.map((ep): Episode => {
      let next: Episode = ep;
      const tv = tvdbForSeason?.get(ep.episodeNumber);
      const pref = preferredVideos.get(`${ep.seasonNumber}:${ep.episodeNumber}`);
      if (tv || pref) {
        // pickLocalizedText keys script tests by ISO-1 ("ko"), not TVDB codes ("kor").
        const lang = tmdbLanguageIso();
        const name =
          pickLocalizedText(
            [
              { text: preferredVideoName(pref), score: PREFERRED_TEXT_SCORE },
              { text: tv?.name ?? "" },
              { text: next.name },
            ],
            { forName: true, lang },
          ) ?? next.name;
        const overview =
          pickLocalizedText(
            [
              { text: preferredVideoOverview(pref), score: PREFERRED_TEXT_SCORE },
              { text: tv?.overview ?? "" },
              { text: next.overview },
            ],
            { lang },
          ) ?? next.overview;
        next = {
          ...next,
          name,
          overview,
          runtime: next.runtime ?? tv?.runtime ?? null,
          airDate: next.airDate ?? tv?.aired ?? null,
        };
      }
      const imdbRating =
        harborImdb.get(`${active}:${ep.episodeNumber}`) ?? omdbForSeason?.get(ep.episodeNumber);
      if (imdbRating != null && imdbRating > 0) {
        next = { ...next, imdbRating };
      }
      return next;
    });
  }, [episodes, tvdbForSeason, omdbForSeason, harborImdb, active, preferredVideos]);
  return { episodes: enriched, imdbRatings: harborImdb, preferredVideos };
}
