import { useEffect, useState } from "react";
import { lruGet, lruSet } from "@/lib/cache";
import { safeFetch } from "@/lib/safe-fetch";

export type MdblistScores = {
  score: number | null;
  letterboxd: number | null;
  trakt: number | null;
  metacritic: number | null;
  rtAudience: number | null;
  simkl: number | null;
};

type RatingRow = { source?: string; value?: number | null };
type ApiShape = {
  ratings?: RatingRow[];
  score_average?: number | null;
  scoreaverage?: number | null;
  score?: number | null;
};

function positive(...vals: (number | null | undefined)[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const CACHE_MAX = 256;
const cache = new Map<string, { scores: MdblistScores | null; expiresAt: number }>();
const inflight = new Map<string, Promise<MdblistScores | null>>();

function parse(json: ApiShape): MdblistScores {
  const rows = json.ratings ?? [];
  const val = (source: string) => {
    const r = rows.find((x) => x.source === source);
    return typeof r?.value === "number" && r.value > 0 ? r.value : null;
  };
  const agg = positive(json.score_average, json.scoreaverage, json.score);
  const simklVal = val("simkl");
  return {
    score: agg,
    letterboxd: val("letterboxd"),
    trakt: val("trakt"),
    metacritic: val("metacritic"),
    rtAudience: val("tomatoesaudience") ?? val("audience") ?? val("popcorn"),
    simkl: simklVal !== null ? (simklVal > 10 ? simklVal / 10 : simklVal) : null,
  };
}

async function fetchScores(
  key: string,
  imdbId: string,
  type: "movie" | "show",
): Promise<MdblistScores | null> {
  try {
    const res = await safeFetch(
      `https://api.mdblist.com/imdb/${type}/${encodeURIComponent(imdbId)}?apikey=${encodeURIComponent(key)}`,
    );
    if (res.ok) {
      const json = (await res.json()) as ApiShape;
      if (Array.isArray(json.ratings)) return parse(json);
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const res = await safeFetch(
      `https://mdblist.com/api/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ApiShape;
    if (!Array.isArray(json.ratings)) return null;
    return parse(json);
  } catch {
    return null;
  }
}

export function mdblistScores(
  key: string,
  imdbId: string,
  type: "movie" | "show" = "movie",
): Promise<MdblistScores | null> {
  const apiKey = key.trim();
  if (!apiKey || !imdbId.startsWith("tt")) return Promise.resolve(null);
  // A corrected credential must not reuse an earlier failure or pending request.
  const ck = JSON.stringify([apiKey, type, imdbId]);
  const hit = lruGet(cache, ck);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.scores);
  if (hit) cache.delete(ck);
  const pending = inflight.get(ck);
  if (pending) return pending;
  const p = fetchScores(apiKey, imdbId, type).then((r) => {
    inflight.delete(ck);
    const ttl = r && Object.values(r).some((value) => value !== null) ? CACHE_TTL_MS : RETRY_MS;
    lruSet(cache, ck, { scores: r, expiresAt: Date.now() + ttl }, CACHE_MAX);
    return r;
  });
  inflight.set(ck, p);
  return p;
}

export function useMdblistScores(
  key: string,
  imdbId: string | null | undefined,
  type: "movie" | "show" = "movie",
): MdblistScores | null {
  const [scores, setScores] = useState<MdblistScores | null>(null);
  useEffect(() => {
    setScores(null);
    if (!key || !imdbId) return;
    let cancelled = false;
    void mdblistScores(key, imdbId, type).then((r) => {
      if (!cancelled) setScores(r);
    });
    return () => {
      cancelled = true;
    };
  }, [key, imdbId, type]);
  return scores;
}
