import { useEffect, useState } from "react";
import { meta as fetchMeta } from "@/lib/cinemeta";
import type { LibraryItem } from "@/lib/stremio";

const TTL = 6 * 60 * 60 * 1000;
const RECENT_MS = 45 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: number; t: number }>();
const inflight = new Map<string, Promise<number>>();

async function compute(id: string, lastWatchedMs: number): Promise<number> {
  const m = await fetchMeta("series", id).catch(() => null);
  const vids = m?.videos ?? [];
  const now = Date.now();
  let count = 0;
  for (const v of vids) {
    const raw = v.released ?? v.firstAired;
    const rel = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(rel)) continue;
    if (rel > now) continue;
    if (rel > lastWatchedMs && now - rel < RECENT_MS) count++;
  }
  return count;
}

export function hasNewEpisode(item: LibraryItem): Promise<number> {
  if (!item._id.startsWith("tt") || item.type !== "series") return Promise.resolve(0);
  const lastWatched = Date.parse(item.state?.lastWatched ?? item._mtime ?? "");
  if (!Number.isFinite(lastWatched)) return Promise.resolve(0);
  const key = `${item._id}|${Math.floor(lastWatched / 60_000)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.value);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = compute(item._id, lastWatched)
    .then((value) => {
      cache.set(key, { value, t: Date.now() });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function useHasNewEpisode(item: LibraryItem): number {
  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFresh(0);
    void hasNewEpisode(item).then((v) => {
      if (!cancelled) setFresh(v);
    });
    return () => {
      cancelled = true;
    };
  }, [item._id, item.state?.lastWatched, item._mtime]);
  return fresh;
}

export type NewEpisode = {
  key: string;
  seriesId: string;
  seriesName: string;
  season: number;
  episode: number;
  title: string;
  still: string | null;
  poster: string | null;
  released: number;
};

const DISMISS_KEY = "harbor.newEpisodes.dismissed.v1";
const listCache = new Map<string, { at: number; items: NewEpisode[] }>();
const listInflight = new Map<string, Promise<NewEpisode[]>>();

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(keys: Set<string>): void {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...keys].slice(-600)));
  } catch {
    /* private mode or quota */
  }
}

export function dismissEpisodes(keys: string[]): void {
  const set = readDismissed();
  for (const k of keys) set.add(k);
  writeDismissed(set);
}

export function isDismissed(key: string): boolean {
  return readDismissed().has(key);
}

async function computeList(item: LibraryItem, lastWatchedMs: number): Promise<NewEpisode[]> {
  const m = await fetchMeta("series", item._id).catch(() => null);
  if (!m) return [];
  const now = Date.now();
  const out: NewEpisode[] = [];

  for (const v of m.videos ?? []) {
    const raw = v.released ?? v.firstAired;
    const rel = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(rel) || rel > now) continue;
    if (rel <= lastWatchedMs || now - rel >= RECENT_MS) continue;

    const season = v.season ?? 0;
    const episode = v.episode ?? v.number ?? 0;
    if (season === 0 && episode === 0) continue;

    out.push({
      key: `${item._id}:${season}:${episode}`,
      seriesId: item._id,
      seriesName: item.name ?? "",
      season,
      episode,
      title: v.name ?? v.title ?? "",
      still: v.thumbnail ?? null,
      poster: m.poster ?? item.poster ?? null,
      released: rel,
    });
  }

  return out;
}

export function newEpisodesFor(item: LibraryItem): Promise<NewEpisode[]> {
  if (!item._id.startsWith("tt") || item.type !== "series") return Promise.resolve([]);
  const lastWatched = Date.parse(item.state?.lastWatched ?? item._mtime ?? "");
  if (!Number.isFinite(lastWatched)) return Promise.resolve([]);

  const key = `${item._id}|${Math.floor(lastWatched / 60_000)}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.items);

  const pending = listInflight.get(key);
  if (pending) return pending;

  const p = computeList(item, lastWatched)
    .then((items) => {
      listCache.set(key, { at: Date.now(), items });
      return items;
    })
    .finally(() => {
      listInflight.delete(key);
    });

  listInflight.set(key, p);
  return p;
}
