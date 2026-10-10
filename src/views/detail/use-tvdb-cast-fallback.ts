import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import { fetchTvdbCast } from "@/lib/providers/tvdb-cast";

function needsCast(detail: TmdbDetail | null): detail is TmdbDetail {
  if (!detail) return false;
  if (detail.cast.length === 0) return true;
  return detail.cast.every((c) => c.id < 0 && !c.profilePath);
}

export function useTvdbCastFallback(
  meta: Meta,
  detail: TmdbDetail | null,
  kitsuId: number | null,
  setDetail: Dispatch<SetStateAction<TmdbDetail | null>>,
) {
  useEffect(() => {
    if (!needsCast(detail)) return;
    const imdb = detail.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
    if (!imdb && kitsuId == null) return;
    let cancelled = false;
    fetchTvdbCast({ imdb, kitsuId, type: meta.type === "series" ? "series" : "movie" })
      .then((cast) => {
        if (cancelled || cast.length === 0) return;
        setDetail((prev) => (prev && needsCast(prev) ? { ...prev, cast } : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [detail, meta.id, meta.type, kitsuId, setDetail]);
}
