import { safeFetch } from "@/lib/safe-fetch";
import { useEffect, useState } from "react";

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

const cache = new Map<string, MdblistScores | null>();
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

async function fetchScores(key: string, imdbId: string, type: "movie" | "show"): Promise<MdblistScores | null> {
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
  if (!key || !imdbId.startsWith("tt")) return Promise.resolve(null);
  const ck = `${type}:${imdbId}`;
  if (cache.has(ck)) return Promise.resolve(cache.get(ck) ?? null);
  const pending = inflight.get(ck);
  if (pending) return pending;
  const p = fetchScores(key, imdbId, type).then((r) => {
    inflight.delete(ck);
    cache.set(ck, r);
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
