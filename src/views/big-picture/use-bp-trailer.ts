import { useEffect, useState } from "react";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { tmdbTrailerList } from "@/lib/providers/tmdb";
import { fetchTrailer, prefetchTrailer, trailerSrc, type TrailerInfo } from "@/lib/trailer";
import { usePageVisible } from "@/lib/visibility";
import { useSettings } from "@/lib/settings";

const DWELL_MS = 2200;

export function useBpTrailer(meta: Meta | null): { src: string | null } {
  const { settings } = useSettings();
  const pageVisible = usePageVisible();
  const [info, setInfo] = useState<TrailerInfo | null>(null);
  const [settled, setSettled] = useState(false);

  const id = meta?.id ?? "";
  const enabled = Boolean(id) && settings.heroTrailers !== false;

  useEffect(() => {
    setInfo(null);
    setSettled(false);
    if (!enabled) return;
    const timer = window.setTimeout(() => setSettled(true), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [id, enabled]);

  useEffect(() => {
    if (!settled || !meta || info) return;
    let cancelled = false;

    const lookup: Promise<string[]> = meta.id.startsWith("tmdb:")
      ? tmdbTrailerList(settings.tmdbKey, meta.id)
      : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => {
          const ids = [
            full?.trailers?.[0]?.source,
            ...(full?.trailerStreams?.map((s) => s.ytId) ?? []),
          ].filter((s): s is string => Boolean(s));
          return [...new Set(ids)];
        });

    lookup
      .then((ids) => {
        if (cancelled || !ids[0]) return;
        void prefetchTrailer(ids[0], "360p");
        return fetchTrailer(ids[0], "360p").then((found) => {
          if (!cancelled && found) setInfo(found);
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [settled, meta?.id, meta?.type, settings.tmdbKey, info]);

  return { src: info && pageVisible ? trailerSrc(info) : null };
}
