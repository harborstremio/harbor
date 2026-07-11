import type { Meta } from "@/lib/cinemeta";
import {
  animeFranchiseKey,
  jikanRecommendationsForMalId,
  jikanResolveMalId,
  stripFranchiseSuffix,
} from "@/lib/providers/jikan";
import type { LibraryItem } from "@/lib/stremio";
import { useEffect, useMemo, useState } from "react";

const MAL_CACHE_KEY = "harbor.anime.mal_id_by_franchise.v1";
const REC_CACHE_KEY = "harbor.anime.recs_by_mal.v1";
const REC_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type MalIdCache = Record<string, number | null>;
type RecCache = Record<string, { metas: Meta[]; t: number }>;

let malCache: MalIdCache | null = null;
let recCache: RecCache | null = null;

function loadMalCache(): MalIdCache {
  if (malCache) return malCache;
  try {
    const raw = localStorage.getItem(MAL_CACHE_KEY);
    malCache = raw ? JSON.parse(raw) : {};
  } catch {
    malCache = {};
  }
  return malCache!;
}

function loadRecCache(): RecCache {
  if (recCache) return recCache;
  try {
    const raw = localStorage.getItem(REC_CACHE_KEY);
    recCache = raw ? JSON.parse(raw) : {};
  } catch {
    recCache = {};
  }
  return recCache!;
}

let saveTimer: number | null = null;
function scheduleSave() {
  if (typeof window === "undefined") return;
  if (saveTimer != null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(MAL_CACHE_KEY, JSON.stringify(malCache ?? {}));
      localStorage.setItem(REC_CACHE_KEY, JSON.stringify(recCache ?? {}));
    } catch {
      /* quota — ignore */
    }
  }, 400);
}

function extractMalIdFromId(id: string): number | null {
  const m = id.match(/^mal:(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export async function malIdForItem(item: LibraryItem): Promise<number | null> {
  const direct = extractMalIdFromId(item._id);
  if (direct) return direct;
  const cache = loadMalCache();
  const fk = animeFranchiseKey(stripFranchiseSuffix(item.name));
  if (fk in cache) return cache[fk];
  const id = await jikanResolveMalId(stripFranchiseSuffix(item.name));
  cache[fk] = id;
  scheduleSave();
  return id;
}

async function recsForMalId(malId: number): Promise<Meta[]> {
  const cache = loadRecCache();
  const hit = cache[String(malId)];
  if (hit && Date.now() - hit.t < REC_TTL_MS) return hit.metas;
  const metas = await jikanRecommendationsForMalId(malId);
  cache[String(malId)] = { metas, t: Date.now() };
  scheduleSave();
  return metas;
}

export function useWatchHistoryRecommendations(cwItems: LibraryItem[]): Meta[] {
  const seeds = useMemo(
    () => cwItems.slice(0, 6).filter((i) => i.name && (i._id.startsWith("kitsu:") || i._id.startsWith("mal:"))),
    [cwItems],
  );

  const [recs, setRecs] = useState<Meta[]>([]);

  useEffect(() => {
    if (seeds.length === 0) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const watchedKeys = new Set(seeds.map((s) => animeFranchiseKey(stripFranchiseSuffix(s.name))));
      const scoreByKey = new Map<string, { meta: Meta; score: number }>();
      for (const item of seeds) {
        if (cancelled) return;
        const malId = await malIdForItem(item);
        if (cancelled) return;
        if (!malId) continue;
        const pool = await recsForMalId(malId);
        if (cancelled) return;
        for (let i = 0; i < pool.length; i++) {
          const m = pool[i];
          const fk = animeFranchiseKey(m.name);
          if (watchedKeys.has(fk)) continue;
          const weight = 1 + Math.max(0, 12 - i) * 0.05;
          const existing = scoreByKey.get(fk);
          if (existing) existing.score += weight;
          else scoreByKey.set(fk, { meta: m, score: weight });
        }
        if (!cancelled) {
          const arr = Array.from(scoreByKey.values())
            .sort((a, b) => b.score - a.score)
            .map((x) => x.meta);
          setRecs(arr);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seeds.map((s) => s._id).join(",")]);

  return recs;
}
