import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";

const DB_NAME = "harbor-bp-home";
const STORE = "home";
const VERSION = 1;
const SLOT = "rows";
// Two days. Long enough that a viewer who watches on weekends still opens onto
// their own shelves, short enough that a dead title does not sit there for a
// month. It is only ever the opening frame: a live rebuild replaces it either
// way, so the age bound is about how wrong the first paint may look.
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ROWS = 24;
const MAX_PER_ROW = 30;

const SLOT_TINTS = "tints";
// A sampled colour belongs to the poster bytes, not to the shelf the poster was
// on, so tints are not keyed by the catalog key the way rows are and they
// outlive a row snapshot by a lot. They still expire: a url can be repointed at
// new art, and a month is short enough that nothing a viewer sees often stays
// painted from art that no longer exists.
const TINT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Around 130KB at a hundred bytes an entry, against a row snapshot already
// measured in megabytes. Home draws at most MAX_ROWS * MAX_PER_ROW tiles, so
// this holds a full home screen plus what a few sessions of browsing added.
const MAX_TINTS = 1200;

export type BpHomeSnapshot = { rows: HomeRow[]; hero: Meta[] };

type Stored = BpHomeSnapshot & { key: string; at: number };

type StoredTints = { at: number; tints: Record<string, string> };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Both payloads share one store under different keys rather than taking a store
// each, because a new store needs a VERSION bump and an upgrade path, and every
// installed television is already at version 1 with this store in it.
async function readSlot<T>(slot: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(slot);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function writeSlot(slot: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * The home screen the viewer saw last time, kept so the next cold start opens
 * on real shelves instead of on nothing.
 *
 * Measured on a Fire TV Stick 4K Max: rebuilding home from the network took
 * until about 22s, and every second of it was spent on a screen with no
 * content, because useBpCatalog only cached in memory and a television kills
 * the process between sessions. IndexedDB rather than localStorage on purpose,
 * this is megabytes of metadata and localStorage is already close to its
 * ceiling with settings.
 */
export async function bpHomeCacheLoad(key: string): Promise<BpHomeSnapshot | null> {
  try {
    const value = await readSlot<Stored>(SLOT);
    if (!value || value.key !== key) return null;
    if (Date.now() - value.at > MAX_AGE_MS) return null;
    if (!Array.isArray(value.rows) || value.rows.length === 0) return null;
    return { rows: value.rows, hero: Array.isArray(value.hero) ? value.hero : [] };
  } catch {
    return null;
  }
}

export async function bpHomeCacheSave(key: string, snap: BpHomeSnapshot): Promise<void> {
  if (snap.rows.length === 0) return;
  // Trimmed before it is written, never after it is read. What goes in is what
  // the opening frame draws, and drawing thirty cards of a row nobody has
  // scrolled to costs the same as drawing three hundred.
  const rows = snap.rows.slice(0, MAX_ROWS).map((r) => ({ ...r, metas: r.metas.slice(0, MAX_PER_ROW) }));
  const payload: Stored = { key, at: Date.now(), rows, hero: snap.hero.slice(0, 12) };
  try {
    await writeSlot(SLOT, payload);
  } catch {
    /* a boot without its shelves is slow, never broken */
  }
}

/**
 * Dominant colour per poster url, sampled by bp-art-color and kept so the tiles
 * of a cold start are already the colour of their own art rather than a field
 * of empty panels waiting on the network.
 *
 * Rows land from IndexedDB in milliseconds and the posters they name take
 * seconds to arrive, so without this the fast part of the boot is a grey grid.
 */
export async function bpArtTintsLoad(): Promise<Record<string, string>> {
  try {
    const value = await readSlot<StoredTints>(SLOT_TINTS);
    if (!value || Date.now() - value.at > TINT_MAX_AGE_MS) return {};
    return value.tints && typeof value.tints === "object" ? value.tints : {};
  } catch {
    return {};
  }
}

export async function bpArtTintsSave(tints: Record<string, string>): Promise<void> {
  const keys = Object.keys(tints);
  if (keys.length === 0) return;
  // Trimmed off the front. Key order is sampling order, so the tail is what the
  // viewer has looked at most recently and the head is a shelf they left behind.
  const kept = keys.length > MAX_TINTS ? keys.slice(keys.length - MAX_TINTS) : keys;
  const out: Record<string, string> = {};
  for (const key of kept) out[key] = tints[key];
  try {
    await writeSlot(SLOT_TINTS, { at: Date.now(), tints: out } satisfies StoredTints);
  } catch {
    /* a boot without its colours is plain, never broken */
  }
}
