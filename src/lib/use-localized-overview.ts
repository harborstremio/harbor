import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { tmdbMetadataOverview } from "@/lib/providers/tmdb/tmdb-lite";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { useSettings } from "@/lib/settings";
import { usePreferredMeta } from "@/lib/use-preferred-meta";

export function useLocalizedOverview(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const preferredMeta = usePreferredMeta(meta);
  const isTmdb = meta.id.startsWith("tmdb:");
  const shouldLocalize = Boolean(
    settings.tmdbKey && settings.tmdbLanguage && settings.translateDescriptions,
  );
  const [overview, setOverview] = useState<string | undefined>(
    isTmdb ? undefined : meta.description,
  );

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!shouldLocalize) {
        setOverview(preferredMeta?.description || meta.description);
        return;
      }

      const tmdbId = isTmdb
        ? meta.id
        : meta.id.startsWith("tt")
          ? await tmdbIdFromImdb(
              settings.tmdbKey,
              meta.id,
              meta.type === "series" ? "series" : meta.type === "movie" ? "movie" : undefined,
            )
          : null;
      if (!alive) return;
      if (!tmdbId) {
        setOverview(preferredMeta?.description || meta.description);
        return;
      }

      setOverview(undefined);
      const localized = await tmdbMetadataOverview(settings.tmdbKey, tmdbId).catch(() => null);
      if (!alive) return;
      if (localized) {
        setOverview(localized);
        return;
      }
      if (!isTmdb) {
        setOverview(preferredMeta?.description || meta.description);
        return;
      }

      setOverview(preferredMeta?.description || meta.description);
    };

    void load();
    return () => {
      alive = false;
    };
  }, [
    meta.description,
    meta.id,
    meta.type,
    preferredMeta?.description,
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.translateDescriptions,
    shouldLocalize,
  ]);

  return overview;
}
