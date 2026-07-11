import type { Meta } from "@/lib/cinemeta";
import { harborImdbTitle } from "@/lib/providers/harbor-imdb";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useEffect, useState } from "react";

export type LiveImdb = { value: string | undefined; isImdb: boolean };

export function useLiveImdbRating(meta: Meta): LiveImdb {
  const resolved = useTmdbImdbId(meta.id);
  const tt = meta.id.startsWith("tt") ? meta.id : resolved;
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
  if (meta.imdbRating) return { value: meta.imdbRating, isImdb: meta.id.startsWith("tt") };
  return { value: undefined, isImdb: false };
}
