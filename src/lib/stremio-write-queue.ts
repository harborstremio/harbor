import { libraryGetOneStrict, libraryPut, type LibraryItem } from "@/lib/stremio";

const KEY = "harbor.stremio.write-queue.v1";

type Pending = { authKey: string; item: LibraryItem };

const queue = new Map<string, Pending>();
const activeWrites = new Map<string, symbol>();
let loaded = false;
let started = false;

function queueKey(authKey: string, id: string): string {
  return JSON.stringify([authKey, id]);
}

function mtimeMs(item: LibraryItem): number {
  const m = item._mtime as unknown;
  if (typeof m === "number" && Number.isFinite(m)) return m;
  const parsed = Date.parse(String(m ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (p && p.item && typeof p.item._id === "string" && typeof p.authKey === "string") {
          queue.set(queueKey(p.authKey, p.item._id), p);
        }
      }
    }
  } catch {}
}

function persist(acknowledged = false): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...queue.values()]));
  } catch (error) {
    if (acknowledged) throw error;
  }
}

export function queuedWatched(
  id: string,
  authKey: string,
): { watched: string | null; flaggedWatched: number; mtime: number } | undefined {
  load();
  const p = queue.get(queueKey(authKey, id));
  if (!p) return undefined;
  const s = (p.item.state ?? {}) as Record<string, unknown>;
  const watched = typeof s.watched === "string" && s.watched.length > 0 ? s.watched : null;
  const flaggedWatched = typeof s.flaggedWatched === "number" ? s.flaggedWatched : 0;
  return { watched, flaggedWatched, mtime: mtimeMs(p.item) };
}

export async function cloudLibraryPut(
  authKey: string,
  item: LibraryItem,
  options: { acknowledged?: boolean } = {},
): Promise<boolean> {
  load();
  const key = queueKey(authKey, item._id);
  const queuedAtStart = queue.get(key);
  const write = Symbol();
  activeWrites.set(key, write);
  try {
    await libraryPut(authKey, item);
    const queued = queue.get(key);
    if (
      queued &&
      queued === queuedAtStart &&
      activeWrites.get(key) === write &&
      mtimeMs(queued.item) <= mtimeMs(item)
    ) {
      queue.delete(key);
      persist();
    }
    return true;
  } catch {
    if (activeWrites.get(key) !== write) {
      if (options.acknowledged)
        throw new Error("A newer library change replaced this pending write.");
      return false;
    }
    const existing = queue.get(key);
    if (!existing || mtimeMs(item) >= mtimeMs(existing.item)) {
      queue.set(key, { authKey, item });
      try {
        persist(options.acknowledged);
      } catch (error) {
        if (existing) queue.set(key, existing);
        else queue.delete(key);
        throw error;
      }
    }
    return false;
  } finally {
    if (activeWrites.get(key) === write) activeWrites.delete(key);
  }
}

export async function flushWriteQueue(): Promise<void> {
  load();
  if (queue.size === 0) return;
  // Snapshot this pass: writes queued during an awaited request belong to the next pass.
  // eslint-disable-next-line unicorn/no-useless-spread
  for (const [key, pending] of [...queue.entries()]) {
    try {
      let remote: LibraryItem | null;
      try {
        remote = await libraryGetOneStrict(pending.authKey, pending.item._id);
      } catch {
        continue;
      }
      if (queue.get(key) !== pending) continue;
      const remoteSec = Math.floor((remote ? mtimeMs(remote) : 0) / 1000);
      const queuedSec = Math.floor(mtimeMs(pending.item) / 1000);
      const drop = () => {
        if (queue.get(key) === pending) queue.delete(key);
      };
      if (remoteSec >= queuedSec) {
        drop();
        continue;
      }
      await libraryPut(pending.authKey, pending.item);
      drop();
    } catch {}
  }
  persist();
}

export function startWriteQueueFlusher(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  load();
  window.addEventListener("online", () => void flushWriteQueue());
  window.setInterval(() => void flushWriteQueue(), 60000);
  if (queue.size > 0) void flushWriteQueue();
}
