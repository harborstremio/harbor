import type { Meta } from "@/lib/cinemeta";

const DISK_KEY = "harbor.cinemeta.meta.v1";
const MOVIE_TTL_MS = 24 * 60 * 60 * 1000;
const SERIES_TTL_MS = 3 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 30 * 60 * 1000;
const MEM_MAX_ENTRIES = 80;
const DISK_MAX_ENTRIES = 64;
const DISK_MAX_ENTRY_CHARS = 20000;
const DISK_MAX_TOTAL_CHARS = 400000;
const FLUSH_DELAY_MS = 4000;

type Entry = { t: number; m: Meta | null };

export type MetaLoad = { value: Meta | null; cacheable: boolean };

const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<Meta | null>>();

let diskLoaded = false;
let diskDisabled = false;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function ttlFor(key: string, m: Meta | null): number {
  if (!m) return NEGATIVE_TTL_MS;
  return key.startsWith("movie:") ? MOVIE_TTL_MS : SERIES_TTL_MS;
}

function isFresh(key: string, e: Entry): boolean {
  return Date.now() - e.t < ttlFor(key, e.m);
}

function loadDisk(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    const raw = localStorage.getItem(DISK_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    if (!parsed || typeof parsed !== "object") return;
    for (const [k, e] of Object.entries(parsed)) {
      if (!e || typeof e.t !== "number" || !("m" in e)) continue;
      if (!isFresh(k, e)) continue;
      mem.set(k, e);
    }
  } catch {
    /* ignore */
  }
}

function flushDisk(): void {
  if (!dirty || diskDisabled) return;
  dirty = false;
  const ordered = [...mem.entries()].filter(([k, e]) => isFresh(k, e)).sort((a, b) => b[1].t - a[1].t);
  const out: Record<string, Entry> = {};
  let chars = 0;
  let kept = 0;
  for (const [k, e] of ordered) {
    if (kept >= DISK_MAX_ENTRIES) break;
    let s = "";
    try {
      s = JSON.stringify(e);
    } catch {
      continue;
    }
    if (s.length > DISK_MAX_ENTRY_CHARS) continue;
    if (chars + s.length > DISK_MAX_TOTAL_CHARS) break;
    out[k] = e;
    chars += s.length;
    kept += 1;
  }
  try {
    localStorage.setItem(DISK_KEY, JSON.stringify(out));
  } catch {
    diskDisabled = true;
    try {
      localStorage.removeItem(DISK_KEY);
    } catch {
      /* ignore */
    }
  }
}

function scheduleFlush(): void {
  dirty = true;
  if (diskDisabled || flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushDisk();
  }, FLUSH_DELAY_MS);
}

function put(key: string, m: Meta | null): void {
  mem.delete(key);
  mem.set(key, { t: Date.now(), m });
  for (const oldest of mem.keys()) {
    if (mem.size <= MEM_MAX_ENTRIES) break;
    mem.delete(oldest);
  }
  scheduleFlush();
}

// Entries are stored whole. Trimming fields to save quota silently breaks every caller
// that reads meta.videos (episode lists, calendar, mark-watched); the size cap drops an
// oversized entry instead. Growth is bounded by MEM/DISK caps, not by field selection.
export function withMetaCache(
  type: "movie" | "series",
  id: string,
  load: () => Promise<MetaLoad>,
): Promise<Meta | null> {
  const key = `${type}:${id}`;
  loadDisk();
  const hit = mem.get(key);
  if (hit) {
    if (isFresh(key, hit)) return Promise.resolve(hit.m);
    mem.delete(key);
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = load()
    .then((r) => {
      if (r.cacheable) put(key, r.value);
      return r.value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}
