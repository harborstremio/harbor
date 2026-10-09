import { dinfo, dwarn } from "@/lib/debug";
import {
  configureSubSourceCache,
  type SourceSubCandidate,
} from "@/lib/subtitles/autosync/sub-sources";
import {
  configureCache,
  type OsSub,
} from "@/lib/subtitles/autosync/opensubtitles";



type StoredEntry = { expires: number; value: unknown };
type Entry<T> = { expires: number; value: T };

const FILE_NAME = "subtitle-cache.json";
// How many search results to keep on disk. Plenty for months of watching.
const MAX_ENTRIES = 4000;
// Coalesce rapid writes into one disk flush.
const FLUSH_DEBOUNCE_MS = 1500;

let mem: Map<string, StoredEntry> | null = null;
let loading: Promise<void> | null = null;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function cachePath(): Promise<string | null> {
  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    return await join(await appDataDir(), FILE_NAME);
  } catch {
    return null;
  }
}

async function ensureLoaded(): Promise<void> {
  if (mem) return;
  if (loading) return loading;
  loading = (async () => {
    const map = new Map<string, StoredEntry>();
    mem = map;
    if (!isTauri()) return;
    try {
      const path = await cachePath();
      if (!path) return;
      const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");
      if (!(await exists(path))) return;
      const raw = await readTextFile(path);
      const obj = JSON.parse(raw) as Record<string, StoredEntry>;
      const now = Date.now();
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v.expires === "number" && v.expires > now) {
          map.set(k, v);
        }
      }
      dinfo(`[sub-cache] loaded ${map.size} entries from disk`);
    } catch (e) {
      dwarn("[sub-cache] load failed", e);
    }
  })();
  return loading;
}

function prune(map: Map<string, StoredEntry>): void {
  const now = Date.now();
  for (const [k, v] of map) {
    if (v.expires <= now) map.delete(k);
  }
  if (map.size <= MAX_ENTRIES) return;
  // Drop the soonest-to-expire entries first.
  const sorted = [...map.entries()].sort((a, b) => a[1].expires - b[1].expires);
  const overflow = map.size - MAX_ENTRIES;
  for (let i = 0; i < overflow; i++) map.delete(sorted[i][0]);
}

function scheduleFlush(): void {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (!dirty || !mem || !isTauri()) return;
  dirty = false;
  const map = mem;
  try {
    const path = await cachePath();
    if (!path) return;
    const { appDataDir } = await import("@tauri-apps/api/path");
    const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
    try {
      await mkdir(await appDataDir(), { recursive: true });
    } catch {}
    prune(map);
    const obj: Record<string, StoredEntry> = {};
    for (const [k, v] of map) obj[k] = v;
    await writeTextFile(path, JSON.stringify(obj));
  } catch (e) {
    dirty = true;
    dwarn("[sub-cache] flush failed", e);
  }
}

function makeHooks<T>(prefix: string) {
  return {
    load: async (key: string): Promise<Entry<T> | null> => {
      await ensureLoaded();
      const map = mem;
      if (!map) return null;
      const entry = map.get(prefix + key);
      if (!entry) return null;
      if (entry.expires <= Date.now()) {
        map.delete(prefix + key);
        scheduleFlush();
        return null;
      }
      return { expires: entry.expires, value: entry.value as T };
    },
    save: async (key: string, entry: Entry<T>): Promise<void> => {
      await ensureLoaded();
      const map = mem;
      if (!map) return;
      map.set(prefix + key, { expires: entry.expires, value: entry.value });
      scheduleFlush();
    },
  };
}

let configured = false;

// Wire the persistent store into both subtitle caches. Call once at startup.
export function initSubtitleCache(): void {
  if (configured) return;
  configured = true;
  try {
    configureSubSourceCache(makeHooks<SourceSubCandidate[]>("src:"));
    configureCache(makeHooks<OsSub[]>("os:"));
    dinfo("[sub-cache] persistent subtitle cache enabled");
  } catch (e) {
    dwarn("[sub-cache] init failed", e);
  }
}
