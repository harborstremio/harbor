import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import {
  animeFranchiseKey,
  jikanRecommendationsForMalId,
  jikanResolveMalId,
  stripFranchiseSuffix,
} from "@/lib/providers/jikan";
import type { LibraryItem } from "@/lib/stremio";

const MAL_CACHE_KEY = "harbor.anime.mal_id_by_franchise.v1";
const REC_CACHE_KEY = "harbor.anime.recs_by_mal.v1";
const REC_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type MalIdCache = Record<string, number>;
type RecCache = Record<string, { metas: Meta[]; t: number }>;

let malCache: MalIdCache | null = null;
let recCache: RecCache | null = null;

// Null entries are dropped on load, not kept. This cache has no TTL, and the
// era when a failed lookup was written as null left devices with franchises that
// could never resolve again. Reading them back would keep those devices broken.
function loadMalCache(): MalIdCache {
  if (malCache) return malCache;
  try {
    const raw = localStorage.getItem(MAL_CACHE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as MalIdCache;
    const out: MalIdCache = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "number") out[k] = v;
    malCache = out;
  } catch {
    malCache = {};
  }
  return malCache!;
}

function loadRecCache(): RecCache {
  if (recCache) return recCache;
  try {
    const raw = localStorage.getItem(REC_CACHE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as RecCache;
    const out: RecCache = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v?.metas) && v.metas.length > 0) out[k] = v;
    }
    recCache = out;
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

// use-anime-top-picks resolves the same six seeds at the same time, so without
// this the two callers each spend a jikan queue slot on the same franchise.
const malInflight = new Map<string, Promise<number | null>>();

// A no-match is remembered for the session only. Persisting it is what turned one
// bad night into a franchise that never resolved again, and a jikan failure now
// rejects rather than arriving here as a null to be mistaken for a no-match.
const malMisses = new Set<string>();

export async function malIdForItem(item: LibraryItem): Promise<number | null> {
  const direct = extractMalIdFromId(item._id);
  if (direct) return direct;
  const cache = loadMalCache();
  const fk = animeFranchiseKey(stripFranchiseSuffix(item.name));
  const hit = cache[fk];
  if (typeof hit === "number") return hit;
  if (malMisses.has(fk)) return null;
  const existing = malInflight.get(fk);
  if (existing) return existing;
  const p = (async () => {
    try {
      const id = await jikanResolveMalId(stripFranchiseSuffix(item.name));
      if (typeof id === "number") {
        cache[fk] = id;
        scheduleSave();
      } else {
        malMisses.add(fk);
      }
      return id;
    } finally {
      malInflight.delete(fk);
    }
  })();
  malInflight.set(fk, p);
  return p;
}

async function recsForMalId(malId: number): Promise<Meta[]> {
  const cache = loadRecCache();
  const hit = cache[String(malId)];
  if (hit && Date.now() - hit.t < REC_TTL_MS) return hit.metas;
  const metas = await jikanRecommendationsForMalId(malId);
  // An empty pool is a failure far more often than it is an answer, and this
  // cache holds for thirty days.
  if (metas.length > 0) {
    cache[String(malId)] = { metas, t: Date.now() };
    scheduleSave();
  }
  return metas;
}

export function useWatchHistoryRecommendations(cwItems: LibraryItem[]): Meta[] {
  const seeds = useMemo(
    () =>
      cwItems
        .slice(0, 6)
        .filter((i) => i.name && (i._id.startsWith("kitsu:") || i._id.startsWith("mal:"))),
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
      const watchedKeys = new Set(
        seeds.map((s) => animeFranchiseKey(stripFranchiseSuffix(s.name))),
      );
      // One rejected seed must not take the other five down with it, and the
      // pools are folded back in seed order so the meta that represents a
      // franchise is the same one the serial walk used to pick.
      const pools = await Promise.all(
        seeds.map(async (item) => {
          const malId = await malIdForItem(item).catch(() => null);
          if (!malId) return [] as Meta[];
          return recsForMalId(malId).catch(() => [] as Meta[]);
        }),
      );
      if (cancelled) return;
      const scoreByKey = new Map<string, { meta: Meta; score: number }>();
      for (const pool of pools) {
        for (let i = 0; i < pool.length; i++) {
          const m = pool[i];
          const fk = animeFranchiseKey(m.name);
          if (watchedKeys.has(fk)) continue;
          const weight = 1 + Math.max(0, 12 - i) * 0.05;
          const existing = scoreByKey.get(fk);
          if (existing) existing.score += weight;
          else scoreByKey.set(fk, { meta: m, score: weight });
        }
      }
      setRecs(
        Array.from(scoreByKey.values())
          .sort((a, b) => b.score - a.score)
          .map((x) => x.meta),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [seeds.map((s) => s._id).join(",")]);

  return recs;
}
