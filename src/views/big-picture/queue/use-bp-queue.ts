import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { extendPool, getPool, type FeedItem } from "@/lib/feed";
import { getDownvotedIds, getUpvotedIds } from "@/lib/feed/preferences";
import { rankByAffinity } from "@/lib/feed/rank";
import {
  blockQueueItem,
  filterQueuePool,
  shuffleQueuePool,
  snoozeQueueItem,
} from "@/lib/feed/skipped";
import { needsImageProxy } from "@/lib/remote-image-proxy";
import { useSettings } from "@/lib/settings";
import { bpHeroArt } from "../bp-art";

const LOW_WATER_MARK = 6;
const FIRST_EXTENSION_PAGE = 2;
const PREFETCH_MS = 400;

export type BpQueueStatus = "loading" | "nokey" | "unreachable" | "empty" | "ready";

export type BpQueueEntry = { meta: Meta; tag: string };

export type BpQueueState = {
  status: BpQueueStatus;
  entries: BpQueueEntry[];
  index: number;
  current: BpQueueEntry | null;
  next: BpQueueEntry | null;
  dir: 1 | -1;
  step: (delta: 1 | -1) => boolean;
  snooze: () => void;
  block: () => void;
};

// One order per pool build, held in module scope for the same reason getPool
// holds the build itself: the Discover band and the queue have to name the same
// titles in the same places, and a reshuffle on every open makes the ordinal lie
// about where you were. The cursor is never kept here. views/queue.tsx holds a
// module-level activeId and that is why it restores a position belonging to a
// pool it no longer has.
type QueueOrder = { source: FeedItem[]; key: string; items: FeedItem[]; page: number };

let order: QueueOrder | null = null;

function buildOrder(source: FeedItem[]): FeedItem[] {
  const voted = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
  const kept = filterQueuePool(source).filter((it) => !voted.has(it.meta.id));
  return rankByAffinity(shuffleQueuePool(kept));
}

// getPool memoises its build per day per key, so array identity is the exact
// test for "same pool". filterQueuePool logs on every call: this is the only
// place it may run, never per step and never per render.
function orderedPool(source: FeedItem[], key: string): FeedItem[] {
  if (order && order.source === source && order.key === key) return order.items;
  order = { source, key, items: buildOrder(source), page: FIRST_EXTENSION_PAGE };
  return order.items;
}

function dropFromOrder(id: string): FeedItem[] {
  if (!order) return [];
  order = { ...order, items: order.items.filter((it) => it.meta.id !== id) };
  return order.items;
}

function appendToOrder(key: string, items: FeedItem[]): FeedItem[] | null {
  if (!order || order.key !== key) return null;
  order = { ...order, items: [...order.items, ...items] };
  return order.items;
}

function takeExtensionPage(key: string): number | null {
  if (!order || order.key !== key) return null;
  const page = order.page;
  order = { ...order, page: page + 1 };
  return page;
}

// A key that returned nothing is unreachable; a key whose titles the viewer has
// already cleared is exhausted. Same empty screen, two sentences, one true.
function queueStatus(rawLength: number | null, count: number, key: string): BpQueueStatus {
  if (rawLength === null) return "loading";
  if (count > 0) return "ready";
  if (!key) return "nokey";
  return rawLength === 0 ? "unreachable" : "empty";
}

