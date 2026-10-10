import { useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { simklRequest } from "./client";
import type { SimklIds, SimklTarget } from "./types";
import { updateCachedRatingByTarget, getCachedRatingByTarget } from "./activities";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export { getCachedRatingByTarget };

const RATINGS_PROXY = `${HARBOR_API_BASE}/api/simkl/ratings`;
const MAX_BATCH = 120;

const ratingCache = new Map<string, number | null>();
const pending = new Map<string, Array<(v: number | null) => void>>();
let flushTimer: number | null = null;

function flush(): void {
  flushTimer = null;
  const specs = Array.from(pending.keys()).slice(0, MAX_BATCH);
  if (specs.length === 0) return;

  const resolvers = specs.map((s) => [s, pending.get(s)!] as const);
  specs.forEach((s) => pending.delete(s));
  if (pending.size > 0) scheduleFlush();

  const url = `${RATINGS_PROXY}?ids=${encodeURIComponent(specs.join(","))}`;
  safeFetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { ratings?: Record<string, { rating?: number } | null> } | null) => {
      for (const [spec, fns] of resolvers) {
        const hit = data?.ratings?.[spec];
        const val = hit && typeof hit.rating === "number" ? hit.rating : null;
        ratingCache.set(spec, val);
        fns.forEach((fn) => fn(val));
      }
    })
    .catch(() => {
      for (const [, fns] of resolvers) fns.forEach((fn) => fn(null));
    });
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(flush, 60);
}

function resolveRatingBySpec(rawSpec: string): Promise<number | null> {
  const spec = rawSpec.toLowerCase();
  if (ratingCache.has(spec)) return Promise.resolve(ratingCache.get(spec) ?? null);
  return new Promise((resolve) => {
    const arr = pending.get(spec);
    if (arr) arr.push(resolve);
    else pending.set(spec, [resolve]);
    scheduleFlush();
  });
}

function useProxyRating(spec: string | null): { rating: number | null; loading: boolean } {
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!spec) {
      setRating(null);
      setLoading(false);
      return;
    }
    const key = spec.toLowerCase();
    if (ratingCache.has(key)) {
      setRating(ratingCache.get(key) ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveRatingBySpec(key).then((v) => {
      if (!cancelled) {
        setRating(v);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [spec]);

  return { rating, loading };
}

export function useSimklCommunityRating(imdbId: string | null): {
  rating: number | null;
  loading: boolean;
} {
  return useProxyRating(imdbId ? `imdb:${imdbId}` : null);
}

export function useSimklCardScores(imdbId: string | undefined): {
  score: number | null;
  loading: boolean;
} {
  const { rating, loading } = useProxyRating(imdbId ? `imdb:${imdbId}` : null);
  return { score: rating, loading };
}

const ANIME_SPEC = /^(mal|kitsu|anidb|anilist|simkl):\d+$/;

export function useSimklCardScoresByAnimeId(animeId: string | undefined): {
  score: number | null;
  loading: boolean;
} {
  const spec = animeId && ANIME_SPEC.test(animeId) ? animeId : null;
  const { rating, loading } = useProxyRating(spec);
  return { score: rating, loading };
}

function getRatingPayload(target: SimklTarget): { key: string; ids: SimklIds } {
  const isMovie = target.kind === "movie";
  const isAnime = target.kind === "anime" || target.kind === "anime-episode";

  const ids =
    target.kind === "episode"
      ? target.show.ids
      : target.kind === "anime-episode"
        ? target.anime.ids
        : target.ids;

  const key = isMovie ? "movies" : isAnime ? "anime" : "shows";
  return { key, ids };
}

export async function addSimklRating(target: SimklTarget, rating: number): Promise<boolean> {
  const { key, ids } = getRatingPayload(target);
  try {
    await simklRequest("/sync/ratings", {
      method: "POST",
      body: { [key]: [{ rating, ids }] },
    });
    updateCachedRatingByTarget(target, rating);
    return true;
  } catch (e) {
    console.error("Failed to add SIMKL rating", e);
    return false;
  }
}

export async function removeSimklRating(target: SimklTarget): Promise<boolean> {
  const { key, ids } = getRatingPayload(target);
  try {
    await simklRequest("/sync/ratings/remove", {
      method: "POST",
      body: { [key]: [{ ids }] },
    });
    updateCachedRatingByTarget(target, null);
    return true;
  } catch (e) {
    console.error("Failed to remove SIMKL rating", e);
    return false;
  }
}
