import type { ResolutionResult } from "./types";

const STORAGE_KEY = "harbor.trackerresolve.v1";
const POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Short on purpose: a wrong negative suppresses every later retry for that episode.
const NEGATIVE_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 400;

type Entry = { at: number; result: ResolutionResult };

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<ResolutionResult>>();
let loaded = false;
let saveTimer: number | null = null;

function ttlFor(result: ResolutionResult): number {
  return result.ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
}

function isFresh(entry: Entry): boolean {
  return Date.now() - entry.at < ttlFor(entry.result);
}

function load(): void {
  if (loaded) return;
  loaded = true;
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.at === "number" && entry.result && isFresh(entry)) {
        entries.set(key, entry);
      }
    }
  } catch {
    /* ignore unreadable cache */
  }
}

function persistSoon(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (saveTimer != null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* ignore quota */
    }
  }, 5000);
}

function evict(): void {
  if (entries.size <= MAX_ENTRIES) return;
  const ordered = [...entries.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [key] of ordered.slice(0, entries.size - MAX_ENTRIES)) entries.delete(key);
}

export function makeKey(metaId: string, season: number, number: number): string {
  return `${metaId}|${season}|${number}`;
}

export function getResolved(key: string): ResolutionResult | null {
  load();
  const entry = entries.get(key);
  if (!entry) return null;
  if (!isFresh(entry)) {
    entries.delete(key);
    persistSoon();
    return null;
  }
  return entry.result;
}

export function setResolved(key: string, result: ResolutionResult): void {
  load();
  entries.set(key, { at: Date.now(), result });
  evict();
  persistSoon();
}

// A second play of the same episode while the first resolution is still in flight
// must join it, not start a parallel search against the tracker.
export function resolveOnce(
  key: string,
  run: () => Promise<ResolutionResult>,
): Promise<ResolutionResult> {
  const running = inflight.get(key);
  if (running) return running;
  const started = run()
    .then((result) => {
      // Transient failures stay uncached so a later attempt can still resolve them.
      if (result.ok || result.reason === "not-found") setResolved(key, result);
      return result;
    })
    .catch((): ResolutionResult => ({ ok: false, reason: "error" }))
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, started);
  return started;
}

export function clearResolved(): void {
  entries.clear();
  inflight.clear();
  loaded = true;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
