import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { tmdbDetails, type CastEntry, type TmdbDetail } from "@/lib/providers/tmdb";
import { fetchTvdbCast } from "@/lib/providers/tvdb-cast";
import { useSettings } from "@/lib/settings";

function kitsuIdOf(meta: Meta): number | null {
  const m = meta.id?.match(/^kitsu:(\d+)/);
  return m ? Number(m[1]) : null;
}

export function useXrayCast(
  meta: Meta | null,
  open: boolean,
): { cast: CastEntry[] | null; details: TmdbDetail | null; loading: boolean } {
  const { settings } = useSettings();
  const [details, setDetails] = useState<TmdbDetail | null>(null);
  const [cast, setCast] = useState<CastEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const key = settings.tmdbKey;

  useEffect(() => {
    // Without a TMDB key this used to bail before setting any state, so the rail
    // skipped "Reading the cast" and sat on "Looking for who is on screen"
    // forever with an empty gallery. TVDB needs no key, so try it either way.
    if (!open || !meta) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const detail = key ? await tmdbDetails(key, meta).catch(() => null) : null;
      if (cancelled) return;
      setDetails(detail);

      let list = detail?.cast ?? [];
      if (list.length === 0) {
        const imdb = meta.id?.startsWith("tt") ? meta.id : (detail?.imdbId ?? null);
        list = await fetchTvdbCast({
          imdb,
          kitsuId: kitsuIdOf(meta),
          type: meta.type === "movie" ? "movie" : "series",
        }).catch(() => []);
      }
      if (cancelled) return;
      setCast(list);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, meta?.id, key]);

  return { cast, details, loading };
}
