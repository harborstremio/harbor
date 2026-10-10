const DB_NAME = "harbor-blob-cache";
const DB_VERSION = 1;
const STORE = "entries";

export type IdbCacheEntry = { at: number; data: unknown };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let request: IDBRequest;
        try {
          request = work(db.transaction(STORE, mode).objectStore(STORE));
        } catch {
          resolve(null);
          return;
        }
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => resolve(null);
      }),
  );
}

export function idbCacheGet(key: string): Promise<IdbCacheEntry | null> {
  return run<IdbCacheEntry>("readonly", (store) => store.get(key));
}

export function idbCacheSet(key: string, entry: IdbCacheEntry): Promise<void> {
  return run("readwrite", (store) => store.put(entry, key)).then(() => undefined);
}

export function idbCacheDelete(key: string): Promise<void> {
  return run("readwrite", (store) => store.delete(key)).then(() => undefined);
}

export function idbCacheKeys(): Promise<string[]> {
  return run<IDBValidKey[]>("readonly", (store) => store.getAllKeys()).then((keys) =>
    (keys ?? []).map(String),
  );
}

export function evictLocalPrefix(prefix: string, keep?: (key: string) => boolean): number {
  let dropped = 0;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && !keep?.(key)) doomed.push(key);
    }
    for (const key of doomed) {
      localStorage.removeItem(key);
      dropped += 1;
    }
  } catch {}
  return dropped;
}
