import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { tmdbMetadataOverview } from "@/lib/providers/tmdb/tmdb-lite";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { useSettings } from "@/lib/settings";

export function useLocalizedOverview(meta: Meta, resolveImdb = false): string | undefined {
  const { settings } = useSettings();
  const request = useMemo(
    () => ({
      id: meta.id,
      type: meta.type === "movie" || meta.type === "series" ? meta.type : undefined,
      key: settings.tmdbKey,
      language: settings.tmdbLanguage || "en",
      enabled: settings.translateDescriptions !== false,
      resolveImdb,
    }),
    [meta.id, meta.type, settings.tmdbKey, settings.tmdbLanguage, settings.translateDescriptions, resolveImdb],
  );
  const [resolved, setResolved] = useState<{ request: typeof request; overview?: string } | null>(null);
  useEffect(() => {
    if (!request.enabled || !request.key) return;
    const isTmdb = /^tmdb:(movie|tv):\d+$/.test(request.id);
    const isImdb = request.resolveImdb && request.type && /^tt\d+$/.test(request.id);
    if (!isTmdb && !isImdb) return;
    let alive = true;
    void (async () => {
      const id = isTmdb
        ? request.id
        : await tmdbIdFromImdb(request.key, request.id, request.type);
      if (!alive || !id) return;
      const overview = await tmdbMetadataOverview(request.key, id, request.language);
      if (alive) setResolved({ request, overview });
    })().catch(() => { /* Keep catalog text when localization is unavailable. */ });
    return () => { alive = false; };
  }, [request]);
  return (resolved?.request === request ? resolved.overview : undefined) ?? meta.description;
}
