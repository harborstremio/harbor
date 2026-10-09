import { libraryGetOneStrict, libraryPut, type LibraryItem } from "@/lib/stremio";
import { activeLocalLibraryScope, profileFromLocalScope } from "./jl/local-library";

const KEY = "harbor.jl.library-queue.v1.";

type Pending = { authKey: string; item: LibraryItem };

let queue = new Map<string, Pending>();
let loadedScope = "";
let started = false;

function mtimeMs(item: LibraryItem): number {
  const m = item._mtime as unknown;
  if (typeof m === "number" && Number.isFinite(m)) return m;
  const parsed = Date.parse(String(m ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function load(scope = activeLocalLibraryScope()): void {
  if (loadedScope === scope) return;
  const profileId = profileFromLocalScope(scope);
  loadedScope = scope;
  queue = new Map();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY + profileId) ?? "[]");
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (p && p.item && typeof p.item._id === "string" && p.authKey === scope) {
          queue.set(p.item._id, p);
        }
      }
    }
  } catch {}
}

function persist(scope = loadedScope, entries = queue): void {
  try {
    localStorage.setItem(KEY + profileFromLocalScope(scope), JSON.stringify([...entries.values()]));
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
  load(authKey);
  const pendingQueue = queue;
  const id = item._id;
  try {
    await libraryPut(authKey, item);
    const queued = pendingQueue.get(id);
    if (queued && mtimeMs(queued.item) <= mtimeMs(item)) {
      pendingQueue.delete(id);
      persist(authKey, pendingQueue);
    }
    return true;
  } catch {
    const existing = pendingQueue.get(id);
    if (!existing || mtimeMs(item) >= mtimeMs(existing.item)) {
      pendingQueue.set(id, { authKey, item });
      persist(authKey, pendingQueue);
    }
    return false;
  }
}

export async function flushWriteQueue(): Promise<void> {
  load();
  const scope = loadedScope;
  const pendingQueue = queue;
  if (pendingQueue.size === 0) return;
  // Freeze this pass so writes queued during an await are handled by the next flush.
  const pendingEntries = Array.from(pendingQueue.entries());
  for (const [id, pending] of pendingEntries) {
    if (scope !== activeLocalLibraryScope()) break;
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
        const current = pendingQueue.get(id);
        if (current && mtimeMs(current.item) <= mtimeMs(pending.item)) pendingQueue.delete(id);
      };
      if (remoteSec >= queuedSec) {
        drop();
        continue;
      }
      await libraryPut(pending.authKey, pending.item);
      drop();
    } catch {}
  }
  persist(scope, pendingQueue);
}

export function startWriteQueueFlusher(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  load();
  window.addEventListener("online", () => void flushWriteQueue());
  window.setInterval(() => void flushWriteQueue(), 60000);
  if (queue.size > 0) void flushWriteQueue();
}
