import type { MangayomiSourceRecord } from "./types";

const DB_NAME = "harbor-manga-mangayomi";
const STORE = "sources";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

let cache: MangayomiSourceRecord[] | null = null;
const listeners = new Set<() => void>();

export function subscribeMangayomiSources(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

export function mangayomiSourcesSync(): MangayomiSourceRecord[] {
  return cache ?? [];
}

export async function loadMangayomiSources(): Promise<MangayomiSourceRecord[]> {
  try {
    const db = await openDb();
    const list = await new Promise<MangayomiSourceRecord[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? (req.result as MangayomiSourceRecord[]) : []);
      req.onerror = () => resolve([]);
    });
    cache = list;
    notify();
    return list;
  } catch {
    cache = [];
    return [];
  }
}

export async function saveMangayomiSource(record: MangayomiSourceRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  cache = [...mangayomiSourcesSync().filter((x) => x.id !== record.id), record];
  notify();
}

export async function deleteMangayomiSource(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
  cache = mangayomiSourcesSync().filter((x) => x.id !== id);
  notify();
}
