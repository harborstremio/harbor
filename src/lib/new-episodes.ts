import { meta as fetchMeta } from "@/lib/cinemeta";
import type { LibraryItem } from "@/lib/stremio";
import { useEffect, useState } from "react";

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
