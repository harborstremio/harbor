import { useEffect, useState } from "react";
import { simklRequest } from "./client";
import type { SimklIds, SimklTarget } from "./types";
import { updateCachedRatingByTarget, getCachedRatingByTarget } from "./activities";

export { getCachedRatingByTarget };

const communityRatingCache = new Map<string, number | null>();

interface SimklSearchIdItem {
  type?: string;
  ids?: { simkl?: number };
  ratings?: { simkl?: { rating?: number } };
}

interface SimklDetailResponse {
  ratings?: { simkl?: { rating?: number } };
}

function detailPathFor(type: string | undefined, simklId: number): string {
  return type === "movie"
    ? `/movies/${simklId}`
    : type === "anime"
      ? `/anime/${simklId}`
      : `/tv/${simklId}`;
}

async function resolveScoreByImdb(imdbId: string): Promise<number | null> {
  const results = await simklRequest<SimklSearchIdItem[]>(
    `/search/id?imdb=${encodeURIComponent(imdbId)}`,
    { method: "GET", authed: false },
  );
  if (!Array.isArray(results) || results.length === 0) return null;

  const item = results[0];
  const directRating = item.ratings?.simkl?.rating;
  if (directRating != null) return directRating;

  const simklId = item.ids?.simkl;
  if (simklId == null) return null;

  const detail = await simklRequest<SimklDetailResponse>(detailPathFor(item.type, simklId), {
    method: "GET",
    authed: false,
  });
  return detail.ratings?.simkl?.rating ?? null;
}

export function useSimklCommunityRating(imdbId: string | null): {
  rating: number | null;
  loading: boolean;
} {
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imdbId) {
      setRating(null);
      setLoading(false);
      return;
    }
    if (communityRatingCache.has(imdbId)) {
      setRating(communityRatingCache.get(imdbId) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = await resolveScoreByImdb(imdbId);
        if (!cancelled) {
          communityRatingCache.set(imdbId, result);
          setRating(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          communityRatingCache.set(imdbId, null);
          setRating(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  return { rating, loading };
}

const cardScoreCache = new Map<string, number | null>();
const cardScoreInFlight = new Map<string, Promise<number | null>>();

async function resolveSimklCardScore(imdbId: string): Promise<number | null> {
  if (cardScoreCache.has(imdbId)) {
    return cardScoreCache.get(imdbId) ?? null;
  }
  if (cardScoreInFlight.has(imdbId)) {
    return cardScoreInFlight.get(imdbId)!;
  }

  const promise = (async () => {
    try {
      const rating = await resolveScoreByImdb(imdbId);
      cardScoreCache.set(imdbId, rating);
      return rating;
    } catch {
      cardScoreCache.set(imdbId, null);
      return null;
    } finally {
      cardScoreInFlight.delete(imdbId);
    }
  })();

  cardScoreInFlight.set(imdbId, promise);
  return promise;
}

export function useSimklCardScores(imdbId: string | undefined): {
  score: number | null;
  loading: boolean;
} {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imdbId) {
      setScore(null);
      setLoading(false);
      return;
    }
    if (cardScoreCache.has(imdbId)) {
      setScore(cardScoreCache.get(imdbId) ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveSimklCardScore(imdbId).then((result) => {
      if (!cancelled) {
        setScore(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  return { score, loading };
}

const animeScoreCache = new Map<string, number | null>();
const animeScoreInFlight = new Map<string, Promise<number | null>>();

const ANIME_ID_PARAM: Record<string, string> = {
  mal: "mal",
  kitsu: "kitsu",
  anidb: "anidb",
  anilist: "anilist",
};

async function resolveSimklCardScoreByAnimeId(animeId: string): Promise<number | null> {
  const cacheKey = `anime:${animeId}`;
  if (animeScoreCache.has(cacheKey)) {
    return animeScoreCache.get(cacheKey) ?? null;
  }
  if (animeScoreInFlight.has(cacheKey)) {
    return animeScoreInFlight.get(cacheKey)!;
  }

  const simklMatch = animeId.match(/^simkl:(\d+)$/);
  const externalMatch = animeId.match(/^(mal|kitsu|anidb|anilist):(\d+)$/);

  if (!simklMatch && !externalMatch) {
    animeScoreCache.set(cacheKey, null);
    return null;
  }

  const resolvedSimklId = simklMatch ? Number(simklMatch[1]) : null;
  const resolvedParam = externalMatch ? ANIME_ID_PARAM[externalMatch[1]] : null;
  const resolvedIdValue = externalMatch ? externalMatch[2] : null;

  const promise = (async () => {
    try {
      if (resolvedSimklId != null) {
        const detail = await simklRequest<SimklDetailResponse>(`/anime/${resolvedSimklId}`, {
          method: "GET",
          authed: false,
        });
        const rating = detail.ratings?.simkl?.rating ?? null;
        animeScoreCache.set(cacheKey, rating);
        return rating;
      }

      if (resolvedParam == null || resolvedIdValue == null) {
        animeScoreCache.set(cacheKey, null);
        return null;
      }
      const results = await simklRequest<SimklSearchIdItem[]>(
        `/search/id?${resolvedParam}=${encodeURIComponent(resolvedIdValue)}`,
        { method: "GET", authed: false },
      );
      if (!Array.isArray(results) || results.length === 0) {
        animeScoreCache.set(cacheKey, null);
        return null;
      }
      const item = results[0];
      const directRating = item.ratings?.simkl?.rating;
      if (directRating != null) {
        animeScoreCache.set(cacheKey, directRating);
        return directRating;
      }
      const simklId = item.ids?.simkl;
      if (simklId == null) {
        animeScoreCache.set(cacheKey, null);
        return null;
      }
      const detail = await simklRequest<SimklDetailResponse>(detailPathFor(item.type, simklId), {
        method: "GET",
        authed: false,
      });
      const rating = detail.ratings?.simkl?.rating ?? null;
      animeScoreCache.set(cacheKey, rating);
      return rating;
    } catch {
      animeScoreCache.set(cacheKey, null);
      return null;
    } finally {
      animeScoreInFlight.delete(cacheKey);
    }
  })();

  animeScoreInFlight.set(cacheKey, promise);
  return promise;
}

export function useSimklCardScoresByAnimeId(animeId: string | undefined): {
  score: number | null;
  loading: boolean;
} {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!animeId) {
      setScore(null);
      setLoading(false);
      return;
    }
    const cacheKey = `anime:${animeId}`;
    if (animeScoreCache.has(cacheKey)) {
      setScore(animeScoreCache.get(cacheKey) ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveSimklCardScoreByAnimeId(animeId).then((result) => {
      if (!cancelled) {
        setScore(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  return { score, loading };
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