export function useBpQueue(): BpQueueState {
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const [rawLength, setRawLength] = useState<number | null>(null);
  const [entries, setEntries] = useState<FeedItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);

  useEffect(() => {
    let cancelled = false;
    setRawLength(null);
    setActiveId(null);
    getPool(key)
      .then((pool) => {
        if (cancelled) return;
        setEntries(orderedPool(pool, key));
        setRawLength(pool.length);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setRawLength(0);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Keyed by id rather than by number: the pool grows under the cursor when it
  // extends and shrinks when an item is removed, and an index held across either
  // of those points at a different title.
  const index = useMemo(() => {
    if (!activeId) return 0;
    const found = entries.findIndex((it) => it.meta.id === activeId);
    return found >= 0 ? found : 0;
  }, [activeId, entries]);

  const current = entries[index] ?? null;
  const next = entries[index + 1] ?? null;

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const indexRef = useRef(index);
  indexRef.current = index;

  // Stable across renders: the surface hands this to setBpQueueKeyHandler once,
  // and a fresh identity every render would re-register the arrow claim on every
  // keypress. It answers "did the cursor move", never void: the end of the run
  // has to be distinguishable from a step, or the surface claims the key, plays
  // its click and nothing happens, an affirmative sound for a refused press.
  const step = useCallback((delta: 1 | -1): boolean => {
    const target = entriesRef.current[indexRef.current + delta];
    if (!target) return false;
    setDir(delta);
    setActiveId(target.meta.id);
    return true;
  }, []);

  const remove = useCallback((persist: (id: string) => void) => {
    const list = entriesRef.current;
    const at = indexRef.current;
    const item = list[at];
    if (!item) return;
    // The successor has to be read while the item is still in the pool. Filtering
    // first collapses the indices and focus lands nowhere.
    const forward = list[at + 1] ?? null;
    const nextId = forward?.meta.id ?? list[at - 1]?.meta.id ?? null;
    const heading: 1 | -1 = forward ? 1 : -1;
    persist(item.meta.id);
    setDir(heading);
    setEntries(dropFromOrder(item.meta.id));
    setActiveId(nextId);
  }, []);

  const snooze = useCallback(() => remove(snoozeQueueItem), [remove]);
  const block = useCallback(() => remove(blockQueueItem), [remove]);

  const extending = useRef(false);
  useEffect(() => {
    if (rawLength === null || !key) return;
    if (entries.length - index - 1 > LOW_WATER_MARK) return;
    if (extending.current) return;
    const page = takeExtensionPage(key);
    if (page === null) return;
    extending.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const more = await extendPool(key, page);
        if (cancelled) return;
        const have = new Set(entriesRef.current.map((it) => it.meta.id));
        const fresh = buildOrder(more.filter((it) => !have.has(it.meta.id)));
        const grown = fresh.length > 0 ? appendToOrder(key, fresh) : null;
        if (grown) setEntries(grown);
      } finally {
        extending.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawLength, key, entries, index]);

  const warm = next?.meta.background;
  useEffect(() => {
    if (!warm) return;
    const url = bpHeroArt(warm);
    if (!url || needsImageProxy(url)) return;
    const timer = window.setTimeout(() => {
      new Image().src = url;
    }, PREFETCH_MS);
    return () => window.clearTimeout(timer);
  }, [warm]);

  const status = queueStatus(rawLength, entries.length, key);

  return useMemo(
    () => ({ status, entries, index, current, next, dir, step, snooze, block }),
    [status, entries, index, current, next, dir, step, snooze, block],
  );
}

export type BpQueuePeek = {
  status: BpQueueStatus;
  total: number;
  posters: string[];
  backdrop: string | null;
};

// The band draws off the same order the queue will open on, and drawing it warms
// getPool. Raw urls: the band sizes its own tile, the stage sizes for the screen.
// It reports the same four-way status the surface does, because total 0 alone
// cannot tell "still fetching" from "TMDB is down", and a band that can only say
// the first sits on Discover pulsing forever with the network off.
export function useBpQueuePeek(count: number): BpQueuePeek {
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const [entries, setEntries] = useState<FeedItem[]>([]);
  const [rawLength, setRawLength] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRawLength(null);
    getPool(key)
      .then((pool) => {
        if (cancelled) return;
        setEntries(orderedPool(pool, key));
        setRawLength(pool.length);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setRawLength(0);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return useMemo(
    () => ({
      status: queueStatus(rawLength, entries.length, key),
      total: entries.length,
      posters: entries.slice(0, count).flatMap((it) => (it.meta.poster ? [it.meta.poster] : [])),
      backdrop: entries[0]?.meta.background ?? null,
    }),
    [entries, count, rawLength, key],
  );
}
