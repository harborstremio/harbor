import { meta as fetchCinemetaMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { harborImdbTitle } from "@/lib/providers/harbor-imdb";
import { useOmdbScores } from "@/lib/providers/omdb";
import { useEffect, useState } from "react";

export function useImdbRating(meta: Meta, resolvedImdb?: string | null): string | undefined {
  const omdb = useOmdbScores(resolvedImdb ?? undefined);
  const [cinemetaRating, setCinemetaRating] = useState<string | undefined>(undefined);
  const [harborRating, setHarborRating] = useState<string | undefined>(undefined);
  const isImdbId = meta.id.startsWith("tt");
  useEffect(() => {
    setCinemetaRating(undefined);
    if (isImdbId || !resolvedImdb || !resolvedImdb.startsWith("tt")) return;
    let cancelled = false;
    fetchCinemetaMeta(narrowMediaType(meta.type), resolvedImdb)
      .then((full) => {
        if (!cancelled && full?.imdbRating) setCinemetaRating(full.imdbRating);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isImdbId, resolvedImdb, meta.type]);
  useEffect(() => {
    setHarborRating(undefined);
    const tt = isImdbId ? meta.id : resolvedImdb;
    if (!tt || !tt.startsWith("tt")) return;
    let cancelled = false;
    harborImdbTitle(tt)
      .then((r) => {
        if (!cancelled && r != null) setHarborRating(r.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isImdbId, meta.id, resolvedImdb]);
  return harborRating ?? omdb?.imdbRating ?? cinemetaRating ?? (isImdbId ? meta.imdbRating : undefined);
}
