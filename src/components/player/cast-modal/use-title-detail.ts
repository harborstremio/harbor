import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { animeDetails } from "@/lib/providers/anime-detail";
import { useSettings } from "@/lib/settings";
import { tmdbDetails, type TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { imdbapiDetails } from "@/lib/providers/imdbapi/imdbapi-details";

function isAnimeId(id: string): boolean {
  return id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");
}

export function useTitleDetail(meta: Meta, tmdbKey: string | null, active: boolean) {
  const { settings } = useSettings();
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const anime = isAnimeId(meta.id);
  const usedImdbFallback =
    !anime && !tmdbKey && settings.imdbApiFallback && meta.id.startsWith("tt");
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
    if (anime) {
      animeDetails(settings, meta)
        .then((res) => {
          if (cancelled) return;
          setDetail(res?.detail ?? null);
          setLoading(false);
          if (!res) return;
          void res.extrasPromise
            .then((patch) => {
              if (!cancelled) setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
            })
            .catch(() => {});
        })
        .catch(() => {
          if (cancelled) return;
          setDetail(null);
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    const req: Promise<TmdbDetail | null> = tmdbKey
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
