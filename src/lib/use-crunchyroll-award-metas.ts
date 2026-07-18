import { useEffect, useMemo, useState } from "react";
import {
  awardFranchiseKey,
  invalidateAnimeAwardSynonyms,
  stripAwardSequelNumber,
  uniqueWinnerFranchisesAcrossSources,
  type AwardWin,
} from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import { jikanSearchByTitle, stripFranchiseSuffix } from "@/lib/providers/jikan";

const CACHE_KEY = "harbor.anime_awards.metas.v6";

function awardMetaYear(m: Meta): number {
  const n = Number.parseInt(String(m.releaseInfo ?? "").slice(0, 4), 10);
  return Number.isFinite(n) ? n : 9999;
}

type CacheValue = Meta | null;

let memCache: Record<string, CacheValue> | null = null;
let memLoaded = false;

function loadCache(): Record<string, CacheValue> {
  if (memCache) return memCache;
  if (typeof localStorage === "undefined") {
    memCache = {};
    memLoaded = true;
    return memCache;
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    memCache = raw ? JSON.parse(raw) : {};
  } catch {
    memCache = {};
  }
  memLoaded = true;
  return memCache!;
}

let saveTimer: number | null = null;
function scheduleSave() {
  if (typeof window === "undefined" || !memLoaded) return;
  if (saveTimer != null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(memCache ?? {}));
    } catch {
      // quota exceeded — drop oldest half
      try {
        const c = memCache ?? {};
        const keys = Object.keys(c);
        const drop = keys.slice(0, Math.floor(keys.length / 2));
        for (const k of drop) delete c[k];
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      } catch {
        /* give up */
      }
    }
  }, 500);
}

let resolveAllPromise: Promise<void> | null = null;

async function resolveAll(onProgress: () => void): Promise<void> {
  if (resolveAllPromise) return resolveAllPromise;
  resolveAllPromise = (async () => {
    const cache = loadCache();
    const winners = Array.from(uniqueWinnerFranchisesAcrossSources().entries());
    for (const [fk, win] of winners) {
      if (fk in cache) continue;
      try {
        const query = stripAwardSequelNumber(stripFranchiseSuffix(win.title)).trim() || win.title;
        const results = await jikanSearchByTitle(query, 10);
        const matches = results.filter((m) => awardFranchiseKey(m.name) === fk);
        const exact = matches.find(
          (m) => stripAwardSequelNumber(stripFranchiseSuffix(m.name)).trim() === m.name.trim(),
        );
        const earliest = [...matches].sort((a, b) => awardMetaYear(a) - awardMetaYear(b))[0];
        cache[fk] = exact ?? earliest ?? null;
      } catch {
        cache[fk] = null;
      }
      scheduleSave();
      invalidateAnimeAwardSynonyms();
      onProgress();
    }
  })();
  return resolveAllPromise;
}

export type AwardWinnerEntry = { meta: Meta; win: AwardWin };

export function useCrunchyrollAwardMetas(): AwardWinnerEntry[] {
  const winnerMap = useMemo(() => uniqueWinnerFranchisesAcrossSources(), []);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void resolveAll(() => {
      if (cancelled) return;
      setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const cache = loadCache();
    const out: AwardWinnerEntry[] = [];
    for (const [fk, win] of winnerMap.entries()) {
      const cached = cache[fk];
      if (cached) out.push({ meta: cached, win });
    }
    out.sort((a, b) => {
      if (a.win.isAOTY !== b.win.isAOTY) return a.win.isAOTY ? -1 : 1;
      if (b.win.year !== a.win.year) return b.win.year - a.win.year;
      return 0;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerMap, tick]);
}
