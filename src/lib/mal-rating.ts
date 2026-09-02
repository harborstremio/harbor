import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { kitsuToMal } from "@/lib/providers/anime-mapping";

const JIKAN = "https://api.jikan.moe/v4";
const CACHE_KEY = "harbor.malscorecache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ScoreCache = Record<string, { score: string | null; t: number }>;
const inflight = new Map<number, Promise<string | null>>();

function readCache(): ScoreCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ScoreCache) : {};
  } catch {
    return {};
  }
}

function writeCache(c: ScoreCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

export async function jikanScore(malId: number): Promise<string | null> {
  const cache = readCache();
  const hit = cache[malId];
  if (hit && Date.now() - hit.t < TTL_MS) return hit.score;
  const existing = inflight.get(malId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const r = await fetch(`${JIKAN}/anime/${malId}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { data?: { score?: number } };
      const score = typeof j?.data?.score === "number" && j.data.score > 0 ? j.data.score.toFixed(1) : null;
      const c = readCache();
      c[malId] = { score, t: Date.now() };
      writeCache(c);
      return score;
    } catch {
      return null;
    } finally {
      inflight.delete(malId);
    }
  })();
  inflight.set(malId, p);
  return p;
}

async function resolveMalId(metaId: string): Promise<number | null> {
  if (metaId.startsWith("mal:")) {
    const n = Number(metaId.slice(4));
    return Number.isFinite(n) ? n : null;
  }
  if (metaId.startsWith("kitsu:")) {
    const n = Number(metaId.slice(6));
    return Number.isFinite(n) ? kitsuToMal(n) : null;
  }
  return null;
}

/** `fromMal` is false when the number is the meta's own rating, not a Jikan score. */
export function useMalScore(meta: Meta | undefined): { score?: string; fromMal: boolean } {
  const id = meta?.id;
  const fallback = meta?.imdbRating;
  const [score, setScore] = useState<string | undefined>(undefined);
  useEffect(() => {
    setScore(undefined);
    if (!id) return;
    let cancelled = false;
    void resolveMalId(id)
      .then((malId) => {
        if (cancelled || !malId) return;
        return jikanScore(malId).then((s) => {
          if (!cancelled && s) setScore(s);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);
  return score ? { score, fromMal: true } : { score: fallback, fromMal: false };
}

export function useMalRating(meta: Meta | undefined): string | undefined {
  return useMalScore(meta).score;
}
