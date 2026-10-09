import { useEffect, useMemo, useState } from "react";
import { harborImdbEpisodes, harborImdbEpisodesCached } from "@/lib/providers/harbor-imdb";
import { omdbSeasonRatings } from "@/lib/providers/omdb";
import { tvdbEpisodes, tvdbSeriesByImdb, type TvdbEpisode } from "@/lib/providers/tvdb";
import { useSettings } from "@/lib/settings";

export type BpEpisodeEnrich = {
  imdb: Map<string, number>;
  omdb: Map<number, number>;
  tvdb: Map<number, TvdbEpisode>;
};

const NO_IMDB: Map<string, number> = new Map();
const NO_OMDB: Map<number, number> = new Map();
const NO_TVDB: Map<number, TvdbEpisode> = new Map();

type BpSeasonMap<T> = { season: number; map: T };

const OMDB_AT: BpSeasonMap<Map<number, number>> = { season: -1, map: NO_OMDB };
const TVDB_AT: BpSeasonMap<Map<number, TvdbEpisode>> = { season: -1, map: NO_TVDB };

export function useBpEpisodeEnrich(imdbId: string | null, season: number): BpEpisodeEnrich {
  const { settings } = useSettings();
  const omdbKey = settings.omdbKey;
  const tvdbKey = settings.tvdbKey;

  const [imdb, setImdb] = useState<Map<string, number>>(
    () => (imdbId ? harborImdbEpisodesCached(imdbId) : undefined) ?? NO_IMDB,
  );
  const [omdb, setOmdb] = useState<BpSeasonMap<Map<number, number>>>(OMDB_AT);
  const [tvdb, setTvdb] = useState<BpSeasonMap<Map<number, TvdbEpisode>>>(TVDB_AT);

  useEffect(() => {
    setImdb((imdbId ? harborImdbEpisodesCached(imdbId) : undefined) ?? NO_IMDB);
    if (!imdbId) return;
    let cancelled = false;
    void harborImdbEpisodes(imdbId)
      .then((m) => {
        if (!cancelled && m.size > 0) setImdb(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  useEffect(() => {
    if (!omdbKey || !imdbId || season <= 0) return;
    let cancelled = false;
    void (async () => {
      const map = await omdbSeasonRatings(omdbKey, imdbId, season);
      if (cancelled || map.size === 0) return;
      setOmdb({ season, map });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId, season, omdbKey]);

  useEffect(() => {
    if (!tvdbKey || !imdbId || season <= 0) return;
    let cancelled = false;
    void (async () => {
      const seriesId = await tvdbSeriesByImdb(tvdbKey, imdbId);
      if (!seriesId || cancelled) return;
      const eps = await tvdbEpisodes(tvdbKey, seriesId, season);
      if (cancelled || eps.length === 0) return;
      const map = new Map<number, TvdbEpisode>();
      for (const e of eps) map.set(e.number, e);
      if (map.size > 0) setTvdb({ season, map });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId, season, tvdbKey]);

  const omdbLive = omdb.season === season ? omdb.map : NO_OMDB;
  const tvdbLive = tvdb.season === season ? tvdb.map : NO_TVDB;

  return useMemo(
    () => ({ imdb, omdb: omdbLive, tvdb: tvdbLive }),
    [imdb, omdbLive, tvdbLive],
  );
}
