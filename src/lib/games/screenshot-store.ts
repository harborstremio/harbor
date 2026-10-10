import { SCREENSHOT_MAX_BYTES, type ScreenshotStore } from "./screenshot-cache";

const DATABASE = "harbor-game-screenshots-v1";
type IndexEntry = { key: string; used: number; bytes: number };

/** A separate bounded public-image store; metadata snapshots never contain blobs. */
export function createScreenshotStore(name = DATABASE, maxBytes = 64 * 1024 * 1024, maxRecords = 192): ScreenshotStore {
  let connection: Promise<IDBDatabase | null> | undefined;
  function open(): Promise<IDBDatabase | null> {
    if (connection) return connection;
    connection = new Promise(resolve => {
      let settled = false;
      const finish = (db: IDBDatabase | null) => { if (settled) { db?.close(); return; } settled = true; clearTimeout(timer); resolve(db); if (!db) queueMicrotask(() => { connection = undefined; }); };
      const timer = setTimeout(() => finish(null), 1000);
      try {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => { request.result.createObjectStore("images"); request.result.createObjectStore("index", { keyPath: "key" }); };
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = undefined; }; finish(db); };
      } catch { finish(null); }
    });
    return connection;
  }
  async function transaction<T>(action: (images: IDBObjectStore, index: IDBObjectStore, result: (value: T) => void) => void, fallback: T): Promise<T> {
    const db = await open(); if (!db) return fallback;
    return new Promise(resolve => {
      let value = fallback, tx: IDBTransaction | undefined, settled = false;
      const finish = (result: T) => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
      const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(fallback); }, 1000);
      try {
        tx = db.transaction(["images", "index"], "readwrite");
        tx.oncomplete = () => finish(value); tx.onabort = tx.onerror = () => finish(fallback);
        action(tx.objectStore("images"), tx.objectStore("index"), result => { value = result; });
      } catch { try { tx?.abort(); } catch {} finish(fallback); }
    });
  }
  return {
    read: key => transaction<Blob | null>((images, index, result) => {
      const request = images.get(key);
      request.onsuccess = () => {
        const blob = request.result;
        if (!(blob instanceof Blob) || !blob.size || blob.size > SCREENSHOT_MAX_BYTES) { images.delete(key); index.delete(key); return; }
        index.put({ key, used: Date.now(), bytes: blob.size }); result(blob);
      };
    }, null),
    write: async (key, blob) => {
      if (key.length > 2500 || !blob.size || blob.size > Math.min(SCREENSHOT_MAX_BYTES, maxBytes)) return;
      await transaction<void>((images, index) => {
        images.put(blob, key); index.put({ key, used: Date.now(), bytes: blob.size });
        const request = index.getAll();
        request.onsuccess = () => {
          const entries = (request.result as IndexEntry[]).sort((a, b) => a.used - b.used);
          let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0), count = entries.length;
          for (const entry of entries) {
            if (bytes <= maxBytes && count <= maxRecords) break;
            images.delete(entry.key); index.delete(entry.key); bytes -= entry.bytes; count--;
          }
        };
      }, undefined);
    },
    remove: key => transaction<void>((images, index) => { images.delete(key); index.delete(key); }, undefined),
  };
}
