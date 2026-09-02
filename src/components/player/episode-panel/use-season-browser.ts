import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import {
  animeSeriesFromStreamId,
  fetchSeasonEpisodes,
  fetchSeasonList,
  isAnimeId,
} from "@/lib/series-episodes";
import { useSettings } from "@/lib/settings";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import type { PlayEpisode } from "@/lib/view";

export function useSeasonBrowser(
  meta: Meta,
  current: PlayEpisode | undefined,
  open: boolean,
): {
  seasons: number[];
  season: number;
  setSeason: (n: number) => void;
  episodes: PlayEpisode[];
  loading: boolean;
  imdbRatings: Map<string, number>;
} {
  const { settings } = useSettings();
  const effMeta = useMemo<Meta>(() => {
    if (!isAnimeId(meta.id)) return meta;
    const base = animeSeriesFromStreamId(current?.kitsuStreamId);
    return base && base !== meta.id ? { ...meta, id: base } : meta;
  }, [meta, current?.kitsuStreamId]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number>(current?.imdbSeason ?? current?.season ?? 1);
  const [episodes, setEpisodes] = useState<PlayEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [imdbRatings, setImdbRatings] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImdbRatings(new Map());
    void harborImdbEpisodes(effMeta.id).then((map) => {
      if (!cancelled && map.size > 0) setImdbRatings(map);
    });
    return () => {
      cancelled = true;
    };
  }, [open, effMeta.id]);

  useEffect(() => {
    if (open) setSeason(current?.imdbSeason ?? current?.season ?? 1);
  }, [open, meta.id, current?.imdbSeason, current?.season]);

  useEffect(() => {
    if (!open || (effMeta.type !== "series" && !isAnimeId(effMeta.id))) return;
    let cancelled = false;
    fetchSeasonList(effMeta, { tmdbKey: settings.tmdbKey })
      .then((s) => {
        if (!cancelled) setSeasons(s);
      })
      .catch(() => {
        if (!cancelled) setSeasons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, effMeta, settings.tmdbKey]);

  useEffect(() => {
    if (!open || (effMeta.type !== "series" && !isAnimeId(effMeta.id))) {
      setEpisodes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSeasonEpisodes(effMeta, season, { tmdbKey: settings.tmdbKey })
      .then((eps) => {
        if (!cancelled) setEpisodes(eps);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, effMeta, season, settings.tmdbKey]);

  return { seasons, season, setSeason, episodes, loading, imdbRatings };
}
