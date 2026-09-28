import { metaImdbId } from "@/lib/meta-identity";
import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { harborImdbTitle } from "@/lib/providers/harbor-imdb";

export type LiveImdb = { value: string | undefined; isImdb: boolean };

export function useLiveImdbRating(meta: Meta): LiveImdb {
  const providedImdb = metaImdbId(meta);
  const resolved = useTmdbImdbId(providedImdb ?? meta.id);
  const tt = providedImdb ?? resolved;
  const [harbor, setHarbor] = useState<string | undefined>(undefined);
  useEffect(() => {
    setHarbor(undefined);
    if (!tt || !tt.startsWith("tt")) return;
    let cancelled = false;
    harborImdbTitle(tt)
      .then((r) => {
        if (!cancelled && r != null) setHarbor(r.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tt]);
  if (harbor) return { value: harbor, isImdb: true };
  if (meta.imdbRating) return { value: meta.imdbRating, isImdb: !!providedImdb };
  return { value: undefined, isImdb: false };
}
