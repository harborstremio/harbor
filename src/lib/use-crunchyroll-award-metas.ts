import { useEffect, useMemo, useState } from "react";
import {
  animeAwardId,
  awardFranchiseKey,
  invalidateAnimeAwardSynonyms,
  stripAwardSequelNumber,
  uniqueWinnerFranchisesAcrossSources,
  type AwardWin,
} from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import { jikanSearchByTitle, stripFranchiseSuffix } from "@/lib/providers/jikan";

const CACHE_KEY = "harbor.anime_awards.metas.v6";

// The crawl is a safety net for award data that outgrows the bundled id map, not
// a resolver. It costs one jikan queue slot per entry at a 400ms floor, so it
// runs after the page has settled and can never take more than a handful.
const CRAWL_BUDGET = 12;
const CRAWL_IDLE_TIMEOUT_MS = 15000;

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

function awardQuery(title: string): string {
  return stripAwardSequelNumber(stripFranchiseSuffix(title)).trim() || title;
}

// src/data/anime-award-ids.json already maps every winner title this index can
// produce, so the bundled id is the answer and the network is the exception.
// Art is deliberately absent: a card with an anime id and no poster hydrates
// through useBpArt when it scrolls into view, off the jikan queue entirely.
function bundledMeta(win: AwardWin): Meta | null {
  const id = animeAwardId(win.title);
  if (!id) return null;
  return { id, type: "series", name: awardQuery(win.title) };
}

let crawlPromise: Promise<void> | null = null;

async function crawlMisses(
  misses: Array<[string, AwardWin]>,
  onProgress: () => void,
): Promise<void> {
  if (crawlPromise) return crawlPromise;
  crawlPromise = (async () => {
    const cache = loadCache();
    let spent = 0;
    for (const [fk, win] of misses) {
      if (spent >= CRAWL_BUDGET) return;
      if (fk in cache) continue;
      spent += 1;
      try {
        const results = await jikanSearchByTitle(awardQuery(win.title), 10);
        const matches = results.filter((m) => awardFranchiseKey(m.name) === fk);
        const exact = matches.find(
          (m) => stripAwardSequelNumber(stripFranchiseSuffix(m.name)).trim() === m.name.trim(),
        );
        const earliest = [...matches].sort(
          (a, b) => awardMetaYear(a) - awardMetaYear(b),
        )[0];
        cache[fk] = exact ?? earliest ?? null;
      } catch {
        cache[fk] = null;
      }
      scheduleSave();
      invalidateAnimeAwardSynonyms();
      onProgress();
    }
  })();
  return crawlPromise;
}

function whenIdle(run: () => void): () => void {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(run, { timeout: CRAWL_IDLE_TIMEOUT_MS });
    return () => win.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(run, CRAWL_IDLE_TIMEOUT_MS);
  return () => window.clearTimeout(timer);
}

export type AwardWinnerEntry = { meta: Meta; win: AwardWin };

function beats(a: AwardWinnerEntry, b: AwardWinnerEntry): boolean {
  const pa = Boolean(a.meta.poster);
  const pb = Boolean(b.meta.poster);
  if (pa !== pb) return pa;
  if (a.win.isAOTY !== b.win.isAOTY) return a.win.isAOTY;
  return a.win.year > b.win.year;
}

/**
 * `bundledIds` is opt-in because a bundled winner has an id and no art, and only
 * a caller that windows its award row and gates art on visibility can afford
 * that. views/anime.tsx renders every winner at once and hydrates a missing
 * poster the moment the card mounts, so handing it the full map would fire one
 * anime-kitsu lookup per winner in a single burst.
 */
export function useCrunchyrollAwardMetas(bundledIds = false): AwardWinnerEntry[] {
  const winnerMap = useMemo(() => uniqueWinnerFranchisesAcrossSources(), []);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cache = loadCache();
    const misses: Array<[string, AwardWin]> = [];
    for (const [fk, win] of winnerMap.entries()) {
      if (fk in cache || animeAwardId(win.title)) continue;
      misses.push([fk, win]);
    }
    if (misses.length === 0) return;
    const stop = whenIdle(() => {
      void crawlMisses(misses, () => {
        if (cancelled) return;
        setTick((t) => t + 1);
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [winnerMap]);

  return useMemo(() => {
    const cache = loadCache();
    // Two winner franchises can carry the same id, either as a romaji and an
    // English title of one show or as a bundled miss, and both would reach the
    // award row as separate cards on the same meta id.
    const byId = new Map<string, AwardWinnerEntry>();
    for (const [fk, win] of winnerMap.entries()) {
      const meta = cache[fk] ?? (bundledIds ? bundledMeta(win) : null);
      if (!meta) continue;
      const entry: AwardWinnerEntry = { meta, win };
      const held = byId.get(meta.id);
      if (held && !beats(entry, held)) continue;
      byId.set(meta.id, entry);
    }
    const out = [...byId.values()];
    out.sort((a, b) => {
      if (a.win.isAOTY !== b.win.isAOTY) return a.win.isAOTY ? -1 : 1;
      if (b.win.year !== a.win.year) return b.win.year - a.win.year;
      return 0;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerMap, tick, bundledIds]);
}
