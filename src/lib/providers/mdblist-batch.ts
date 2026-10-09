import { useEffect, useState } from "react";
import { safeFetch as fetch } from "@/lib/safe-fetch";

export type CardScores = {
  rtAudience: number | null;
  metacritic: number | null;
  letterboxd: number | null;
  trakt: number | null;
  simkl: number | null;
  score: number | null;
};

type CacheEntry = { v: CardScores | null; t: number };
type MediaKind = "movie" | "show";

const TTL = 24 * 60 * 60 * 1000;
const BACKOFF_MS = 10 * 60 * 1000;
const FLUSH_MS = 300;
const MAX_BATCH = 100;
const LS_KEY = "harbor.mdblist.cards";
const LS_CAP = 1500;

let apiKey = "";
let mem: Map<string, CacheEntry> | null = null;
let blockedUntil = 0;
let flushTimer: number | null = null;
const listeners = new Map<string, Set<() => void>>();
const queues: Record<MediaKind, Set<string>> = { movie: new Set(), show: new Set() };

export function setMdblistBatchKey(key: string): void {
  apiKey = key.trim();
}

function store(): Map<string, CacheEntry> {
  if (mem) return mem;
  mem = new Map();
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [k, e] of Object.entries(raw)) {
      if (e && now - e.t < TTL) mem.set(k, e);
    }
  } catch {
    localStorage.removeItem(LS_KEY);
  }
  return mem;
}

function persist(): void {
  try {
    const entries = [...store().entries()].sort((a, b) => b[1].t - a[1].t).slice(0, LS_CAP);
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    localStorage.removeItem(LS_KEY);
  }
}

function remember(key: string, value: CardScores | null): void {
  store().set(key, { v: value, t: Date.now() });
  listeners.get(key)?.forEach((fn) => fn());
}

function fresh(key: string): CacheEntry | undefined {
  const e = store().get(key);
  if (e && Date.now() - e.t < TTL) return e;
  return undefined;
}

function extractImdb(item: Record<string, unknown>): string | null {
  const ids = item.ids as Record<string, unknown> | undefined;
  const cands = [ids?.imdb, ids?.imdbid, item.imdbid, item.imdb_id];
  for (const c of cands) {
    if (typeof c === "string" && c.startsWith("tt")) return c;
  }
  return null;
}

function ratingFrom(item: Record<string, unknown>, sources: string[]): number | null {
  const rows = item.ratings;
  if (!Array.isArray(rows)) return null;
  for (const source of sources) {
    const r = rows.find(
      (x: { source?: string; value?: number | null }) => x?.source === source,
    ) as { value?: number | null } | undefined;
    if (typeof r?.value === "number" && r.value > 0) return r.value;
  }
  return null;
}

function scoreFrom(item: Record<string, unknown>): number | null {
  for (const k of ["score_average", "scoreaverage", "score"]) {
    const v = item[k];
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

async function flush(): Promise<void> {
  flushTimer = null;
  for (const kind of ["movie", "show"] as const) {
    const ids = [...queues[kind]].slice(0, MAX_BATCH);
    if (ids.length === 0) continue;
    for (const i of ids) queues[kind].delete(i);
    if (!apiKey || Date.now() < blockedUntil) continue;
    try {
      const res = await fetch(
        `https://api.mdblist.com/imdb/${kind}/?apikey=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        },
      );
      if (!res.ok) {
        if (res.status === 429) blockedUntil = Date.now() + BACKOFF_MS;
        continue;
      }
      const json = (await res.json()) as unknown;
      const arr = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
      const got = new Set<string>();
      for (const item of arr) {
        const id = extractImdb(item);
        if (!id) continue;
        got.add(id);
        const simklRaw = ratingFrom(item, ["simkl"]);
        remember(`${kind}:${id}`, {
          rtAudience: ratingFrom(item, ["tomatoesaudience", "audience", "popcorn"]),
          metacritic: ratingFrom(item, ["metacritic"]),
          letterboxd: ratingFrom(item, ["letterboxd"]),
          trakt: ratingFrom(item, ["trakt"]),
          simkl: simklRaw !== null ? (simklRaw > 10 ? simklRaw / 10 : simklRaw) : null,
          score: scoreFrom(item),
        });
      }
      for (const i of ids) {
        if (!got.has(i)) remember(`${kind}:${i}`, null);
      }
    } catch {
      blockedUntil = Date.now() + BACKOFF_MS;
    }
  }
  persist();
  if (queues.movie.size + queues.show.size > 0 && flushTimer == null) {
    flushTimer = window.setTimeout(() => void flush(), FLUSH_MS);
  }
}

export function mdblistCardPrefetch(imdbId: string, kind: MediaKind): void {
  if (!apiKey || !imdbId.startsWith("tt")) return;
  if (fresh(`${kind}:${imdbId}`) !== undefined) return;
  if (Date.now() < blockedUntil) return;
  queues[kind].add(imdbId);
  if (flushTimer == null) flushTimer = window.setTimeout(() => void flush(), FLUSH_MS);
}

export function mdblistCardCached(imdbId: string | undefined, kind: MediaKind): CardScores | null {
  if (!imdbId) return null;
  return fresh(`${kind}:${imdbId}`)?.v ?? null;
}

export function useMdblistCardScores(
  imdbId: string | undefined,
  kind: MediaKind,
): CardScores | null {
  const [v, setV] = useState<CardScores | null>(() => mdblistCardCached(imdbId, kind));
  useEffect(() => {
    setV(mdblistCardCached(imdbId, kind));
    if (!imdbId) return;
    const key = `${kind}:${imdbId}`;
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    const fn = () => setV(mdblistCardCached(imdbId, kind));
    set.add(fn);
    return () => {
      set.delete(fn);
      if (set.size === 0) listeners.delete(key);
    };
  }, [imdbId, kind]);
  return v;
}
