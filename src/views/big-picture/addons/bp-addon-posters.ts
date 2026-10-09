import { fetchAddonCatalogPage } from "@/lib/addons";
import type { HomeRow } from "@/views/home/home-types";
import { bpCardArt, bpTileArtWidth } from "../bp-art";
import type { BpAddonEntry } from "./bp-addon-entries";

// BpMosaic hard-gates at COLUMNS * 2 and BpAmbient at MOSAIC_MIN, both fourteen,
// and both paint nothing below it. Topping up to the card's six would strand any
// addon between seven and thirteen: above the refetch gate, below the mosaic
// floor, wash-only forever. The gate is the band's floor for that reason.
export const BP_ADDON_MOSAIC_MIN = 14;

const MAX_POSTERS = 24;
const MAX_BASES = 24;
const RETRY_MS = 60_000;
const STORE_KEY = "harbor.bp.addon-posters.v1";
const FRESH_MS = 6 * 60 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 2000;

const pool = new Map<string, readonly string[]>();
const subs = new Set<() => void>();
let snapshot: ReadonlyMap<string, readonly string[]> = new Map();

function commit(): void {
  snapshot = new Map(pool);
  for (const fn of subs) fn();
  scheduleWrite();
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

const getSnapshot = (): ReadonlyMap<string, readonly string[]> => snapshot;

export const bpAddonPosterStore = { subscribe, getSnapshot };

type Persisted = { v: 1; at: number; by: Record<string, string[]> };

function hydrateFromStore(): void {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Persisted;
    if (!p || p.v !== 1 || typeof p.at !== "number" || Date.now() - p.at > FRESH_MS) return;
    for (const [base, urls] of Object.entries(p.by ?? {})) {
      if (!Array.isArray(urls)) continue;
      const clean = urls.filter((u): u is string => typeof u === "string").slice(0, MAX_POSTERS);
      if (clean.length > 0) pool.set(base, clean);
    }
    snapshot = new Map(pool);
  } catch {
    /* a corrupt slot is the same as a cold one */
  }
}

hydrateFromStore();

let writeTimer: number | null = null;

function scheduleWrite(): void {
  if (typeof window === "undefined" || writeTimer != null) return;
  writeTimer = window.setTimeout(() => {
    writeTimer = null;
    const by: Record<string, string[]> = {};
    let n = 0;
    for (const [base, urls] of pool) {
      if (n >= MAX_BASES) break;
      by[base] = urls.slice(0, MAX_POSTERS);
      n += 1;
    }
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ v: 1, at: Date.now(), by } satisfies Persisted),
      );
    } catch {
      // This app has been burned by a full localStorage before. Drop our own
      // slot rather than retry: the pool is a cache, and a row that repaints
      // from the network is far better than a write loop against a full store.
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {
        /* nothing left to do */
      }
    }
  }, WRITE_DEBOUNCE_MS);
}

// Copy on write, never push. commit() publishes a shallow Map copy, so the array
// it hands out is the same object this holds. Appending in place changed a
// published list's contents without changing its identity, and every consumer
// keyed on that identity (the card's useMemo, the row's band effect) went stale
// and never repainted. That is how the mosaic stayed at three cells for good.
function addPosters(base: string, urls: Array<string | undefined>): boolean {
  const held = pool.get(base) ?? [];
  const seen = new Set(held);
  const next = held.slice();
  for (const url of urls) {
    if (next.length >= MAX_POSTERS) break;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    next.push(url);
  }
  if (next.length === held.length) return false;
  pool.set(base, next);
  return true;
}

// Pass 2. Every meta an addon returned already carries its provenance, so the
// mosaics cost nothing beyond the catalogs home fetched anyway. Grouped by
// `base` and never by `id`: two installs of one addon share an id, and only the
// URL tells their artwork apart.
export function bpAddonIngestRows(rows: readonly HomeRow[]): void {
  let touched = false;
  for (const row of rows) {
    for (const meta of row.metas) {
      const base = meta.addonOrigin?.base;
      if (!base || !meta.poster) continue;
      if ((pool.get(base)?.length ?? 0) >= MAX_POSTERS) continue;
      // The tile's own target, so the mosaic requests byte-identical URLs to the
      // tiles that painted these same posters and shares their decoded images
      // instead of doubling residency.
      if (addPosters(base, [bpCardArt(meta.poster, bpTileArtWidth("poster"))])) touched = true;
    }
  }
  if (touched) commit();
}

const inflight = new Set<string>();
const cooledUntil = new Map<string, number>();

// Pass 3, single-flight per base rather than per row. A global gate meant one
// slow addon swallowed every other card's request with no requeue, so settling
// on card five while card one was still hanging left five blank for good.
export async function bpAddonTopUp(entry: BpAddonEntry): Promise<void> {
  const cursor = entry.cursor;
  if (!entry.hasCatalogs || !cursor) return;
  if (inflight.has(entry.base)) return;
  if ((pool.get(entry.base)?.length ?? 0) >= BP_ADDON_MOSAIC_MIN) return;
  if (Date.now() < (cooledUntil.get(entry.base) ?? 0)) return;
  inflight.add(entry.base);
  try {
    const metas = await fetchAddonCatalogPage(cursor.base, cursor.type, cursor.id, 0, cursor.extras);
    // Only a real answer is kept. Caching the empty one would pin the card blank
    // for the session with no retry and no error; the cooldown is what stops a
    // dead addon being asked again every time focus lands back on it.
    if (addPosters(entry.base, metas.map((m) => bpCardArt(m.poster, bpTileArtWidth("poster")))))
      commit();
    else cooledUntil.set(entry.base, Date.now() + RETRY_MS);
  } catch {
    cooledUntil.set(entry.base, Date.now() + RETRY_MS);
  } finally {
    inflight.delete(entry.base);
  }
}
