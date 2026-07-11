import { meta as fetchMeta } from "@/lib/cinemeta";
import { useEffect, useState } from "react";

type Kind = "movie" | "series";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<void>>();
const subs = new Set<() => void>();

export function cinemetaRatingCached(imdbId: string | undefined): string | undefined {
  if (!imdbId) return undefined;
  return cache.get(imdbId) ?? undefined;
}

export function cinemetaRatingPrefetch(imdbId: string, kind: Kind): void {
  if (!imdbId.startsWith("tt") || cache.has(imdbId) || inflight.has(imdbId)) return;
  const p = fetchMeta(kind, imdbId)
    .then((m) => {
      cache.set(imdbId, m?.imdbRating ?? null);
    })
    .catch(() => {
      cache.set(imdbId, null);
    })
    .finally(() => {
      inflight.delete(imdbId);
      for (const fn of subs) fn();
    });
  inflight.set(imdbId, p);
}

export function useCinemetaRating(imdbId: string | undefined): string | undefined {
  const [v, setV] = useState<string | undefined>(() => cinemetaRatingCached(imdbId));
  useEffect(() => {
    setV(cinemetaRatingCached(imdbId));
    if (!imdbId) return;
    const fn = () => setV(cinemetaRatingCached(imdbId));
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, [imdbId]);
  return v;
}
