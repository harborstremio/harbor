import { libraryGetOneStrict, libraryPut, type LibraryItem } from "@/lib/stremio";

const KEY = "harbor.stremio.write-queue.v1";

type Pending = { authKey: string; item: LibraryItem };

const queue = new Map<string, Pending>();
let loaded = false;
let started = false;

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
          queue.set(p.item._id, p);
        }
      }
    }
  } catch {}
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...queue.values()]));
  } catch {}
}

export function queuedWatched(
  id: string,
): { watched: string | null; flaggedWatched: number; mtime: number } | undefined {
  load();
  const p = queue.get(id);
  if (!p) return undefined;
  const s = (p.item.state ?? {}) as Record<string, unknown>;
  const watched = typeof s.watched === "string" && s.watched.length > 0 ? s.watched : null;
  const flaggedWatched = typeof s.flaggedWatched === "number" ? s.flaggedWatched : 0;
  return { watched, flaggedWatched, mtime: mtimeMs(p.item) };
}

export async function cloudLibraryPut(authKey: string, item: LibraryItem): Promise<boolean> {
  load();
  const id = item._id;
  try {
    await libraryPut(authKey, item);
    const queued = queue.get(id);
    if (queued && mtimeMs(queued.item) <= mtimeMs(item)) {
      queue.delete(id);
      persist();
    }
    return true;
  } catch {
    const existing = queue.get(id);
    if (!existing || mtimeMs(item) >= mtimeMs(existing.item)) {
      queue.set(id, { authKey, item });
      persist();
    }
    return false;
  }
}

export async function flushWriteQueue(): Promise<void> {
  load();
  if (queue.size === 0) return;
  for (const [id, pending] of [...queue.entries()]) {
    try {
      let remote: LibraryItem | null;
      try {
        remote = await libraryGetOneStrict(pending.authKey, id);
      } catch {
        continue;
      }
      const remoteSec = Math.floor((remote ? mtimeMs(remote) : 0) / 1000);
      const queuedSec = Math.floor(mtimeMs(pending.item) / 1000);
      const drop = () => {
        const current = queue.get(id);
        if (current && mtimeMs(current.item) <= mtimeMs(pending.item)) queue.delete(id);
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
