import type { MediaIdentity, MediaServerItem, MediaServerSyncSummary } from "./types";

const DB = "harbor-media-servers";
const VERSION = 2;
const ITEMS = "items";
const MAPPINGS = "mappings";
const METADATA = "metadata";
const SUMMARIES = "summaries";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ITEMS)) {
        const items = db.createObjectStore(ITEMS, { keyPath: ["connectionId", "id"] });
        items.createIndex("connectionId", "connectionId");
        items.createIndex("libraryId", ["connectionId", "libraryId"]);
        items.createIndex("tmdbId", ["identity.tmdbId", "kind"]);
      }
      if (!db.objectStoreNames.contains(MAPPINGS))
        db.createObjectStore(MAPPINGS, { keyPath: ["connectionId", "itemId"] });
      if (!db.objectStoreNames.contains(METADATA))
        db.createObjectStore(METADATA, { keyPath: "key" });
      if (!db.objectStoreNames.contains(SUMMARIES))
        db.createObjectStore(SUMMARIES, { keyPath: "connectionId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function putMediaServerItems(
  items: MediaServerItem[],
  deletedIds: string[] = [],
  connectionId?: string,
) {
  const db = await openDb();
  const tx = db.transaction(ITEMS, "readwrite");
  const store = tx.objectStore(ITEMS);
  items.forEach((item) => store.put(item));
  if (connectionId) deletedIds.forEach((id) => store.delete([connectionId, id]));
  await done(tx);
  db.close();
}
export async function mediaServerItems(connectionId?: string): Promise<MediaServerItem[]> {
  const db = await openDb();
  const tx = db.transaction(ITEMS);
  const req = connectionId
    ? tx.objectStore(ITEMS).index("connectionId").getAll(connectionId)
    : tx.objectStore(ITEMS).getAll();
  const result = await new Promise<MediaServerItem[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const mappings = await manualMappings();
  const byItem = new Map(
    mappings.map((mapping) => [`${mapping.connectionId}:${mapping.itemId}`, mapping.identity]),
  );
  return result.map((item) => {
    const mapped = byItem.get(`${item.connectionId}:${item.id}`);
    return mapped
      ? {
          ...item,
          identity: {
            ...mapped,
            season: mapped.season ?? item.identity.season,
            episode: mapped.episode ?? item.identity.episode,
          },
        }
      : item;
  });
}
export async function removeMediaServerItems(connectionId: string) {
  const db = await openDb();
  const tx = db.transaction(ITEMS, "readwrite");
  const store = tx.objectStore(ITEMS);
  const index = store.index("connectionId");
  const request = index.openKeyCursor(IDBKeyRange.only(connectionId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    store.delete(cursor.primaryKey);
    cursor.continue();
  };
  await done(tx);
  db.close();
}
export async function setManualMapping(
  connectionId: string,
  itemId: string,
  identity: MediaIdentity,
) {
  const db = await openDb();
  const tx = db.transaction(MAPPINGS, "readwrite");
  tx.objectStore(MAPPINGS).put({ connectionId, itemId, identity });
  await done(tx);
  db.close();
}
export async function manualMappings(): Promise<
  Array<{ connectionId: string; itemId: string; identity: MediaIdentity }>
> {
  const db = await openDb();
  const tx = db.transaction(MAPPINGS);
  const req = tx.objectStore(MAPPINGS).getAll();
  const result = await new Promise<
    Array<{ connectionId: string; itemId: string; identity: MediaIdentity }>
  >((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
export async function putMediaServerMetadata(key: string, meta: unknown) {
  const db = await openDb();
  const tx = db.transaction(METADATA, "readwrite");
  tx.objectStore(METADATA).put({ key, meta, updatedAt: Date.now() });
  await done(tx);
  db.close();
}
export async function mediaServerMetadata<T>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction(METADATA);
  const req = tx.objectStore(METADATA).get(key);
  const row = await new Promise<{ meta?: T } | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row?.meta ?? null;
}
export async function putMediaServerSyncSummary(summary: MediaServerSyncSummary) {
  const db = await openDb();
  const tx = db.transaction(SUMMARIES, "readwrite");
  tx.objectStore(SUMMARIES).put(summary);
  await done(tx);
  db.close();
}
export async function mediaServerSyncSummaries(): Promise<MediaServerSyncSummary[]> {
  const db = await openDb();
  const tx = db.transaction(SUMMARIES);
  const req = tx.objectStore(SUMMARIES).getAll();
  const result = await new Promise<MediaServerSyncSummary[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
export function identityMatches(a: MediaIdentity, b: MediaIdentity): boolean {
  const base =
    (a.tmdbId != null && a.tmdbId === b.tmdbId) ||
    (!!a.imdbId && a.imdbId === b.imdbId) ||
    (a.tvdbId != null && a.tvdbId === b.tvdbId);
  if (!base) return false;
  if (a.season != null || b.season != null || a.episode != null || b.episode != null)
    return a.season === b.season && a.episode === b.episode;
  return true;
}
