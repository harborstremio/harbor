import type { Meta } from "@/lib/cinemeta";
import { animeDetails } from "@/lib/providers/anime-detail";
import { imdbapiDetails } from "@/lib/providers/imdbapi/imdbapi-details";
import { tmdbDetails, type TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { useSettings } from "@/lib/settings";
import { useEffect, useState } from "react";

function isAnimeId(id: string): boolean {
  return id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");
}

export function useTitleDetail(meta: Meta, tmdbKey: string | null, active: boolean) {
  const { settings } = useSettings();
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const anime = isAnimeId(meta.id);
  const usedImdbFallback = !anime && !tmdbKey && settings.imdbApiFallback && meta.id.startsWith("tt");
  const canFetch = anime || !!tmdbKey || usedImdbFallback;

  useEffect(() => {
    if (!active) return;
    if (!canFetch) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    const req: Promise<TmdbDetail | null> = anime
      ? animeDetails(settings, meta).then((r) => r?.detail ?? null)
      : tmdbKey
        ? tmdbDetails(tmdbKey, meta)
        : imdbapiDetails(meta.id);
    req
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, meta, tmdbKey, anime, settings, canFetch]);

  return { detail, loading, canFetch, needsKey: !canFetch };
}
