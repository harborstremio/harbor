import { useEffect, useMemo, useState } from "react";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { tmdbTrailerList } from "@/lib/providers/tmdb";
import { fetchTrailer, resolveTrailerQuality, trailerSrc, type TrailerInfo } from "@/lib/trailer";
import { usePageVisible } from "@/lib/visibility";
import { useSettings } from "@/lib/settings";

const DWELL_MS = 2200;

export function useBpTrailer(meta: Meta | null): { src: string | null } {
  const { settings } = useSettings();
  const pageVisible = usePageVisible();
  const id = meta?.id ?? "";
  const type = meta?.type;
  const enabled = Boolean(id) && settings.heroTrailers !== false;
  const quality = resolveTrailerQuality(settings.trailerQuality);
  const request = useMemo(
    () => ({ id, type, quality, enabled, tmdbKey: settings.tmdbKey }),
    [id, type, quality, enabled, settings.tmdbKey],
  );
  const [result, setResult] = useState<{ request: typeof request; info: TrailerInfo } | null>(null);

  useEffect(() => {
    if (!request.enabled) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const lookup: Promise<string[]> = request.id.startsWith("tmdb:")
        ? tmdbTrailerList(request.tmdbKey, request.id)
        : fetchMeta(narrowMediaType(request.type), request.id).then((full) => {
            const ids = [
              full?.trailers?.[0]?.source,
              ...(full?.trailerStreams?.map((s) => s.ytId) ?? []),
            ].filter((s): s is string => Boolean(s));
            return [...new Set(ids)];
          });

      lookup
        .then((ids) => {
          if (cancelled || !ids[0]) return;
          return fetchTrailer(ids[0], request.quality).then((info) => {
            if (!cancelled && info) setResult({ request, info });
          });
        })
        .catch(() => {});
    }, DWELL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [request]);

  // A settings/focus change must hide the old trailer on the very first render,
  // before effects run or a previous native request finishes.
  return {
    src: result?.request === request && pageVisible ? trailerSrc(result.info) : null,
  };
}
