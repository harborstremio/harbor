import type { IptvPlaylistSource } from "./types";

export const IPTV_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const DB_NAME = "harbor-iptv-cache";
const STORE_NAME = "entries";
const DB_VERSION = 1;
const SCHEMA_VERSION = 1;

export type IptvCacheKind = "playlist" | "xtream-vod";

export type PersistentIptvCacheEntry<T> = {
  sourceSignature: string;
  savedAt: number;
  value: T;
};

type StoredEntry<T> = PersistentIptvCacheEntry<T> & {
  schemaVersion: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function entryKey(kind: IptvCacheKind, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

export function isPersistentCacheFresh(
  fetchedAt: number | null | undefined,
  now = Date.now(),
): boolean {
  return typeof fetchedAt === "number" && now - fetchedAt < IPTV_CACHE_TTL_MS;
}

export function iptvSourceSignature(source: IptvPlaylistSource): string {
  const input = JSON.stringify([
    source.kind ?? "m3u",
    source.url,
    source.epgUrl ?? "",
    source.xtream?.server ?? "",
    source.xtream?.username ?? "",
    source.xtream?.password ?? "",
  ]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function readIptvCache<T>(
  kind: IptvCacheKind,
  sourceId: string,
): Promise<PersistentIptvCacheEntry<T> | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    return await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(entryKey(kind, sourceId));
      request.onsuccess = () => {
        const entry = request.result as StoredEntry<T> | undefined;
        if (
          !entry ||
          entry.schemaVersion !== SCHEMA_VERSION ||
          typeof entry.sourceSignature !== "string" ||
          typeof entry.savedAt !== "number"
        ) {
          resolve(null);
          return;
        }
        resolve({
          sourceSignature: entry.sourceSignature,
          savedAt: entry.savedAt,
          value: entry.value,
        });
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeIptvCache<T>(
  kind: IptvCacheKind,
  sourceId: string,
  entry: PersistentIptvCacheEntry<T>,
): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction
        .objectStore(STORE_NAME)
        .put(
          { ...entry, schemaVersion: SCHEMA_VERSION } satisfies StoredEntry<T>,
          entryKey(kind, sourceId),
        );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    /* ignore cache write failures */
  }
}

export async function deleteIptvCache(kind: IptvCacheKind, sourceId: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(entryKey(kind, sourceId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    /* ignore cache delete failures */
  }
}
