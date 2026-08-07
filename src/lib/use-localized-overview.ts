import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { tmdbMetadataOverview } from "@/lib/providers/tmdb/tmdb-lite";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { useSettings } from "@/lib/settings";

export function useLocalizedOverview(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const [overview, setOverview] = useState<string | undefined>(meta.description);

  useEffect(() => {
    if (!settings.tmdbKey || !settings.heroLocalizedMetadata) {
      setOverview(meta.description);
      return;
    }
    let alive = true;
    const fetchOverview = async () => {
      let tmdbId = meta.id;
      if (tmdbId.startsWith("tt")) {
        const resolved = await tmdbIdFromImdb(settings.tmdbKey, tmdbId);
        if (resolved) {
          tmdbId = resolved;
        } else {
          if (alive) setOverview(meta.description);
          return;
        }
      } else if (!tmdbId.startsWith("tmdb:")) {
        if (alive) setOverview(meta.description);
        return;
      }
      const o = await tmdbMetadataOverview(settings.tmdbKey, tmdbId);
      if (alive) setOverview(o ?? meta.description);
    };

    void fetchOverview();
    return () => {
      alive = false;
    };
  }, [meta.id, settings.tmdbKey, meta.description, settings.heroLocalizedMetadata]);

  return overview;
}
