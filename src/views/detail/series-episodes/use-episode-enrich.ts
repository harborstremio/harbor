import { useEffect, useMemo, useState } from "react";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import { omdbSeasonRatings } from "@/lib/providers/omdb";
import type { Episode } from "@/lib/providers/tmdb";
import { tvdbEpisodes, tvdbSeriesByImdb, type TvdbEpisode } from "@/lib/providers/tvdb";

export function useEpisodeEnrich({
  episodes,
  active,
  imdbId,
  tvdbKey,
  omdbKey,
}: {
  episodes: Episode[];
  active: number;
  imdbId: string | null;
  tvdbKey: string;
  omdbKey: string;
}): Episode[] {
  const [tvdbBySeason, setTvdbBySeason] = useState<Map<number, Map<number, TvdbEpisode>>>(
    new Map(),
  );
  const [omdbBySeason, setOmdbBySeason] = useState<Map<number, Map<number, number>>>(new Map());
  const [harborImdb, setHarborImdb] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!tvdbKey || !imdbId) return;
    if (tvdbBySeason.has(active)) return;
    let cancelled = false;
    void (async () => {
      const seriesId = await tvdbSeriesByImdb(tvdbKey, imdbId);
      if (!seriesId || cancelled) return;
      const eps = await tvdbEpisodes(tvdbKey, seriesId, active);
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
  return useMemo<Episode[]>(() => {
    if (!tvdbForSeason && !omdbForSeason && harborImdb.size === 0) return episodes;
    return episodes.map((ep): Episode => {
      let next: Episode = ep;
      const tv = tvdbForSeason?.get(ep.episodeNumber);
      if (tv) {
        const overview =
          tv.overview && tv.overview.trim().length > (next.overview?.trim().length ?? 0)
            ? tv.overview
            : next.overview;
        next = {
          ...next,
          overview,
          runtime: next.runtime ?? tv.runtime ?? null,
          name: next.name || tv.name || next.name,
          airDate: next.airDate ?? tv.aired ?? null,
        };
      }
      const imdbRating =
        harborImdb.get(`${active}:${ep.episodeNumber}`) ?? omdbForSeason?.get(ep.episodeNumber);
      if (imdbRating != null && imdbRating > 0) {
        next = { ...next, imdbRating };
      }
      return next;
    });
  }, [episodes, tvdbForSeason, omdbForSeason, harborImdb, active]);
}
