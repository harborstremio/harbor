import type { Meta } from "@/lib/cinemeta";
import { fetchSeasonEpisodes, fetchSeasonList, isAnimeId } from "@/lib/series-episodes";
import { useSettings } from "@/lib/settings";
import type { PlayEpisode } from "@/lib/view";
import { useEffect, useState } from "react";

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
} {
  const { settings } = useSettings();
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number>(current?.imdbSeason ?? current?.season ?? 1);
  const [episodes, setEpisodes] = useState<PlayEpisode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setSeason(current?.imdbSeason ?? current?.season ?? 1);
  }, [open, meta.id, current?.imdbSeason, current?.season]);

  useEffect(() => {
    if (!open || (meta.type !== "series" && !isAnimeId(meta.id))) return;
    let cancelled = false;
    fetchSeasonList(meta, { tmdbKey: settings.tmdbKey })
      .then((s) => {
        if (!cancelled) setSeasons(s);
      })
      .catch(() => {
        if (!cancelled) setSeasons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, meta.id, meta.type, settings.tmdbKey]);

  useEffect(() => {
    if (!open || (meta.type !== "series" && !isAnimeId(meta.id))) {
      setEpisodes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSeasonEpisodes(meta, season, { tmdbKey: settings.tmdbKey })
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
  }, [open, meta.id, meta.type, season, settings.tmdbKey]);

  return { seasons, season, setSeason, episodes, loading };
}
