import { metaImdbId } from "@/lib/meta-identity";
import { useEffect, useState } from "react";
import { meta as fetchCinemetaMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useOmdbScores } from "@/lib/providers/omdb";
import { harborImdbTitle } from "@/lib/providers/harbor-imdb";

export function useImdbRating(meta: Meta, resolvedImdb?: string | null): string | undefined {
  const providedImdb = metaImdbId(meta);
  const ratingId = providedImdb ?? resolvedImdb;
  const omdb = useOmdbScores(ratingId ?? undefined);
  const [cinemetaRating, setCinemetaRating] = useState<string | undefined>(undefined);
  const [harborRating, setHarborRating] = useState<string | undefined>(undefined);
  const isImdbId = !!providedImdb;
  useEffect(() => {
    setCinemetaRating(undefined);
    if ((isImdbId && meta.imdbRating) || !ratingId || !ratingId.startsWith("tt")) return;
    let cancelled = false;
    fetchCinemetaMeta(narrowMediaType(meta.type), ratingId)
      .then((full) => {
        if (!cancelled && full?.imdbRating) setCinemetaRating(full.imdbRating);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isImdbId, ratingId, meta.type, meta.imdbRating]);
  useEffect(() => {
    setHarborRating(undefined);
    const tt = ratingId;
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
  }, [ratingId]);
  return (
    harborRating ?? omdb?.imdbRating ?? cinemetaRating ?? (isImdbId ? meta.imdbRating : undefined)
  );
}
