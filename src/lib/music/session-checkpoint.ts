export type MusicCheckpointOrigin = {
  kind: "playlist" | "similar";
  id: string;
  name: string;
};

export type MusicCheckpoint = {
  key?: string;
  /** Where the queue came from, so the dock title can go back there after a restart. */
  origin?: MusicCheckpointOrigin | null;
  sourceKey?: string;
  position?: number;
  savedAt?: number;
};

const DB_NAME = "harbor-music-session";
const STORE_NAME = "checkpoint";
const DB_VERSION = 1;
const ROW_ID = "current";

/**
 * The resume point used to live only in localStorage, which on a real install sits at the
 * 5MB cap: 741 keys, several hundred KB each of disposable addon catalogue cache. setItem
 * then throws QuotaExceededError, the write is inside a catch that swallows it, and the
 * checkpoint silently does not persist. The song resumed from zero and nothing reported a
 * failure. IndexedDB is not on that budget, so the checkpoint stops competing with cache.
 * localStorage is still written as a mirror, because it is synchronous and therefore the
 * only thing that can be trusted during an unload.
 */
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export function writeCheckpointToDb(value: MusicCheckpoint | null): void {
  void openDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (value) store.put(value, ROW_ID);
      else store.delete(ROW_ID);
    } catch {
      // A failed checkpoint must never interrupt playback.
    }
  });
}

export function readCheckpointFromDb(): Promise<MusicCheckpoint | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<MusicCheckpoint | null>((resolve) => {
      try {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ROW_ID);
        request.onsuccess = () => resolve((request.result as MusicCheckpoint) ?? null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

/** The newer of the two stores wins, so a stale mirror cannot undo a good checkpoint. */
export function newerCheckpoint(
  a: MusicCheckpoint | null,
  b: MusicCheckpoint | null,
): MusicCheckpoint | null {
  if (!a) return b;
  if (!b) return a;
  const at = Number.isFinite(a.savedAt) ? a.savedAt! : 0;
  const bt = Number.isFinite(b.savedAt) ? b.savedAt! : 0;
  return bt > at ? b : a;
}

/**
 * A restored position is only usable when it sits inside the track. The previous guard read
 * `position < duration - 2`, which is false whenever the duration is unknown at boot, so
 * every track whose length the bootstrap did not carry silently resumed from zero.
 */
export function usableCheckpointPosition(
  position: number | undefined,
  durationSeconds: number | undefined,
): number {
  if (!Number.isFinite(position) || (position as number) <= 0) return 0;
  const at = position as number;
  if (!Number.isFinite(durationSeconds) || (durationSeconds as number) <= 0) return at;
  return at < (durationSeconds as number) - 2 ? at : 0;
}
